const BaseConnector = require('./BaseConnector');
const Logger = require('winston');
const dgram = require('dgram');
const net = require('net');
const ARDiscoveryError = require('../ARDiscoveryError');
const mdns = require('mdns');
const { bufferType } = require('../BufferEnums');
const { promisify } = require('../util/reflection');

/**
 * Wifi connector for the drone
 *
 * Used for connecting to drones using Wifi
 */
class WifiConnector extends BaseConnector {
  /**
   * Create a Wifi connector
   * @param {string?} droneFilter - Name of the drone
   * @param {string?} deviceId - Persistent device id for reconnection
   */
  constructor(droneFilter = '', deviceId = '') {
    super();

    this.droneFilter = droneFilter;
    this.deviceId = deviceId || ('000' + Math.round(Math.random() * 1000).toString()).slice(-4); // Should be persistant between connections
  }

  /**
   * @inheritDoc
   */
  connect(host = null, port = null) {
    if (!(!this.browser && !this.server && !this.client)) {
      return new Promise(accept => accept());
    } else if (host && port) {
      return this._connect(host, port);
    } else {
      Logger.debug('Starting mDNS browser');

      const resolverSequence = [
        // eslint-disable-next-line new-cap
        mdns.rst.DNSServiceResolve(),
        // eslint-disable-next-line new-cap
        mdns.rst.DNSServiceGetAddrInfo({families: [4]}),
      ];

      this.browser = mdns.createBrowser(mdns.udp('_arsdk-090b'), {resolverSequence}); // @todo browse all

      return new Promise(accept => {
        this.browser.on('serviceUp', service => this._onMdnsServiceDiscovery(service).then(c => !c || accept()));

        this.browser.start();
      });
    }
  }

  /**
   * @inheritDoc
   */
  get connected() {
    return this.browser && this.server && this.client;
  }

  async _onMdnsServiceDiscovery(service) {
    if (!service.fullname.includes('_arsdk-')) {
      Logger.debug(`Skipping mdns service ${service.fullname}`);
      return false;
    }

    if (this.droneFilter && service.name !== this.droneFilter) {
      Logger.debug(`Found drone ${service.name} but it didn't match the drone filter`);
      return false;
    }

    this.browser.stop();
    delete this.browser;

    Logger.debug(`Found drone ${service.name}`);

    try {
      await this._connect(service);
    } catch (e) {
      this.disconnect();

      throw e;
    }

    return true;
  }

  async _connect(host, port) {
    Logger.info(`Doing Wifi handshake with ${host}`);

    await this._startServer();

    this.ip = host;

    let data = await this._sendHandshake(this.ip, port);

    data = data.toString();
    data = data.replace('\0', ''); // Remove trailing nullbyte
    data = JSON.parse(data);

    Logger.debug('Got drone response: ', data);

    if (data.status !== 0) {
      const error = ARDiscoveryError.findForValue(data.status);

      throw new Error(error);
    }

    this.port = data.c2d_port;

    this.client = dgram.createSocket('udp4');

    this.client.on('error', err => {
      this.disconnect();

      throw err;
    });

    Logger.debug(`Stream available at ${this.rtspStreamUri}`);

    /**
     * Drone connected event
     * You can control the drone once this event has been triggered.
     *
     * @event BaseConnector#connected
     */
    this.emit('connected');
  }

  async _startServer() {
    if (this.server) {
      Logger.warn('Found existing running server, closing it');
      this.server.close();
    }

    this.server = dgram.createSocket('udp4');

    this.server.on('close', () => this.disconnect());
    this.server.on('error', (err) => {
      this.disconnect();

      throw err;
    });

    this.server.on('message', msg => this._handleIncoming(msg));

    this.server.bind(0); // random utp port

    await promisify(this.server.once.bind(this.server))('listening');
  }

  async _sendHandshake(ip, port) {
    const address = this.server.address();

    Logger.debug(`Server listening ${address.address}:${address.port}`);

    const handshakeClient = new net.Socket();

    handshakeClient.connect(port, ip, () => {
      const config = {
        'd2c_port': this.server.address().port,
        'controller_type': 'minidrone-js',
        'controller_name': 'me.shodan.minidrone-js',
        // 'device_id': this.deviceId, // @ todo drone returns errors
      };

      Logger.debug('Negotiating connection:', config);

      handshakeClient.write(JSON.stringify(config));
    });

    const data = await promisify(handshakeClient.once.bind(handshakeClient))('data');

    handshakeClient.destroy();

    return data;
  }

  /**
   * Write raw buffer to the drone
   * @param {Buffer} buffer
   * @returns {number} - Resolves with the number of bytes sent
   * @async
   */
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

  /**
   * Disconnect from the drone
   * @emits BaseConnector#disconnected
   * @returns {void}
   */
  disconnect() {
    this.server.close();

    delete this.browser;
    delete this.server;
    delete this.ip;
    delete this.port;
    delete this.client;

    Logger.info('Disconnected');

    this.emit('disconnected');
  }

  /**
   * Send a command to the drone
   * @param {DroneCommand} command - Command to send
   * @returns {Promise} - Resolves when the command has been acknowledged or rejects if it times out
   */
  async sendCommand(command) {
    const commandBuffer = command.toBuffer();
    const buffer = Buffer.concat([new Buffer(7), commandBuffer]);
    const bufferId = command.bufferId;
    const packetId = this._getStep(bufferId);

    buffer.writeUInt8(command.bufferFlag, 0); // data type
    buffer.writeUInt8(bufferId, 1); // buffer id
    buffer.writeUInt8(packetId, 2); // sequence number
    buffer.writeUInt32LE(commandBuffer.length + 7, 3); // frame size

    this.write(buffer, command.sendCharacteristicUuid);

    try {
      return await this._setAckCallback(command, packetId);
    } catch (e) {
      if (e.message.startsWith('Command timed out')) {
        this.disconnect();
      }

      throw e;
    }
  }

  _handleIncoming(buffer) {
    const type = bufferType.findForValue(buffer.readUInt8(0));

    switch (type) {
      case 'ACK':
        const bufferId = buffer.readUInt8(1) - 128;
        const packetId = buffer.readUInt8(7);

        const callback = (this._commandCallback[bufferId] || {})[packetId];

        if (typeof callback.accept === 'function') {
          callback.accept();
        }

        break;
      case 'DATA_WITH_ACK':
        const ackBuffer = Buffer.alloc(8);

        ackBuffer.writeUInt8(bufferType.ACK, 0);
        ackBuffer.writeUInt8(buffer.readUInt8(1) + 128, 1);
        ackBuffer.writeUInt8(this._getStep(bufferType.ACK), 2);
        ackBuffer.writeUInt32LE(8, 3); // frame size, always 8 for an ACK
        ackBuffer.writeUInt8(buffer.readUInt8(2), 7);

        this.write(ackBuffer);
      case 'DATA':
      case 'LOW_LATENCY_DATA':
        const frame = buffer.slice(7);

        this.emit('data', frame);

        try {
          const command = this.parser.parseBuffer(frame);

          Logger.debug(command.toString(true));

          this.emit('incoming', command);
        } catch (e) {
          Logger.error(e);
        }
    }
  }

  /**
   * Returns an approximation of the rtsp stream uri. Sometimes it's the gateway not the drone itself oddly enough.
   * @returns {string} - stream uri
   */
  get rtspStreamUri() {
    return 'rtsp://192.168.99.1/media/stream2';
  }
}

module.exports = WifiConnector;
