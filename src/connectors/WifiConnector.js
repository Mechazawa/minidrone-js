const EventEmitter = require('events');
const Logger = require('winston');
const dgram = require('dgram');
const net = require('net');
const ARDiscoveryError = require('../ARDiscoveryError');
const mdns = require('mdns');

class WifiConnector extends EventEmitter {
  constructor(droneFilter = '', deviceId = '') {
    super();

    this.droneFilter = droneFilter;
    this.deviceId = deviceId || Math.random().toString(36); // Should be persistant between connections
  }

  connect() {
    if (!this.browser && !this.server && !this.client) {
      Logger.debug('Starting mDNS browser');

      const resolverSequence = [
        // eslint-disable-next-line new-cap
        mdns.rst.DNSServiceResolve(),
        // eslint-disable-next-line new-cap
        mdns.rst.DNSServiceGetAddrInfo({ families: [4] }),
      ];

      this.browser = mdns.createBrowser(mdns.udp('_arsdk-090b'), { resolverSequence }); // @todo browse all

      this.browser.on('serviceUp', service => this._onMdnsServiceDiscovery(service));

      this.browser.start();
    }
  }

  _onMdnsServiceDiscovery(service) {
    if (!service.fullname.includes('_arsdk-')) {
      return;
    }

    if (this.droneFilter && service.name !== this.droneFilter) {
      Logger.debug(`Found drone ${service.name} but it didn't match the drone filter`);
      return;
    }

    this.browser.stop();
    delete this.browser;

    Logger.debug(`Found drone ${service.name}`);

    this._handshake(service);
  }

  _handshake(service) {
    Logger.info('Doing Wifi handshake');

    this.server = dgram.createSocket('udp4');

    this.server.on('data', msg => {
      Logger.debug('got data from server');
      this.emit(msg.msg)
    });
    this.server.on('close', () => this.disconnect());
    this.server.on('error', (err) => {
      this.disconnect();

      throw err;
    });

    this.server.on('listening', () => {
      const address = this.server.address();

      Logger.debug(`Server listening ${address.address}:${address.port}`);

      const handshakeClient = new net.Socket();

      handshakeClient.connect(service.port, service.addresses[0], () => {
        const config = {
          'd2c_port': this.server.address().port,
          'controller_type': 'minidrone-js',
          'controller_name': 'me.shodan.minidrone-js',
          // 'device_id': this.deviceId, // @ todo drone returns errors
        };

        Logger.debug('Negotiating connection:', config);

        handshakeClient.write(JSON.stringify(config));
      });

      handshakeClient.on('data', data => {
        data = data.toString();
        data = data.replace('\0', ''); // Remove trailing nullbyte
        data = JSON.parse(data);

        Logger.debug('Got drone response: ', data);

        if (data.status !== 0) {
          const error = ARDiscoveryError.findForValue(data.status);

          throw new Error(error);
        }

        handshakeClient.destroy();

        this.ip = service.addresses[0];
        this.port = data.c2d_port;
        this.client = dgram.createSocket('udp4');

        this.emit('connected');
      });
    });

    this.server.bind(0); // random utp port
  }

  write(buffer, characteristic) {
    return new Promise((accept, reject) => {
      this.client.send(buffer, this.port, this.ip, err => {
        if (err) {
          reject(err);
        }

        accept();
      });
    });
  }

  disconnect() {
    Logger.info('Disconnected');

    delete this.browser;
    delete this.server;
    delete this.ip;
    delete this.port;
    delete this.client;

    this.emit('disconnected');
  }

  get connected() {
    return this.server && this.client;
  }
}

module.exports = WifiConnector;
