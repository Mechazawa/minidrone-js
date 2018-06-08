const EventEmitter = require('events');
const CommandParser = require('../CommandParser');
const Logger = require('winston');

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

  /**
   * Set the ack callback (if needed) for a command.
   * Should be called directly after sending it. It will log the sending of the command.
   * @param {DroneCommand} command - Sent command
   * @param {number} packetId - Packet id
   * @returns {Promise} - Resolves when the command has been acknowledged (if needed)
   * @protected
   * @async
   */
  _setAckCallback(command, packetId) {
    const bufferId = command.bufferId;

    return new Promise((_accept, reject) => {
      if (command.shouldAck) {
        if (!this._commandCallback[bufferId]) {
          this._commandCallback[bufferId] = {};
        }

        // For if the command times out
        const timeout = setTimeout(reject, 10 * 1000, new Error('Command timed out after 10 seconds'));

        const accept = () => {
          clearTimeout(timeout);

          _accept(...arguments);
        };

        this._commandCallback[bufferId][packetId] = { accept, reject };
      }

      Logger.debug(`SENT ${command.bufferType}[${packetId}]: `, command.toString());

      if (!command.shouldAck) {
        _accept();
      }
    });
  }
}

module.exports = BaseConnector;
