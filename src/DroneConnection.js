const EventEmitter = require('events');
const Logger = require('winston');
const CommandParser = require('./CommandParser');
const { bufferType } = require('./BufferEnums');

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
class DroneConnection extends EventEmitter {
  /**
   * Creates a new DroneConnection instance
   * @param {BLEConnector} connector - The drone connector to use (BLE, Wifi)
   * @param {boolean} [warmup=true] - Warmup the command parser
   */
  constructor(connector, warmup = true) {
    super();

    this._commandCallback = {};
    this._sensorStore = {};

    this.connector = connector;

    this.connector.on('disconnect', () => this.emit('disconnect'));
    this.connector.on('connected', () => this.emit('connected'));
    this.connector.on('data', data => this._handleIncoming(data));
    this.connector.on('incoming', command => {
      // @todo move code

      this._sensorStore[command.getToken()] = command;
    });

    this.parser = new CommandParser();

    if (warmup) {
      // We'll do it for you so you don't have to
      this.parser.warmup();
    }
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
   * Handles incoming data from the drone
   * @param {string} channelUuid - The channel uuid
   * @param {Buffer} buffer - The packet data
   * @private
   */
  _handleIncoming(buffer) {
    const type = bufferType.findForValue(buffer.readUInt8(0));


    if (type !== 'ACK') {
      this._updateSensors(buffer);
    } else {
      // @todo figure out why two ACK's in a row are received
      const packetId = buffer.readUInt8(2);
      const callback = this._commandCallback[packetId];

      if (typeof callback === 'function') {
        Logger.debug(`ACK_*: packet id ${packetId}`);

        delete this._commandCallback[packetId];

        callback();
      } else {
        Logger.debug(`ACK_*: packet id ${packetId}, no callback  :(`);
      }
    }
  }

  /**
   * Update the sensor
   *
   * @param {Buffer} buffer - Command buffer
   * @private
   * @fires DroneConnection#sensor:
   */
  _updateSensors(buffer) {
    if (buffer[2] === 0) {
      return;
    }

    try {
      const command = this.parser.parseBuffer(buffer.slice(2));
      const token = [command.projectName, command.className, command.commandName].join('-');

      this._sensorStore[token] = command;

      Logger.debug(`RECV ${command.bufferType}:`, command.toString());

      if (command.shouldAck) {
        // @todo ack
      }

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
}

module.exports = DroneConnection;
