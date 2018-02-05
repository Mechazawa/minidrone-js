import EventEmitter from 'events';
import Logger from 'winston';
import Enum from './util/Enum';
import CommandParser from './CommandParser';

const MANUFACTURER_SERIALS = ['4300cf1900090100', '4300cf1909090100', '4300cf1907090100'];
const DRONE_PREFIXES = ['RS_', 'Mars_', 'Travis_', 'Maclan_', 'Mambo_', 'Blaze_', 'NewZ_'];

// http://forum.developer.parrot.com/t/minidrone-characteristics-uuid/4686/3
const handshakeUuids = [
  'fb0f', 'fb0e', 'fb1b', 'fb1c',
  'fd22', 'fd23', 'fd24', 'fd52',
  'fd53', 'fd54',
];

// the following UUID segments come from the Mambo and from the documenation at
// http://forum.developer.parrot.com/t/minidrone-characteristics-uuid/4686/3
// the 3rd and 4th bytes are used to identify the service
const serviceUuids = {
  'fa': 'ARCOMMAND_SENDING_SERVICE',
  'fb': 'ARCOMMAND_RECEIVING_SERVICE',
  'fc': 'PERFORMANCE_COUNTER_SERVICE',
  'fd21': 'NORMAL_BLE_FTP_SERVICE',
  'fd51': 'UPDATE_BLE_FTP',
  'fe00': 'UPDATE_RFCOMM_SERVICE',
  '1800': 'Device Info',
  '1801': 'unknown',
};

// the following characteristic UUID segments come from the documentation at
// http://forum.developer.parrot.com/t/minidrone-characteristics-uuid/4686/3
// the 4th bytes are used to identify the characteristic
// the types of commands and data coming back are also documented here
// http://forum.developer.parrot.com/t/ble-characteristics-of-minidrones/5912/2
const characteristicReceiveUuids = new Enum({
  'ACK_DRONE_DATA': '0e', // drone data that needs an ack (needs to be ack on 1e)
  'NO_ACK_DRONE_DATA': '0f', // data from drone (including battery and others), no ack
  'ACK_COMMAND_SENT': '1b', // ack 0b channel, SEND_WITH_ACK
  'ACK_HIGH_PRIORITY': '1c', // ack 0c channel, SEND_HIGH_PRIORITY
});

/**
 * Drone connection class
 *
 * Exposes an api for controlling the drone
 *
 * @fires DroneCommand#connected
 * @fires DroneCommand#sensor:
 */
export default class DroneConnection extends EventEmitter {
  /**
   * Creates a new DroneConnection instance
   * @param {string} droneFilter - The drone name leave blank for no filter
   */
  constructor(droneFilter = '') {
    super();

    this.characteristics = [];

    this._characteristicLookupCache = {};
    this._commandCallback = {};
    this._sensorStore = {};
    this._stepStore = {};

    this.droneFilter = droneFilter;

    // Noble returns an instance when you require
    // it. So we need to prevent webpack from
    // pre-loading it.
    // eslint-disable-next-line no-eval
    this.noble = eval('require(\'noble\')');
    this._parser = new CommandParser();

    // bind noble event handlers
    this.noble.on('stateChange', state => this._onNobleStateChange(state));
    this.noble.on('discover', peripheral => this._onPeripheralDiscovery(peripheral));
  }

  /**
   * Event handler for when noble broadcasts a state change
   * @param  {String} state a string describing noble's state
   * @return {undefined}
   * @private
   */
  _onNobleStateChange(state) {
    Logger.debug(`Noble state changed to ${state}`);

    if (state === 'poweredOn') {
      Logger.info('Searching for drones...');
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
    const matchesFilter = !this.droneFilter || localName === this.droneFilter;

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

      // @todo
      // Parse characteristics and only store the ones needed
      // also validate that they're also present
      this.characteristics = characteristics;

      Logger.debug('Preforming handshake');
      for (const uuid of handshakeUuids) {
        const target = this.getCharacteristic(uuid);

        target.subscribe();
      }

      Logger.debug('Adding listeners');
      for (const uuid of characteristicReceiveUuids.values()) {
        const target = this.getCharacteristic('fb' + uuid);

        target.subscribe();
        target.on('data', data => this._handleIncoming(uuid, data));
      }

      Logger.info(`Device connected ${this.peripheral.advertisement.localName}`);

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
   * @returns {boolean} If the drone is connected
   */
  get connected() {
    return this.characteristics.length > 0;
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

  /**
   * Send a command to the drone and execute it
   * @param {DroneCommand} command - Command instance to be ran
   */
  runCommand(command) {
    Logger.debug('SEND: ', command.toString());

    const buffer = command.toBuffer();
    const messageId = this._getStep(command.bufferType);

    buffer.writeUInt16LE(messageId, 1);

    this.getCharacteristic(command.sendCharacteristicUuid).write(buffer, true);
  }

  /**
   * Handles incoming data from the drone
   * @param {string} channelUuid - The channel uuid
   * @param {Buffer} buffer - The packet data
   * @private
   */
  _handleIncoming(channelUuid, buffer) {
    const channel = characteristicReceiveUuids.findForValue(channelUuid);
    let callback;

    switch (channel) {
      case 'ACK_DRONE_DATA':
        // We need to response with an ack
        this._updateSensors(buffer.slice(2), true);
        break;
      case 'NO_ACK_DRONE_DATA':
        this._updateSensors(buffer.slice(2), false);
        break;
      case 'ACK_COMMAND_SENT':
      case 'ACK_HIGH_PRIORITY':
        callback = this._commandCallback[channel];

        delete this._commandCallback[channel];

        if (typeof callback === 'function') {
          callback();
        }

        break;
      default:
        Logger.warn(`Got data on an unknown channel ${channel} (wtf!?)`);
        break;
    }
  }

  /**
   * Update the sensor
   *
   * @param {Buffer} buffer - Buffer containing just the command info
   * @param {boolean} ack - If an acknowledgement for receiving the data should be sent
   * @private
   * @fires DroneConnection#sensor:
   * @todo implement ack
   */
  _updateSensors(buffer, ack = false) {
    if (buffer[0] === 0) {
      return;
    }

    try {
      const command = this._parser.parseBuffer(buffer);
      const token = [command.projectName, command.className, command.commandName].join('-');

      this._sensorStore[token] = command;

      Logger.debug('RECV:', command.toString());

      /**
       * Fires when a new sensor reading has been received
       *
       * @event DroneConnection#sensor:
       * @type {DroneCommand} - The sensor reading
       * @example
       * connection.on('sensor:minidrone-UsbAccessoryState-GunState', function(sensor) {
       *  if (sensor.state.value === sensor.enum.READY) {
       *    console.log('The gun is ready to fire!');
       *  }
       * });
       */
      this.emit('sensor:' + token, command);
    } catch (e) {
      Logger.warn('Unable to parse packet:', buffer);
      Logger.warn(e);
    }
  }

  /**
   * Get the most recent sensor reading
   *
   * @param {string} project - Project name
   * @param {string} class_ - Class name
   * @param {string} command - Command name
   * @returns {DroneCommand|undefined} - {@link DroneCommand} instance or {@link undefined} if no sensor reading could be found
   * @see {@link https://github.com/Parrot-Developers/arsdk-xml/blob/master/xml/}
   */
  getSensor(project, class_, command) {
    const token = [project, class_, command].join('-');

    return this.getSensorFromToken(token);
  }

  /**
   * Get the most recent sensor reading using the sensor token
   *
   * @param {string} token - Command token
   * @returns {DroneCommand|undefined} - {@link DroneCommand} instance or {@link undefined} if no sensor reading could be found
   * @see {@link https://github.com/Parrot-Developers/arsdk-xml/blob/master/xml/}
   * @see {@link DroneCommand.getToken}
   */
  getSensorFromToken(token) {
    let command = this._sensorStore[token];

    if (command) {
      command = command.copy();
    }

    return command;
  }

  /**
   * Get the logger level
   * @returns {string|number} - logger level
   * @see {@link https://github.com/winstonjs/winston}
   */
  get logLevel() {
    return Logger.level;
  }

  /**
   * Set the logger level
   * @param {string|number} value - logger level
   * @see {@link https://github.com/winstonjs/winston}
   */
  set logLevel(value) {
    Logger.level = typeof value === 'number' ? value : value.toString();
  }

  /**
   * used to count the drone command steps
   * @param {string} id - Step store id
   * @returns {number}
   */
  _getStep(id) {
    if (typeof this._stepStore[id] === 'undefined') {
      this._stepStore[id] = 0;
    }

    const out = this._stepStore[id];

    this._stepStore[id] = this._stepStore[id] + 1 & 0xFF;

    return out;
  }
}
