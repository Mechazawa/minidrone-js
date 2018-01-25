export default class DroneCommand {
  constructor(projectId, classId, commandId, enumId = null) {
    this._projectId = +projectId;
    this._classId = +classId;
    this._commandId = +commandId;
    this._enumId = enumId === null ? null : +enumId;
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

  get enumId() {
    return this._enumId;
  }

  get hasEnum() {
    return ![null, -1].includes(this.enumId);
  }

  clone() {
    return new this.constructor(this.projectId, this.classId, this.commandId, this.enumId);
  }
}
