const EventEmitter = require('events');
const CommandParser = require('../CommandParser');

class BaseConnector extends EventEmitter {
  constructor() {
    super();

    this._stepStore = {};
    this.parser = new CommandParser();
    this._commandCallback = {};
  }

  /**
   * used to count the drone command steps
   * @param {string} id - Step store id
   * @returns {number} - step number
   */
  _getStep(id) {
    if (typeof this._stepStore[id] === 'undefined') {
      this._stepStore[id] = 0;
    }

    const out = this._stepStore[id];

    this._stepStore[id]++;
    this._stepStore[id] &= 0xFF;

    return out;
  }
}

module.exports = BaseConnector;
