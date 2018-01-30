const {DroneConnection, CommandParser} = require('../dist/bundle');

const parser = new CommandParser();
const drone = new DroneConnection();
const takeoff = parser.getCommand('minidrone', 'Piloting', 'TakeOff');
const landing = parser.getCommand('minidrone', 'Piloting', 'Landing');
const backFlip = parser.getCommand('minidrone', 'Animations', 'Flip', {direction: 'back'});

drone.on('connected', () => {
  drone.runCommand(takeoff)

  setTimeout(drone.runCommand.bind(drone), 2000, backFlip)
  setTimeout(drone.runCommand.bind(drone), 4000, landing)
  setTimeout(process.exit, 5000)
});
