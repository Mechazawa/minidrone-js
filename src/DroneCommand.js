import DroneCommandArgument from './DroneCommandArgument';
import Enum from './util/Enum';

export const bufferType = new Enum({
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

function getStep(id) {
  if (typeof stepStore[id] === 'undefined') {
    stepStore[id] = 0;
  }

  const out = stepStore[id];

  stepStore[id] = (stepStore[id] + 1)&0xFF;

  return out;
}

export default class DroneCommand {
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

  get projectId() {
    return this._projectId;
  }

  get projectName() {
    return this._projectName;
  }

  get classId() {
    return this._classId;
  }

  get className() {
    return this._className;
  }

  get commandId() {
    return this._commandId;
  }

  get commandName() {
    return this._commandName;
  }

  get arguments() {
    return this._arguments;
  }

  get hasArguments() {
    return this.arguments.length > 0;
  }

  get description() {
    return this._description;
  }

  get deprecated() {
    return this._deprecated;
  }

  get sendCharacteristicUuid() {
    const t = bufferCharTranslationMap[this.bufferType] || 'SEND_WITH_ACK';

    return 'fa' + characteristicSendUuids[t];
  }

  hasArgument(key) {
    return this.arguments.findIndex(x => x.name === key) !== -1;
  }

  clone() {
    return new this.constructor(this._project, this._class, this._command);
  }

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
          break
      }

      bufferOffset += valueSize;
    }

    return buffer;
  }

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

  toString(debug = false) {
    const argStr = this.arguments.map(x => x.toString(debug)).join(' ').trim();

    return (this.getToken() + ' ' + argStr).trim();
  }

  get bufferType() {
    return this._buffer.toUpperCase();
  }

  get bufferFlag() {
    return bufferType[this.bufferType];
  }

  getToken() {
    return [this.projectName, this.className, this.commandName].join('-');
  }
}
