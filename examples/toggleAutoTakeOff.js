const { DroneConnection, CommandParser } = require('../src');
const Logger = require('winston');

Logger.level = 'debug';

const parser = new CommandParser();
const drone = new DroneConnection();

const autoTakeOffOn = parser.getCommand('minidrone', 'Piloting', 'AutoTakeOffMode', { state: 1 });
const autoTakeOffOff = parser.getCommand('minidrone', 'Piloting', 'AutoTakeOffMode', { state: 0 });

function sleep(ms) {
  return new Promise(a => setTimeout(a, ms));
}

drone.on('connected', async () => {
  await drone.runCommand(autoTakeOffOff);
  Logger.debug('Command got ACK\'d');

  await sleep(2000);

  await drone.runCommand(autoTakeOffOn);
  Logger.debug('Command got ACK\'d');

  await sleep(2000);

  await drone.runCommand(autoTakeOffOff);
  Logger.debug('Command got ACK\'d');

  process.exit();
});
