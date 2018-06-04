const BaseConnector = require('./BaseConnector');
const Logger = require('winston');
const dgram = require('dgram');
const net = require('net');
const ARDiscoveryError = require('../ARDiscoveryError');
const mdns = require('mdns');
const { bufferType } = require('../BufferEnums');

class WifiConnector extends BaseConnector {
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
    Logger.info(`Doing Wifi handshake with ${service.addresses[0]} [${service.addresses.join(', ')}]`);

    this.server = dgram.createSocket('udp4');

    this.server.on('close', () => this.disconnect());
    this.server.on('error', (err) => {
      this.disconnect();

      throw err;
    });

    this.server.on('message', (msg, info) => {
      Logger.debug(`Got data from server ${info.address}:${info.port} (${info.size} bytes)`);

      this._handleIncoming(msg);
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

        this.client.on('error', err => {
          this.disconnect();

          throw err;
        });

        this.emit('connected');
      });
    });

    this.server.bind(0); // random utp port
  }

  write(buffer) {
    return new Promise((accept, reject) => {
      this.client.send(buffer, 0, buffer.length, this.port, this.ip, err => {
        if (err) {
          reject(err);
        }

        accept(buffer.length);
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

  sendCommand(command) {
    const commandBuffer = command.toBuffer();
    const buffer = Buffer.concat([new Buffer(7), commandBuffer]);
    const bufferId = command.bufferId;
    const packetId = this._getStep(bufferId);

    buffer.writeUInt8(command.bufferFlag, 0); // data type
    buffer.writeUInt8(bufferId, 1); // buffer id
    buffer.writeUInt8(packetId, 2); // sequence number
    buffer.writeUInt32LE(commandBuffer.length + 7, 3); // frame size

    return new Promise(accept => {
      Logger.debug(`SEND ${command.bufferType}[${packetId}]: `, command.toString());

      if (command.shouldAck) {
        if (!this._commandCallback[bufferId]) {
          this._commandCallback[bufferId] = {};
        }

        this._commandCallback[bufferId][packetId] = accept;
      } else {
        accept();
      }
      this.write(buffer, command.sendCharacteristicUuid);
    });
  }

  _handleIncoming(buffer) {
    const type = bufferType.findForValue(buffer.readUInt8(0));

    switch (type) {
      case 'ACK':
        const bufferId = buffer.readUInt8(1) - 128;
        const packetId = buffer.readUInt8(7);

        const callback = (this._commandCallback[bufferId] || {})[packetId];

        if (typeof callback === 'function') {
          callback();
        }

        break;
      case 'DATA_WITH_ACK':
        const ackBuffer = Buffer.alloc(8);

        ackBuffer.writeUInt8(bufferType.ACK, 0);
        ackBuffer.writeUInt8(buffer.readUInt8(1) + 128, 1);
        ackBuffer.writeUInt8(this._getStep(bufferType.ACK), 2);
        ackBuffer.writeUInt32LE(8, 3); // frame size, always 8 for an ACK
        ackBuffer.writeUInt8(buffer.readUInt8(2), 7);

        Logger.debug(`SEND ACK: buffer ${buffer.readUInt8(1)}, step ${buffer.readUInt8(2)}`);
        this.write(ackBuffer);
      case 'DATA':
      case 'LOW_LATENCY_DATA':
        try {
          const command = this.parser.parseBuffer(buffer.slice(7));

          Logger.debug(command.toString(true));

          this.emit('incoming', command);
        } catch (e) {
          Logger.error(e);
        }
    }
  }
}

module.exports = WifiConnector;
