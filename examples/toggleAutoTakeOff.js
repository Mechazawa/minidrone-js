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
  await drone.runCommand(allState);

  await drone.runCommand(autoTakeOffOn);

  await sleep(2000);

  await drone.runCommand(autoTakeOffOff);

  Logger.debug('values: ');

  for (const command of Object.values(drone._sensorStore)) {
    Logger.debug(command.toString(true));
  }

  process.exit();
});
