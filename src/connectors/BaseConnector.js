const EventEmitter = require('events');
const CommandParser = require('../CommandParser');
const Logger = require('winston');

/**
 * Base drone connector
 *
 * @fires BaseConnector#connected
 * @fires BaseConnector#disconnected
 * @fires BaseConnector#sensor:
 * @fires BaseConnector#incoming
 *
 * @abstract
 */
class BaseConnector extends EventEmitter {
  constructor() {
    super();

    this._stepStore = {};
    this._parser = new CommandParser();
    this._commandCallback = {};
    this._sensorStore = {};

    this.on('incoming', command => this.setSensor(command));
    this.on('incoming', command => Logger.debug(`RECV ${command.bufferType}:`, command.toString()));
  }

  /**
   * Accessor for getting the {@link CommandParser} instance
   * @returns {CommandParser} - {@link CommandParser} instance
   */
  get parser() {
    return this._parser;
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
        const timeout = setTimeout(reject, 5 * 1000, new Error('Command timed out after 5 seconds'));

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

  /**
   * Get the most recent sensor reading
   *
   * @param {string} project - Project name
   * @param {string} class_ - Class name
   * @param {string} command - Command name
   * @returns {DroneCommand|undefined} - {@link DroneCommand} instance or {@link undefined} if no sensor reading could be found
   * @see {@link https://github.com/Parrot-Developers/arsdk-xml/blob/master/xml/}
   */
  getSensor(project, class_, command) {
    const token = [project, class_, command].join('-');

    return this.getSensorFromToken(token);
  }

  /**
   * Get the most recent sensor reading using the sensor token
   *
   * @param {string} token - Command token
   * @returns {DroneCommand|undefined} - {@link DroneCommand} instance or {@link undefined} if no sensor reading could be found
   * @see {@link https://github.com/Parrot-Developers/arsdk-xml/blob/master/xml/}
   * @see {@link DroneCommand.getToken}
   */
  getSensorFromToken(token) {
    let command = this._sensorStore[token];

    if (command) {
      return command.clone();
    }
  }

  setSensor(command) {
    const token = command.getToken();

    this._sensorStore[token] = command;

    Logger.debug('EMIT: sensor:' + token);

    /**
     * Fires when a new sensor reading has been received
     *
     * @event DroneConnection#sensor:
     * @type {DroneCommand} - The sensor reading
     * @example
     * connection.on('sensor:minidrone-UsbAccessoryState-GunState', function(sensor) {
     *  if (sensor.state.value === sensor.state.enum.READY) {
     *    console.log('The gun is ready to fire!');
     *  }
     * });
     */
    this.emit('sensor:' + token, command);
    this.emit('sensor:*', command);
  }

  /**
   * @returns {boolean} If the drone is connected
   * @abstract
   */
  get connected() {
    return false;
  }

  /**
   * Connect to the drone
   * @returns {Promise} - Resolves when the connection has been established
   * @async
   * @abstract
   */
  connect() {
    throw new Error('Abstract class');
  }
}

module.exports = BaseConnector;
