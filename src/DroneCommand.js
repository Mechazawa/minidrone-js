import DroneCommandArgument from './DroneCommandArgument';
import Enum from './util/Enum';

export const BufferType = new Enum({
  ACK: 0x01, // Acknowledgment of previously received data
  DATA: 0x02, // Normal data (no ack requested)
  NON_ACK: 0x02, // Same as DATA
  LOW_LATENCY_DATA: 0x03, // Treated as normal data on the network, but are given higher priority internally
  DATA_WITH_ACK: 0x04, // Data requesting an ack. The receiver must send an ack for this data unit!
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
    this._buffer = command.$.buffer || 'NON_ACK';

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
          buffer.writeUIntLE(arg.value, bufferOffset, valueSize);
          break;
        case 'i8':
        case 'i16':
        case 'i32':
        case 'i64':
        case 'enum':
          buffer.writeIntLE(arg.value, bufferOffset, valueSize);
          break;
        case 'string':
          valueSize++;
          buffer.write(arg.value + '\0', bufferOffset, valueSize, 'ascii');
          break;
        case 'float':
          buffer.writeFloatLE(arg.value, bufferOffset);
          break;
        case 'double':
          buffer.writeDoubleLE(arg.value, bufferOffset);
          break;
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
      };

      Object.defineProperty(this, arg.name, init);
    }
  }

  toString() {
    const str = `${this.projectName} ${this.className} ${this.commandName}`;
    const argStr = this.arguments.map(x => `${x.name}="${x.value}"`).join(' ').trim();

    return (str + ' ' + argStr).trim();
  }

  get bufferType() {
    return this._buffer.toUpperCase();
  }

  get bufferFlag() {
    return BufferType[this.bufferType];
  }
}
