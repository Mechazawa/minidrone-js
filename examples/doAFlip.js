const {DroneConnection, CommandParser} = require('minidrone-js');

const parser = new CommandParser();
const drone = new DroneConnection();
const takeoff = parser.getCommand('minidrone', 'Piloting', 'TakeOff');
const landing = parser.getCommand('minidrone', 'Piloting', 'Landing');
const backFlip = parser.getCommand('minidrone', 'Animations', 'Flip', {direction: 'back'});


drone.on('connected', () => {
  console.log('Connected!')

  // Makes the code a bit clearer
  const runCommand = x => drone.runCommand(x);

  // runCommand(takeoff);

  // setTimeout(runCommand, 2000, backFlip);
  // setTimeout(runCommand, 2000, landing);
  setTimeout(process.exit, 5000);
});
