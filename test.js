require('winston').level = 'debug';

const {DroneConnection, CommandParser} = require('./dist/bundle');

const connection = new DroneConnection();
const parser = new CommandParser();
console.log(parser)

connection.on('connected', () => {
  connection.runCommand(takeoff);

  setTimeout(() => connection.runCommand(allStates), 1500);
  setTimeout(() => connection.runCommand(landing), 5000);
});

const takeoff = parser.getCommand('minidrone', 'Piloting', 'TakeOff');
const landing = parser.getCommand('minidrone', 'Piloting', 'Landing');
const allStates = parser.getCommand('common', 'Common', 'AllStates');
