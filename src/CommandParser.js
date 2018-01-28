import {parseString} from 'xml2js';
import DroneCommand from './DroneCommand';
import Logger from 'winston';


const _fileCache = {};
const _commandCache = {};

export default class CommandParser {
  _getXml(name) {
    const file = CommandParser._fileMapping[name];

    if (typeof file === 'undefined') {
      throw new Error(`Xml file ${name} could not be found`);
    }

    if (typeof _fileCache[name] === 'undefined') {
      _fileCache[name] = null;

      parseString(file, {async: false}, (e, result) => {
        _fileCache[name] = result;
      });

      return this._getXml(name);
    } else if (_fileCache[name] === null) {
      // Fuck javascript async hipster shit
      return this._getXml(name);
    }

    return _fileCache[name];
  }

  static get _fileMapping() {
    return {
      minidrone: require('arsdk-xml/xml/minidrone.xml'),
      common: require('arsdk-xml/xml/common.xml'),
    };
  }

  static get _files() {
    return Object.keys(CommandParser._fileMapping);
  }

  getCommand(projectName, className, commandName, commandArguments = {}) {
    const cacheToken = [
      projectName, className,
      commandName,
    ].join('-');

    if (typeof _commandCache[cacheToken] === 'undefined') {
      const project = this._getXml(projectName).project;

      const targetClass = project.class.find(v => v.$.name === className);

      const targetCommand = targetClass.cmd.find(v => v.$.name === commandName);

      const result = new DroneCommand(project, targetClass, targetCommand);

      _commandCache[cacheToken] = result;

      if (result.deprecated === 'true') {
        Logger.warn(`${result.toString()} has been deprecated`);
      }
    }

    const target = _commandCache[cacheToken].clone();

    for(const arg of Object.keys(commandArguments)) {
      if (target.hasArgument(arg)) {
        target[arg] = commandArguments[arg];
      }
    }

    return target;
  }

  getCommandFromBuffer(buffer) {
    const projectId = buffer.readUInt8(0);
    const classId = buffer.readUInt8(1);
    const commandId = buffer.readUInt8(2);

    const cacheToken = [projectId, classId, commandId].join('-');

    if (typeof _commandCache[cacheToken] === 'undefined') {
      const project = CommandParser._files
        .map(x => this._getXml(x).project)
        .find(x => Number(x.$.id) === projectId);

      const targetClass = project.class.find(x => Number(x.$.id) === classId);

      const targetCommand = targetClass.cmd.find(x => Number(x.$.id) === commandId);

      _commandCache[cacheToken] = new DroneCommand(project, targetClass, targetCommand);
    }

    const command = _commandCache[cacheToken].clone();

    let bufferOffset = 3;

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
        case 'enum':
          value = buffer.readIntLE(bufferOffset + 1, valueSize - 1);
          break;
        case 'string':
          value = '';
          let c = ''; // Last character

          for (valueSize = 0; valueSize < buffer.length && c !== '\0'; valueSize++) {
            c = String.fromCharCode(buffer[bufferOffset]);

            value += c;
          }
          break;
        case 'float':
          value = buffer.readFloatLE(bufferOffset);
          break;
        case 'double':
          value = buffer.readDoubleLE(bufferOffset);
          break;
      }

      arg.value = value;

      bufferOffset += valueSize;
    }

    return command;
  }

  warmup() {
    for (const name in CommandParser._files) {
      this._getXml(name);
    }
  }
}
