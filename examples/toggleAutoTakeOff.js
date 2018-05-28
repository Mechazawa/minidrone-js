const { DroneConnection, CommandParser, WifiConnector, BLEConnector } = require('../src');
const Logger = require('winston');

Logger.level = 'debug';

const parser = new CommandParser();
const connector = new WifiConnector();
const drone = new DroneConnection(connector);
connector.connect();

const autoTakeOffOn = parser.getCommand('minidrone', 'Piloting', 'AutoTakeOffMode', { state: 1 });
const autoTakeOffOff = parser.getCommand('minidrone', 'Piloting', 'AutoTakeOffMode', { state: 0 });
const allState = parser.getCommand('common', 'Common', 'AllStates');

function sleep(ms) {
  return new Promise(a => setTimeout(a, ms));
}

drone.on('connected', async () => {
  await sleep(200);
  drone.runCommand(allState);

  await sleep(1000);

  await drone.runCommand(autoTakeOffOn);
  Logger.debug('Command got ACK\'d');

  await sleep(2000);

  await drone.runCommand(autoTakeOffOn);
  Logger.debug('Command got ACK\'d');

  await sleep(2000);

  await drone.runCommand(autoTakeOffOff);
  Logger.debug('Command got ACK\'d');

  process.exit();
});
