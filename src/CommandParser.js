import Singleton from './util/Singleton';
import {parseString} from 'xml2js';
import DroneCommand from './DroneCommand';


export default class CommandParser extends Singleton {
  constructor() {
    super();

    if (typeof this._fileCache === 'undefined') {
      this._fileCache = {};
    }

    if (typeof this._commandCache === 'undefined') {
      this._commandCache = {};
    }
  }

  _getXml(name) {
    const file = CommandParser._fileMapping[name];

    if (typeof file === 'undefined') {
      throw new Error(`Xml file ${name} could not be found`);
    }

    if (typeof this._fileCache[name] === 'undefined') {
      this._fileCache[name] = null;

      parseString(file, {async: false}, (e, result) => {
        this._fileCache[name] = result;
      });

      return this._getXml(name);
    } else if (this._fileCache[name] === null) {
      // Fuck javascript async hipster shit
      return this._getXml(name);
    }

    return this._fileCache[name];
  }

  static get _fileMapping() {
    return {
      minidrone: require('arsdk-xml/xml/minidrone.xml'),
      common: require('arsdk-xml/xml/common.xml'),
    };
  }

  getCommand(projectName, className, commandName, enumName = null) {
    const cacheToken = [
      projectName, className,
      commandName, enumName || '',
    ].join('-');

    if (typeof this._commandCache[cacheToken] !== 'undefined') {
      return this._commandCache[cacheToken].clone();
    }

    const project = this._getXml(projectName).project;

    // Values to be extracted
    let projectId, classId, commandId, enumId = null;

    projectId = project.$.id;

    const targetClass = project.class.find(v => v.$.name === className);

    classId = targetClass.$.id;

    const targetCommand = targetClass.cmd.find(v => v.$.name === commandName);

    commandId = targetCommand.$.id;

    if (enumName !== null) {
      const argsWithEnum = targetCommand.arg.filter(x => x.$.type === 'enum');

      for (const arg of argsWithEnum) {
        enumId = arg.enum.findIndex(v => v.$.name === enumName);

        if (enumId !== -1) {
          break;
        }
      }
    }

    this._commandCache[cacheToken] = new DroneCommand(projectId, classId, commandId, [enumId]);

    return this._commandCache[cacheToken].clone();
  }

  warmup() {
    const names = CommandParser._fileMapping.keys();

    for (const name in names) {
      this._getXml(name);
    }
  }
}
