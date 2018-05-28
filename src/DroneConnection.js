const EventEmitter = require('events');
const Logger = require('winston');
const Enum = require('./util/Enum');
const CommandParser = require('./CommandParser');
const { characteristicSendUuids, characteristicReceiveUuids } = require('./CharacteristicEnums');
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
    this._stepStore = {};

    this.connector = connector;

    this.connector.on('disconnect', () => this.emit('disconnect'));
    this.connector.on('connected', () => this.emit('connected'));
    this.connector.on('data', data => this._handleIncoming(data));

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
    const buffer = command.toBuffer();
    const packetId = this._getStep(command.bufferFlag);

    buffer.writeUIntLE(packetId, 1, 1);

    return new Promise(accept => {
      Logger.debug(`SEND ${command.bufferType}[${packetId}]: `, command.toString());

      if (command.shouldAck) {
        this._commandCallback[packetId] = accept;
      } else {
        accept();
      }
      this.connector.write(buffer, command.sendCharacteristicUuid);
    });
  }

  /**
   * Handles incoming data from the drone
   * @param {string} channelUuid - The channel uuid
   * @param {Buffer} buffer - The packet data
   * @private
   */
  _handleIncoming(buffer) {
    const characteristic = bufferType.findForValue(buffer.readUInt8(0));

    Logger.debug(buffer);

    if (characteristic !== 'ACK') {
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
        const packetId = buffer.readUInt8(1);

        this.ack(packetId);
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

  /**
   * used to count the drone command steps
   * @param {string} id - Step store id
   * @returns {number} - step number
   * @todo steps should be grouped on bufferType (see bufferType enum)
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
   * Acknowledge a packet
   * @param {number} packetId - Id of the packet to ack
   */
  ack(packetId) {
    Logger.debug('SEND ACK: packet id ' + packetId);

    const buffer = new Buffer(3);

    buffer.writeUIntLE(bufferType.ACK, 0, 1);
    buffer.writeUIntLE(this._getStep(bufferType.ACK), 1, 1);
    buffer.writeUIntLE(packetId, 2, 1);

    this.connector.write(buffer, characteristicSendUuids.ACK_COMMAND);
  }
}

module.exports = DroneConnection;
