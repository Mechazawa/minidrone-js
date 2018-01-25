export default class DroneCommand {
  constructor(projectId, classId, commandId, arguments_ = []) {
    this._projectId = Number(projectId);
    this._classId = Number(classId);
    this._commandId = Number(commandId);
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

  clone() {
    return new this.constructor(this.projectId, this.classId, this.commandId, this.arguments);
  }

  encode() {
    return [
      this.projectId,
      this.classId,
      this.commandId,
      ...this.arguments,
    ]
  }
}
