import EventEmitter from 'events';
import Logger from 'winston';
import Enum from './util/Enum';
import CommandParser from './util/Singleton';

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
const service_uuids = {
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
// the usage of the channels are also documented here
// http://forum.developer.parrot.com/t/ble-characteristics-of-minidrones/5912/2
const characteristicSendUuids = new Enum({
  'SEND_NO_ACK': '0a',     // not-ack commands (PCMD only)
  'SEND_WITH_ACK': '0b',     // ack commands (all piloting commands)
  'SEND_HIGH_PRIORITY': '0c',     // emergency commands
  'ACK_COMMAND': '1e',     // ack for data sent on 0e
});

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


export default class DroneConnection extends EventEmitter {
  constructor(options) {
    super();

    const defaults = {
      droneFilter: '',
    };

    this.options = Object.assign({}, defaults, options);
    this.characteristics = [];

    this._characteristicLookupCache = {};
    this._commandCallback = {};
    this._sensorStore = {};

    // Noble returns an instance when you require
    // it. So we need to prevent webpack from
    // pre-loading it.
    this.noble = eval('require(\'noble\')');

    // bind noble event handlers
    this.noble.on('stateChange', state => this._onNobleStateChange(state));
    this.noble.on('discover', peripheral => this._onPeripheralDiscovery(peripheral));
    this.setMaxListeners(30);

    Logger.info('Searching for drones...');
  }

  /**
   * Event handler for when noble broadcasts a state change
   * @param  {String} state a string describing noble's state
   * @return {undefined}
   * @private
   */
  _onNobleStateChange(state) {
    Logger.info(`Noble state change ${state}`);

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

      setTimeout(() => this.emit('connected'), 200);
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

  runCommand(cmd) {
    const buffer = cmd.toBuffer();

    Logger.debug('Sending buffer: ' + buffer);

    this.getCharacteristic();
  }

  getCharacteristic(uuid) {
    uuid = uuid.toLowerCase();

    if (typeof this._characteristicLookupCache[uuid] === 'undefined') {
      const target = this.characteristics.find(x => x.uuid.substr(4, 4).toLowerCase() === uuid);

      this._characteristicLookupCache[uuid] = target;
    }

    return this._characteristicLookupCache[uuid];
  }

  /**
   *
   * @param {DroneCommand} command
   */
  runCommand(command) {
    // @todo support different characteristics besides fa0a
    this.getCharacteristic('fa0a').write(command.toBuffer(), true);
  }

  _handleIncoming(channelUuid, buffer) {
    const channel = characteristicReceiveUuids.findForValue(channelUuid);

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
        const callback = this._commandCallback[channel];
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

  _updateSensors(buffer, ack) {
    const command = CommandParser.getInstance().getCommandFromBuffer(buffer);
    const sensorToken = [command.projectName, command.className, command.commandName].join('-');

    this._sensorStore[sensorToken] = command;



    Logger.debug('RECV:', command.toString());
  }
}
