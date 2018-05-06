const EventEmitter = require('events');
const CommandParser = require('../CommandParser');

/**
 * Drone connection class
 *
 * Exposes an api for controlling the drone
 *
 * @fires DroneCommand#connected
 * @fires DroneCommand#disconnected
 * @fires DroneCommand#sensor:
 * @property {CommandParser} parser - {@link CommandParser} instance
 */
module.exports = class AbstractDroneConnector extends EventEmitter {
  /**
   * Creates a new DroneConnection instance
   * @param {object} options - Instance options
   * @param {boolean} [options.warmup=true] - Warmup the command parser
   */
  constructor(options = {}) {
    super();

    this.parser = new CommandParser();

    if (options.warmup !== false) {
      // We'll do it for you so you don't have to
      this.parser.warmup();
    }
  }

  /**
   * @returns {boolean} If the drone is connected
   */
  get connected() {
    throw new Error('Abstract method not implemented');
  }

  /**
   * Send a command to the drone and execute it
   * @param {DroneCommand} command - Command instance to be ran
   */
  runCommand(command) {
    throw new Error('Abstract method not implemented');
  }

  /**
   * Update the sensor
   *
   * @param {Buffer} buffer - Buffer containing just the command info
   * @param {boolean} ack - If an acknowledgement for receiving the data should be sent
   * @private
   * @fires DroneConnection#sensor:
   * @todo implement ack
   */
  _updateSensors(buffer, ack = false) {
    if (buffer[0] === 0) {
      return;
    }

    try {
      const command = this.parser.parseBuffer(buffer);
      const token = [command.projectName, command.className, command.commandName].join('-');

      this._sensorStore[token] = command;

      Logger.debug('RECV:', command.toString());

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
    } catch (e) {
      Logger.warn('Unable to parse packet:', buffer);
      Logger.warn(e);
    }
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
      command = command.copy();
    }

    return command;
  }
};
