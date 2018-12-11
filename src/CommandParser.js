const { parseString } = require('xml2js');
const DroneCommand = require('./DroneCommand');
const Logger = require('winston');
const InvalidCommandError = require('./InvalidCommandError');
const fs = require('fs');
const path = require('path');
const resolve = require('resolve');

/**
 * Command parser used for looking up commands in the xml definition
 */
class CommandParser {
  /**
   * CommandParser constructor
   */
  constructor() {
    if (typeof CommandParser._fileCache === 'undefined') {
      CommandParser._fileCache = {};
    }

    this._commandCache = {};
  }

  /**
   * Get an xml file and convert it to json
   * @param {string} name - Project name
   * @returns {Object} - Parsed Xml data using xml2js
   * @private
   */
  _getJson(name) {
    const file = this._getXml(name);

    if (typeof file === 'undefined') {
      throw new Error(`Xml file ${name} could not be found`);
    }

    if (typeof CommandParser._fileCache[name] === 'undefined') {
      CommandParser._fileCache[name] = null;

      parseString(file, { async: false }, (e, result) => {
        CommandParser._fileCache[name] = result;
      });

      return this._getJson(name);
    } else if (CommandParser._fileCache[name] === null) {
      // Fuck javascript async hipster shit
      return this._getJson(name);
    }

    return CommandParser._fileCache[name];
  }

  /**
   * Get a command based on it's path in the xml definition
   * @param {string} projectName - The xml file name (project name)
   * @param {string} className - The command class name
   * @param {string} commandName - The command name
   * @param {Object?} commandArguments - Optional command arguments
   * @returns {DroneCommand} - Target command
   * @throws InvalidCommandError
   * @see {@link https://github.com/Parrot-Developers/arsdk-xml/blob/master/xml/}
   * @example
   * const parser = new CommandParser();
   * const backFlip = parser.getCommand('minidrone', 'Animations', 'Flip', {direction: 'back'});
   */
  getCommand(projectName, className, commandName, commandArguments = {}) {
    const cacheToken = [projectName, className, commandName].join('-');

    if (typeof this._commandCache[cacheToken] === 'undefined') {
      // Find project
      const project = this._getJson(projectName).project;

      this._assertElementExists(project, 'project', projectName);

      const context = [projectName];

      // Find class
      const targetClass = project.class.find(v => v.$.name === className);

      this._assertElementExists(targetClass, 'class', className);

      context.push(className);

      // Find command
      const targetCommand = targetClass.cmd.find(v => v.$.name === commandName);

      this._assertElementExists(targetCommand, 'command', commandName);

      const result = new DroneCommand(project, targetClass, targetCommand);

      this._commandCache[cacheToken] = result;

      if (result.deprecated) {
        Logger.warn(`${result.toString()} has been deprecated`);
      }
    }

    const target = this._commandCache[cacheToken].clone();

    for (const arg of Object.keys(commandArguments)) {
      if (target.hasArgument(arg)) {
        target[arg] = commandArguments[arg];
      }
    }

    return target;
  }

  /**
   * Gets the command by analysing the buffer
   * @param {Buffer} buffer - Command buffer without leading 2 bytes
   * @returns {DroneCommand} - Buffer's related DroneCommand
   * @private
   */
  _getCommandFromBuffer(buffer) {
    // https://github.com/algolia/pdrone/commit/43cc0c4150297dab97d0f0bc119b8bd551da268f#comments
    buffer = buffer.readUInt8(0) > 0x80 ? buffer.slice(1) : buffer;

    const projectId = buffer.readUInt8(0);
    const classId = buffer.readUInt8(1);
    const commandId = buffer.readUInt8(2);

    const cacheToken = [projectId, classId, commandId].join('-');

    // Build command if needed
    if (typeof this._commandCache[cacheToken] === 'undefined') {
      // Find project
      const project = CommandParser._files
        .map(x => this._getJson(x).project)
        .filter(x => typeof x !== 'undefined')
        .find(x => Number(x.$.id) === projectId);

      this._assertElementExists(project, 'project', projectId);

      // find class
      const targetClass = project.class.find(x => Number(x.$.id) === classId);

      const context = [project.$.name];

      this._assertElementExists(targetClass, 'class', classId, context);

      // find command
      const targetCommand = targetClass.cmd.find(x => Number(x.$.id) === commandId);

      context.push(targetClass.$.name);

      this._assertElementExists(targetCommand, 'command', commandId, context);

      // Build command and store it
      this._commandCache[cacheToken] = new DroneCommand(project, targetClass, targetCommand);
    }

    return this._commandCache[cacheToken].clone();
  }

  /**
   * Parse the input buffer and get the correct command with parameters
   * Used internally to parse sensor data
   * @param {Buffer} buffer - The command buffer without the first two bytes
   * @returns {DroneCommand} - Parsed drone command
   * @throws InvalidCommandError
   * @throws TypeError
   */
  parseBuffer(buffer) {
    const command = this._getCommandFromBuffer(buffer);

    let bufferOffset = 4;

    for (const arg of command.arguments) {
      let valueSize = arg.getValueSize();
      let value = 0;

      switch (arg.type) {
        case 'u8':
        case 'u16':
        case 'u32':
        case 'u64':
          value = buffer.readUIntLE(bufferOffset, valueSize);
          break;
        case 'i8':
        case 'i16':
        case 'i32':
        case 'i64':
          value = buffer.readIntLE(bufferOffset, valueSize);
          break;
        case 'enum':
          // @todo figure out why I have to do this
          value = buffer.readIntLE(bufferOffset + 1, valueSize - 1);
          break;
        // eslint-disable-next-line no-case-declarations
        case 'string':
          value = '';
          let c = ''; // Last character

          for (valueSize = 0; valueSize < buffer.length && c !== '\0'; valueSize++) {
            c = String.fromCharCode(buffer[bufferOffset + valueSize]);

            value += c;
          }
          break;
        case 'float':
          value = buffer.readFloatLE(bufferOffset);
          break;
        case 'double':
          value = buffer.readDoubleLE(bufferOffset);
          break;
        default:
          throw new TypeError(`Can't parse buffer: unknown data type "${arg.type}" for argument "${arg.name}" in ${command.getToken()}`);
      }

      arg.value = value;

      bufferOffset += valueSize;
    }

    return command;
  }

  /**
   * Warn up the parser by pre-fetching the xml files
   * @param {string[]} files - List of files to load in defaults to {@link CommandParser._files}
   * @returns {void}
   *
   */
  warmup(files = this.constructor._files) {
    for (const file of files) {
      this._getJson(file);
    }
  }

  /**
   * Mapping of known xml files
   * @type {string[]} - known xml files
   * @private
   */
  static get _files() {
    if (typeof this.__files === 'undefined') {
      const arsdkXmlPath = CommandParser._arsdkXmlPath;

      const isFile = filePath => fs.lstatSync(filePath).isFile();

      this.__files = fs
        .readdirSync(arsdkXmlPath)
        .map(String)
        .filter(file => file.endsWith('.xml'))
        .filter(file => isFile(path.join(arsdkXmlPath, file)))
        .map(file => file.replace('.xml', ''));

      Logger.debug(`_files list found ${this._files.length} items`);
    }

    return this.__files;
  }

  /**
   * helper method
   * @param {Object|undefined} value - Xml node value
   * @param {string} type - Xml node type
   * @param {string|number} target - Xml node value
   * @param {Array<Object|undefined>} context - Parser context
   * @private
   * @throws InvalidCommandError
   * @returns {void}
   */
  _assertElementExists(value, type, target, context = []) {
    if (typeof value === 'undefined') {
      throw new InvalidCommandError(value, type, target, context);
    }
  }

  /**
   * Reads xml file from ArSDK synchronously without a cache
   * @param {string} name - Xml file name
   * @returns {string} - File contents
   * @private
   */
  _getXml(name) {
    const arsdkXmlPath = CommandParser._arsdkXmlPath;
    const filePath = `${arsdkXmlPath}/${name}.xml`;

    return fs.readFileSync(filePath);
  }

  /**
   * Path of the ArSDK xml directory
   * @returns {string} - Path
   * @private
   */
  static get _arsdkXmlPath() {
    if (typeof this.__arsdkPath === 'undefined') {
      // common.xml is a file we know exists so we can use it to find the xml directory
      this.__arsdkPath = path.dirname(resolve.sync('arsdk-xml/xml/common.xml'));
    }

    return this.__arsdkPath;
  }
}

module.exports = CommandParser;
