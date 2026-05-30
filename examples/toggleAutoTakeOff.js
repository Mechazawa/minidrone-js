const { CommandParser, WifiConnector } = require('minidrone-js');
const Logger = require('winston');

Logger.level = 'debug';

const parser = new CommandParser();
const drone = new WifiConnector();

drone.connect();

const autoTakeOffOn = parser.getCommand('minidrone', 'Piloting', 'AutoTakeOffMode', { state: 1 });
const autoTakeOffOff = parser.getCommand('minidrone', 'Piloting', 'AutoTakeOffMode', { state: 0 });
const allState = parser.getCommand('common', 'Common', 'AllStates');

function sleep(ms) {
  return new Promise(a => setTimeout(a, ms));
}

drone.on('connected', async () => {
  await sleep(200);

  await drone.sendCommand(allState);

  await drone.sendCommand(autoTakeOffOn);

  await sleep(2000);

  await drone.sendCommand(autoTakeOffOff);

  Logger.debug('values: ');

  for (const command of Object.values(drone._sensorStore)) {
    Logger.debug(command.toString(true));
  }

  while (true) {
    await sleep(2000);

    drone.sendCommand(allState);
  }
  // process.exit();
});
