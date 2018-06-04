const noble = require('noble');
const BaseConnector = require('./BaseConnector');
const Logger = require('winston');
const Enum = require('../util/Enum');
const { characteristicUuids, characteristicReceiveUuids } = require('../CharacteristicEnums');

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

// the following UUID segments come from the Mambo and from the documenation at
// http://forum.developer.parrot.com/t/minidrone-characteristics-uuid/4686/3
// the 3rd and 4th bytes are used to identify the service
const serviceUuids = new Enum({
  'fa': 'ARCOMMAND_SENDING_SERVICE',
  'fb': 'ARCOMMAND_RECEIVING_SERVICE',
  'fc': 'PERFORMANCE_COUNTER_SERVICE',
  'fd21': 'NORMAL_BLE_FTP_SERVICE',
  'fd51': 'UPDATE_BLE_FTP',
  'fe00': 'UPDATE_RFCOMM_SERVICE',
  '1800': 'Device Info',
  '1801': 'unknown',
});

class BLEConnector extends BaseConnector {
  constructor(droneFilter = '') {
    super();

    this.droneFilter = droneFilter;

    this._characteristicLookupCache = {};
    this.characteristics = [];
  }

  connect() {
    if (this.peripheral) {
      noble.warn('Already connected. Ignoring connect request');
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
        const target = this.getCharacteristic(uuid);

        target.subscribe();
        target.on('data', data => this.emit('data', data));
      }

      Logger.debug('Adding listeners: ' + characteristicReceiveUuids.values().join(', '));
      for (const uuid of characteristicReceiveUuids.values()) {
        const target = this.getCharacteristic(uuid);

        target.subscribe();
        target.on('data', data => this.emit('data', data));
      }

      Logger.info(`Device connected ${this.peripheral.advertisement.localName}`);

      // Register some event handlers
      /**
       * Drone disconnected event
       * Fired when the bluetooth connection has been disconnected
       *
       * @event DroneCommand#disconnected
       */
      noble.on('disconnect', () => this.disconnect());

      setTimeout(() => {
        /**
         * Drone connected event
         * You can control the drone once this event has been triggered.
         *
         * @event DroneCommand#connected
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

  sendCommand(command) {
    const buffer = Buffer.concat([new Buffer(2), command.toBuffer()]);
    const packetId = this._getStep(command.bufferFlag);

    buffer.writeUInt16LE(command.bufferFlag, 0);
    buffer.writeUInt8(packetId, 1);

    return new Promise(accept => {
      Logger.debug(`SEND ${command.bufferType}[${packetId}]: `, command.toString());

      if (command.shouldAck) {
        // @todo ack
        // this._commandCallback[packetId] = accept;
        setTimeout(accept, 100);
      } else {
        accept();
      }
      this.write(buffer, command.sendCharacteristicUuid);
    });
  }

  ack() {

  }
}

module.exports = BLEConnector;
