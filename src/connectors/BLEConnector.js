const noble = require('@abandonware/noble');
const BaseConnector = require('./BaseConnector');
const Logger = require('winston');
const { bufferType } = require('../BufferEnums');
const { receiveUuids } = require('../CharacteristicEnums');

const MANUFACTURER_SERIALS = [
  '4300cf1900090100',
  '4300cf1909090100',
  '4300cf1907090100',
];

const DRONE_PREFIXES = [
  'RS_',
  'Mars_',
  'Travis_',
  'Maclan_',
  'Mambo_',
  'Blaze_',
  'NewZ_',
];

// http://forum.developer.parrot.com/t/minidrone-characteristics-uuid/4686/3
const handshakeUuids = [
  'fb0f', 'fb0e', 'fb1b', 'fb1c',
  'fd22', 'fd23', 'fd24', 'fd52',
  'fd53', 'fd54',
];

class BLEConnector extends BaseConnector {
  constructor(droneFilter = '') {
    super();

    this.droneFilter = droneFilter;

    this._characteristicLookupCache = {};
    this.characteristics = [];
  }

  connect() {
    if (this.peripheral) {
      Logger.warn('Already connected. Ignoring connect request');

      return;
    }

    if (noble.state === 'unknown') {
      Logger.debug('Noble state is unknown. Waiting for it to change to poweredOn');
      noble.once('stateChange', () => this.connect());
    } else if (noble.state === 'poweredOn') {
      Logger.info('Searching for drones...');

      noble.on('discover', peripheral => this._onPeripheralDiscovery(peripheral));

      noble.startScanning();
    }
  }

  /**
   * Event handler for when noble discovers a peripheral
   * Validates it is a drone and attempts to connect.
   *
   * @param {Peripheral} peripheral a noble peripheral class
   * @return {undefined}
   * @private
   */
  _onPeripheralDiscovery(peripheral) {
    if (!this._validatePeripheral(peripheral)) {
      return;
    }

    Logger.info(`Peripheral found ${peripheral.advertisement.localName}`); // ex: Mambo_646859

    noble.stopScanning();

    peripheral.connect((error) => {
      if (error) {
        throw error;
      }

      this._peripheral = peripheral;

      this._setupPeripheral();
    });
  }

  /**
   * Validates a noble Peripheral class is a Parrot MiniDrone
   * @param {Peripheral} peripheral a noble peripheral object class
   * @return {boolean} If the peripheral is a drone
   * @private
   */
  _validatePeripheral(peripheral) {
    if (!peripheral) {
      return false;
    }

    const localName = peripheral.advertisement.localName;
    const manufacturer = peripheral.advertisement.manufacturerData;
    const matchesFilter = this.droneFilter ? localName === this.droneFilter : false;

    const localNameMatch = matchesFilter || DRONE_PREFIXES.some((prefix) => localName && localName.indexOf(prefix) >= 0);
    const manufacturerMatch = manufacturer && MANUFACTURER_SERIALS.indexOf(manufacturer) >= 0;

    // Is TRUE according to droneFilter or if empty, for EITHER an "RS_" name OR manufacturer code.
    return localNameMatch || manufacturerMatch;
  }

  /**
   * Sets up a peripheral and finds all of it's services and characteristics
   * @return {undefined}
   */
  _setupPeripheral() {
    this.peripheral.discoverAllServicesAndCharacteristics((err, services, characteristics) => {
      if (err) {
        throw err;
      }

      this.characteristics = characteristics;

      if (Logger.level === 'debug') {
        Logger.debug('Found the following characteristics:');

        // Get uuids
        const characteristicUuids = this.characteristics.map(x => x.uuid.substr(4, 4).toLowerCase());

        characteristicUuids.sort();

        characteristicUuids.join(', ').replace(/([^\n]{40,}?), /g, '$1|').split('|').map(s => Logger.debug(s));
      }

      Logger.debug('Preforming handshake');
      for (const uuid of handshakeUuids) {
        // Subscribing enables notifications; the actual data is handled on the receive characteristics below
        this.getCharacteristic(uuid).subscribe();
      }

      Logger.debug('Adding listeners: ' + receiveUuids.values().join(', '));
      for (const uuid of receiveUuids.values()) {
        const target = this.getCharacteristic(uuid);

        target.subscribe();
        target.on('data', data => this._handleIncoming(data));
      }

      Logger.info(`Device connected ${this.peripheral.advertisement.localName}`);

      // Register some event handlers
      /**
       * Drone disconnected event
       * Fired when the bluetooth connection has been disconnected
       *
       * @event BaseConnector#disconnected
       */
      noble.on('disconnect', () => this.disconnect());

      setTimeout(() => {
        /**
         * Drone connected event
         * You can control the drone once this event has been triggered.
         *
         * @event BaseConnector#connected
         */
        this.emit('connected');
      }, 200);
    });
  }

  /**
   * @returns {Peripheral} a noble peripheral object class
   */
  get peripheral() {
    return this._peripheral;
  }

  /**
   * Finds a Noble Characteristic class for the given characteristic UUID
   * @param {String} uuid The characteristics UUID
   * @return {Characteristic} The Noble Characteristic corresponding to that UUID
   */
  getCharacteristic(uuid) {
    uuid = uuid.toLowerCase();

    if (typeof this._characteristicLookupCache[uuid] === 'undefined') {
      this._characteristicLookupCache[uuid] = this.characteristics.find(x => x.uuid.substr(4, 4).toLowerCase() === uuid);
    }

    return this._characteristicLookupCache[uuid];
  }

  write(buffer, characteristic) {
    return new Promise(accept => {
      this.getCharacteristic(characteristic).write(buffer, true, accept);
    });
  }

  disconnect() {
    delete this._peripheral;

    this.characteristics = [];

    this.emit('disconnected');
  }

  get connected() {
    return this.characteristics.length > 0;
  }

  /**
   * Send a command to the drone
   * @param {DroneCommand} command - Command to send
   * @returns {Promise} - Resolves once the drone acknowledges the command (if it requires an
   *                       ack) or immediately otherwise; rejects if the ack times out
   * @async
   */
  sendCommand(command) {
    const buffer = Buffer.concat([Buffer.alloc(2), command.toBuffer()]);
    const packetId = this._getStep(command.bufferFlag);

    buffer.writeUInt16LE(command.bufferFlag, 0);
    buffer.writeUInt8(packetId, 1);

    Logger.debug(`SEND ${command.bufferType}[${packetId}]: `, command.toString());

    const promise = new Promise((accept, reject) => {
      if (!command.shouldAck) {
        accept();

        return;
      }

      // The drone replies with an ACK frame carrying this packet id; resolve then.
      const timeout = setTimeout(() => {
        delete this._commandCallback[packetId];

        reject(new Error('Command timed out after 5 seconds'));
      }, 5 * 1000);

      this._commandCallback[packetId] = () => {
        clearTimeout(timeout);

        accept();
      };
    });

    this.write(buffer, command.sendCharacteristicUuid);

    return promise;
  }

  /**
   * Handles an incoming BLE notification: forwards the raw buffer and, for data
   * frames, parses the payload into a {@link DroneCommand} and emits it as 'incoming'
   * so the base connector can store the sensor reading.
   * @param {Buffer} data - The raw characteristic notification buffer
   * @returns {void}
   * @private
   */
  _handleIncoming(data) {
    // Forward the raw buffer for low level consumers
    this.emit('data', data);

    const type = bufferType.findForValue(data.readUInt8(0));

    if (type === 'ACK') {
      const packetId = data.readUInt8(2);
      const callback = this._commandCallback[packetId];

      if (typeof callback === 'function') {
        Logger.debug(`ACK: packet id ${packetId}`);

        delete this._commandCallback[packetId];

        callback();
      } else {
        Logger.debug(`ACK: packet id ${packetId}, no callback`);
      }

      return;
    }

    // The first two bytes are the frame header (type + sequence number)
    if (data[2] === 0) {
      return;
    }

    try {
      const command = this.parser.parseBuffer(data.slice(2));

      this.emit('incoming', command);
    } catch (e) {
      Logger.warn('Unable to parse packet:', data);
      Logger.warn(e);
    }
  }
}

module.exports = BLEConnector;
