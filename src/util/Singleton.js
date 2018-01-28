export default class Singleton {
  constructor() {
    if (!this.constructor.instance) {
      this.constructor.instance = this;
      this._instanceCount = 0;
    }

    this._instanceCount++;

    return this.constructor.instance;
  }
}
