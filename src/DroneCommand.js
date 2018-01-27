const MD_DATA_TYPES = {
  ACK: 0x01,
  DATA: 0x02,
  LLD: 0x03,
  DATA_WITH_ACK: 0x04,
};

const stepStore = {};

function getStep(id) {
  if (typeof stepStore[id] === 'undefined') {
    stepStore[id] = 0;
  }

  return stepStore[id]++ & 0xFF;
}

export default class DroneCommand {
  constructor(projectId, classId, commandId, description, arguments_ = []) {
    this._projectId = Number(projectId);
    this._classId = Number(classId);
    this._commandId = Number(commandId);
    this._description = String(description);
    this._arguments = arguments_.map(Number);
  }

  get projectId() {
    return this._projectId;
  }

  get classId() {
    return this._classId;
  }

  get commandId() {
    return this._commandId;
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

  clone() {
    const clonedArguments = this.arguments.map(x => x.clone());

    return new this.constructor(this.projectId, this.classId, this.commandId, this.description, clonedArguments);
  }

  toBuffer() {
    // @todo
  }
}
