import DroneCommandArgument from './DroneCommandArgument';
import Enum from './util/Enum';

const bufferType = new Enum({
  ACK: 0x02, // Acknowledgment of previously received data
  DATA: 0x02, // Normal data (no ack requested)
  NON_ACK: 0x02, // Same as DATA
  HIGH_PRIO: 0x02, // Not sure about this one could be LLD
  LOW_LATENCY_DATA: 0x03, // Treated as normal data on the network, but are given higher priority internally
  DATA_WITH_ACK: 0x04, // Data requesting an ack. The receiver must send an ack for this data unit!
});

const bufferCharTranslationMap = {
  ACK: 'ACK_COMMAND',
  DATA: 'SEND_NO_ACK',
  NON_ACK: 'SEND_NO_ACK',
  HIGH_PRIO: 'SEND_HIGH_PRIORITY',
  LOW_LATENCY_DATA: 'SEND_NO_ACK',
  DATA_WITH_ACK: 'SEND_WITH_ACK',
};

// the following characteristic UUID segments come from the documentation at
// http://forum.developer.parrot.com/t/minidrone-characteristics-uuid/4686/3
// the 4th bytes are used to identify the characteristic
// the usage of the channels are also documented here
// http://forum.developer.parrot.com/t/ble-characteristics-of-minidrones/5912/2
const characteristicSendUuids = new Enum({
  SEND_NO_ACK: '0a', // not-ack commands (PCMD only)
  SEND_WITH_ACK: '0b', // ack commands (all piloting commands)
  SEND_HIGH_PRIORITY: '0c', // emergency commands
  ACK_COMMAND: '1e', // ack for data sent on 0e
});

const stepStore = {};

/**
 * used to count the drone command steps
 * @todo Make this handled by the {@link DroneConnection} class
 * @param id
 * @returns {number}
 */
function getStep(id) {
  if (typeof stepStore[id] === 'undefined') {
    stepStore[id] = 0;
  }

  const out = stepStore[id];

  stepStore[id] = (stepStore[id] + 1)&0xFF;

  return out;
}

/**
 * Drone command
 *
 * Used for building commands to be sent to the drone. It
 * is also used for the sensor readings.
 *
 * Arguments are automatically mapped on the object. This
 * means that it is easy to set command arguments. Default
 * arguments values are 0 or their enum equivalent by default.
 *
 * @example
 * const parser = new CommandParser();
 * const backFlip = parser.getCommand('minidrone', 'Animations', 'Flip', {direction: 'back'});
 * const frontFlip = backFlip.clone();
 *
 * backFlip.direction = 'front';
 *
 * drone.runCommand(backFlip);
 */
export default class DroneCommand {
  /**
   * Creates a new DroneCommand instance
   * @param {object} project - Project node from the xml spec
   * @param {object} class_ - Class node from the xml spec
   * @param {object} command - Command node from the xml spec
   */
  constructor(project, class_, command) {
    this._project = project;
    this._projectId = Number(project.$.id);
    this._projectName = String(project.$.name);

    this._class = class_;
    this._classId = Number(class_.$.id);
    this._className = String(class_.$.name);

    this._command = command;
    this._commandId = Number(command.$.id);
    this._commandName = String(command.$.name);

    this._deprecated = command.$.deprecated === 'true';
    this._description = String(command._).trim();
    this._arguments = (command.arg || []).map(x => new DroneCommandArgument(x));

    // NON_ACK, ACK or HIGH_PRIO. Defaults to ACK
    this._buffer = command.$.buffer || 'DATA_WITH_ACK';

    this._mapArguments();
  }

  /**
   * The project id
   * @returns {number}
   */
  get projectId() {
    return this._projectId;
  }

  /**
   * The project name (minidrone, common, etc)
   * @returns {string}
   */
  get projectName() {
    return this._projectName;
  }

  /**
   * The class id
   * @returns {number}
   */
  get classId() {
    return this._classId;
  }

  /**
   * The class name
   * @returns {string}
   */
  get className() {
    return this._className;
  }

  /**
   * The command id
   * @returns {number}
   */
  get commandId() {
    return this._commandId;
  }

  /**
   * The command name
   * @returns {string}
   */
  get commandName() {
    return this._commandName;
  }

  /**
   * Array containing the drone arguments
   * @returns {DroneCommandArgument[]}
   */
  get arguments() {
    return this._arguments;
  }

  /**
   * Returns if the command has any arguments
   * @returns {boolean}
   */
  hasArguments() {
    return this.arguments.length > 0;
  }

  /**
   * Get the argument names. These names are also mapped to the instance
   * @returns {string[]}
   */
  get argumentNames() {
    return this.arguments.map(x => x.name);
  }

  /**
   * Get the command description
   * @returns {string}
   */
  get description() {
    return this._description;
  }

  /**
   * Get if the command has been deprecated
   * @returns {boolean}
   */
  get deprecated() {
    return this._deprecated;
  }

  /**
   * Get the send characteristic uuid based on the buffer type
   * @returns {string}
   */
  get sendCharacteristicUuid() {
    const t = bufferCharTranslationMap[this.bufferType] || 'SEND_WITH_ACK';

    return 'fa' + characteristicSendUuids[t];
  }

  /**
   * Checks if the command has a certain argument
   * @param {string} key - Argument name
   * @returns {boolean} - If the argument exists
   */
  hasArgument(key) {
    return this.arguments.findIndex(x => x.name === key) !== -1;
  }

  /**
   * Clones the instance
   * @returns {DroneCommand}
   */
  clone() {
    return new this.constructor(this._project, this._class, this._command);
  }

  /**
   * Converts the command to it's buffer representation
   * @returns {Buffer} - Command buffer
   * @todo don't fill in message id but use the first byte of the buffer to look up the current step in the connection handler
   * @throws TypeError
   */
  toBuffer() {
    const bufferLength = 6 + this.arguments.reduce((acc, val) => val.getValueSize() + acc, 0);
    const buffer = new Buffer(bufferLength);

    const messageId = getStep(this.bufferType);

    buffer.fill(0);

    buffer.writeUInt16LE(this.bufferFlag, 0);
    buffer.writeUInt16LE(messageId, 1);

    buffer.writeUInt16LE(this.projectId, 2);
    buffer.writeUInt16LE(this.classId, 3);
    buffer.writeUInt16LE(this.commandId, 4); // two bytes

    let bufferOffset = 6;

    for (const arg of this.arguments) {
      let valueSize = arg.getValueSize();

      switch (arg.type) {
        case 'u8':
        case 'u16':
        case 'u32':
        case 'u64':
          buffer.writeUIntLE(Math.floor(arg.value), bufferOffset, valueSize);
          break;
        case 'i8':
        case 'i16':
        case 'i32':
        case 'i64':
        case 'enum':
          buffer.writeIntLE(Math.floor(arg.value), bufferOffset, valueSize);
          break;
        case 'string':
          buffer.write(arg.value, bufferOffset, valueSize, 'ascii');
          break;
        case 'float':
          buffer.writeFloatLE(arg.value, bufferOffset);
          break;
        case 'double':
          buffer.writeDoubleLE(arg.value, bufferOffset);
          break;
        default:
          throw new TypeError(`Can't encode buffer: unknown data type "${arg.type}" for argument "${arg.name}" in ${this.getToken()}`);
      }

      bufferOffset += valueSize;
    }

    return buffer;
  }

  /**
   * Maps the arguments to the class
   * @private
   */
  _mapArguments() {
    for (const arg of this.arguments) {
      const init = {
        enumerable: false,
        get: () => arg,
        set: v => arg.value = v,
      };

      Object.defineProperty(this, arg.name, init);
    }
  }

  /**
   * Returns a string representation of a DroneCommand
   * @param {boolean} debug - If extra debug information should be shown
   * @returns {string} - String representation if the instance
   * @example
   * const str = command.toString();
   *
   * str === 'minidrone PilotingSettingsState PreferredPilotingModeChanged mode="medium"(1)';
   */
  toString(debug = false) {
    const argStr = this.arguments.map(x => x.toString(debug)).join(' ').trim();

    return (this.getToken() + ' ' + argStr).trim();
  }

  /**
   * Get the command buffer type
   * @returns {string}
   */
  get bufferType() {
    return this._buffer.toUpperCase();
  }

  /**
   * Get the command buffer flag based on it's type
   * @returns {number}
   */
  get bufferFlag() {
    return bufferType[this.bufferType];
  }

  /**
   * Get the token representation of the command. This
   * is useful for registering sensors for example
   * @returns {string}
   * @example
   * const backFlip = parser.getCommand('minidrone', 'Animations', 'Flip', {direction: 'back'});
   *
   * backFlip.getToken() === 'minidrone-Animations-Flip';
   */
  getToken() {
    return [this.projectName, this.className, this.commandName].join('-');
  }
}
