const noble = require('noble');
const EventEmitter = require('events');
const Logger = require('winston');
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

class BLEConnector extends EventEmitter {
  constructor() {

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

    Logger.info(`Peripheral found ${peripheral.advertisement.localName}`); //ex: Mambo_646859

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
      }

      Logger.debug('Adding listeners (fb uuid prefix)');
      for (const uuid of characteristicReceiveUuids.values()) {
        const target = this.getCharacteristic('fb' + uuid);

        target.subscribe();
        target.on('data', data => this._handleIncoming(uuid, data));
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

  write(characteristic, buffer) {
    this.getCharacteristic(characteristicUuids[characteristic]).write(buffer, true);
  }

  disconnect() {
    delete this._peripheral;

    this.characteristics = [];

    this.emit('disconnected');
  }
}

module.exports = BLEConnector;
