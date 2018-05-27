const DroneCommandArgument = require('./DroneCommandArgument');
const Enum = require('./util/Enum');
const { characteristicSendUuids } = require('./CharacteristicEnums');

const bufferType = new Enum({
  ACK: 0x02, // Acknowledgment of previously received data
  DATA: 0x02, // Normal data (no ack requested)
  NON_ACK: 0x02, // Same as DATA
  HIGH_PRIO: 0x02, // Not sure about this one could be LLD
  LOW_LATENCY_DATA: 0x03, // Treated as normal data on the network, but are given higher priority internally
  DATA_WITH_ACK: 0x04, // Data requesting an ack. The receiver must send an ack for this data unit!
});

const bufferCharTranslationMap = new Enum({
  ACK: 'ACK_COMMAND',
  DATA: 'SEND_NO_ACK',
  NON_ACK: 'SEND_NO_ACK',
  HIGH_PRIO: 'SEND_HIGH_PRIORITY',
  LOW_LATENCY_DATA: 'SEND_NO_ACK',
  DATA_WITH_ACK: 'SEND_WITH_ACK',
});

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
module.exports = class DroneCommand {
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
    this._timeout = command.$.timeout || 'POP';

    this._mapArguments();
  }

  /**
   * The project id
   * @returns {number} - project id
   */
  get projectId() {
    return this._projectId;
  }

  /**
   * The project name (minidrone, common, etc)
   * @returns {string} - project name
   */
  get projectName() {
    return this._projectName;
  }

  /**
   * The class id
   * @returns {number} - class id
   */
  get classId() {
    return this._classId;
  }

  /**
   * The class name
   * @returns {string} - class name
   */
  get className() {
    return this._className;
  }

  /**
   * The command id
   * @returns {number} - command id
   */
  get commandId() {
    return this._commandId;
  }

  /**
   * The command name
   * @returns {string} - command name
   */
  get commandName() {
    return this._commandName;
  }

  /**
   * Array containing the drone arguments
   * @returns {DroneCommandArgument[]} - arguments
   */
  get arguments() {
    return this._arguments;
  }

  /**
   * Returns if the command has any arguments
   * @returns {boolean} - command has any arguments
   */
  hasArguments() {
    return this.arguments.length > 0;
  }

  /**
   * Get the argument names. These names are also mapped to the instance
   * @returns {string[]} - argument names
   */
  get argumentNames() {
    return this.arguments.map(x => x.name);
  }

  /**
   * Get the command description
   * @returns {string} - command description
   */
  get description() {
    return this._description;
  }

  /**
   * Get if the command has been deprecated
   * @returns {boolean} - deprecated
   */
  get deprecated() {
    return this._deprecated;
  }

  /**
   * Get the send characteristic uuid based on the buffer type
   * @returns {string} - uuid as a string
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
   * @returns {DroneCommand} - Cloned instance
   */
  clone() {
    const command = new this.constructor(this._project, this._class, this._command);

    for (let i = 0; i < this.arguments.length; i++) {
      command.arguments[i].value = this.arguments[i].value;
    }

    return command;
  }

  /**
   * Converts the command to it's buffer representation
   * @returns {Buffer} - Command buffer
   * @throws TypeError
   */
  toBuffer() {
    const bufferLength = 6 + this.arguments.reduce((acc, val) => val.getValueSize() + acc, 0);
    const buffer = new Buffer(bufferLength);

    buffer.fill(0);

    buffer.writeUInt16LE(this.bufferFlag, 0);

    // Skip command counter (offset 1) because it's set in DroneConnection::runCommand

    buffer.writeUInt16LE(this.projectId, 2);
    buffer.writeUInt16LE(this.classId, 3);
    buffer.writeUInt16LE(this.commandId, 4); // two bytes

    let bufferOffset = 6;

    for (const arg of this.arguments) {
      const valueSize = arg.getValueSize();

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
   * @returns {void}
   * @private
   */
  _mapArguments() {
    for (const arg of this.arguments) {
      const init = {
        enumerable: false,
        get: () => arg,
        set: v => {
          arg.value = v;
        },
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
   * @example
   * const str = command.toString(true);
   *
   * str === 'minidrone PilotingSettingsState PreferredPilotingModeChanged (enum)mode="medium"(1)';
   */
  toString(debug = false) {
    const argStr = this.arguments.map(x => x.toString(debug)).join(' ').trim();

    return `${this.getToken()} ${argStr}`.trim();
  }

  /**
   * Get the command buffer type
   * @returns {string} - Buffer type
   */
  get bufferType() {
    return this._buffer.toUpperCase();
  }

  /**
   * Get the command buffer flag based on it's type
   * @returns {number} - Buffer flag
   */
  get bufferFlag() {
    return bufferType[this.bufferType];
  }

  /**
   * Indicates the required action to be taken in case the command times out
   * The value of this attribute can be either POP, RETRY or FLUSH, defaulting to POP
   * @returns {string} - Action name
   */
  get timeoutAction() {
    return this._timeout;
  }

  /**
   * Get the token representation of the command. This
   * is useful for registering sensors for example
   * @returns {string} - Command token
   * @example
   * const backFlip = parser.getCommand('minidrone', 'Animations', 'Flip', {direction: 'back'});
   *
   * backFlip.getToken() === 'minidrone-Animations-Flip';
   */
  getToken() {
    return [this.projectName, this.className, this.commandName].join('-');
  }
};
