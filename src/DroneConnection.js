import EventEmitter from 'events';
import Logger from 'winston';

const MANUFACTURER_SERIALS = ['4300cf1900090100', '4300cf1909090100', '4300cf1907090100'];
const DRONE_PREFIXES = ['RS_', 'Mars_', 'Travis_', 'Maclan_', 'Mambo_', 'Blaze_', 'NewZ_'];

export default class DroneConnection extends EventEmitter {
  constructor(options) {
    super();

    const defaults = {
      droneFilter: '',
    };

    this.options = Object.assign({}, defaults, options);
    this.characteristics = [];

    Logger.level = 'debug';

    // Noble returns an instance when you require
    // it. So we need to prevent webpack from
    // pre-loading it.
    this.noble = eval("require('noble')");

    // bind noble event handlers
    this.noble.on('stateChange', state => this._onNobleStateChange(state));
    this.noble.on('discover', peripheral => this._onPeripheralDiscovery(peripheral));

    Logger.info('Searching for drones...');
  }

  /**
   * Event handler for when noble broadcasts a state change
   * @param  {String} state a string describing noble's state
   * @return {undefined}
   * @private
   */
  _onNobleStateChange(state) {
    Logger.debug(`Noble state change ${state}`);

    if (state === 'poweredOn') {
      this.noble.startScanning();
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

    Logger.info(`Peripheral found ${peripheral.advertisement.localName}`);

    this.noble.stopScanning();

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
    const matchesFilter = localName === this.options.droneFilter;

    const localNameMatch = matchesFilter || DRONE_PREFIXES.some((prefix) => localName && localName.indexOf(prefix) >= 0);
    const manufacturerMatch = manufacturer && (MANUFACTURER_SERIALS.indexOf(manufacturer) >= 0);

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
    });
  }

  /**
   * @returns {Peripheral} a noble peripheral object class
   */
  get peripheral() {
    return this._peripheral;
  }

  /**
   * @returns {boolean} If the drone is connected
   */
  get connected() {
    return this.characteristics.length > 0;
  }
}
