const {DroneConnection, CommandParser, BLEConnector} = require('../src');

const connector = new BLEConnector();
const parser = new CommandParser();
const drone = new DroneConnection(connector);
const takeoff = parser.getCommand('minidrone', 'Piloting', 'TakeOff');
const landing = parser.getCommand('minidrone', 'Piloting', 'Landing');
const backFlip = parser.getCommand('minidrone', 'Animations', 'Flip', {direction: 'back'});

connector.connect();

drone.on('connected', () => {
  // Makes the code a bit clearer
  const runCommand = x => drone.runCommand(x);

  runCommand(takeoff);

  setTimeout(runCommand, 2000, backFlip);
  setTimeout(runCommand, 4000, landing);
  setTimeout(process.exit, 5000);
});
