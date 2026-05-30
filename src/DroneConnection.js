const EventEmitter = require('events');
const Logger = require('winston');

/**
 * Drone connection class
 *
 * Wraps a {@link BaseConnector} (BLE or Wifi) and exposes an api for controlling the drone.
 * All transport specific logic lives in the connector; this class only forwards its events
 * and delegates command/sensor calls to it.
 *
 * @fires DroneConnection#connected
 * @fires DroneConnection#disconnected
 * @fires DroneConnection#error
 * @fires DroneConnection#sensor:
 * @property {BaseConnector} connector - The underlying drone connector
 */
class DroneConnection extends EventEmitter {
  /**
   * Creates a new DroneConnection instance
   * @param {BaseConnector} connector - The drone connector to use (BLE, Wifi)
   * @param {boolean} [warmup=true] - Warmup the command parser
   */
  constructor(connector, warmup = true) {
    super();

    this.connector = connector;

    // Forward the connector's lifecycle events on the connection instance
    this.connector.on('connected', () => this.emit('connected'));
    this.connector.on('disconnected', () => this.emit('disconnected'));
    this.connector.on('error', err => this.emit('error', err));

    // Re-emit sensor readings received by the connector
    this.connector.on('sensor:*', command => {
      this.emit('sensor:' + command.getToken(), command);
      this.emit('sensor:*', command);
    });

    if (warmup) {
      // We'll do it for you so you don't have to
      this.parser.warmup();
    }
  }

  /**
   * Accessor for the {@link CommandParser} instance owned by the connector
   * @returns {CommandParser} - {@link CommandParser} instance
   */
  get parser() {
    return this.connector.parser;
  }

  /**
   * @returns {boolean} If the drone is connected
   */
  get connected() {
    return this.connector.connected;
  }

  /**
   * Send a command to the drone and execute it
   * @param {DroneCommand} command - Command instance to be ran
   * @returns {Promise} - Resolves when the command has been received (if ack is required)
   * @async
   */
  runCommand(command) {
    return this.connector.sendCommand(command);
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
    return this.connector.getSensor(project, class_, command);
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
    return this.connector.getSensorFromToken(token);
  }

  /**
   * Get the logger level
   * @returns {string|number} - logger level
   * @see {@link https://github.com/winstonjs/winston}
   */
  get logLevel() {
    return Logger.level;
  }

  /**
   * Set the logger level
   * @param {string|number} value - logger level
   * @see {@link https://github.com/winstonjs/winston}
   */
  set logLevel(value) {
    Logger.level = typeof value === 'number' ? value : value.toString();
  }
}

module.exports = DroneConnection;
