require('winston').level = 'debug';

const {DroneConnection, CommandParser} = require('./dist/bundle');

const connection = new DroneConnection();
const parser = new CommandParser();
console.log(parser)

connection.on('connected', () => {
  connection.runCommand(takeoff);

  setTimeout(() => connection.runCommand(doAFlip), 3000);
  setTimeout(() => connection.runCommand(landing), 6000);
});

const takeoff = parser.getCommand('minidrone', 'Piloting', 'TakeOff');
const landing = parser.getCommand('minidrone', 'Piloting', 'Landing');
console.log(landing.toString())
const doAFlip = parser.getCommand('minidrone', 'Animations', 'Flip', {direction: 'back'});

// const testData = [
//   [0x02, 0x0c, 0x02, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04],
//   [0x02, 0x0d, 0x02, 0x0f, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04],
//   [0x02, 0x0e, 0x02, 0x0f, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04],
//   [0x02, 0x0f, 0x02, 0x13, 0x02, 0x00, 0x01, 0x00, 0x00, 0x00],
//   [0x02, 0x10, 0x02, 0x03, 0x03, 0x00, 0x00],
//   [0x02, 0x11, 0x00, 0x05, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01],
//   [0x02, 0x05, 0x02, 0x12, 0x00, 0x00, 0xef, 0x11, 0x02, 0x3f, 0x33, 0xd2, 0x7d, 0xbf, 0xb4, 0xff, 0x00, 0x00, 0x00, 0x00],
//   [0x02, 0x12, 0x00, 0x05, 0x08, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01],
//   [0x02, 0x06, 0x02, 0x12, 0x01, 0x00, 0xb9, 0xcb, 0x6f, 0xbc, 0x10, 0xe7, 0x32, 0x3c, 0x2a, 0x9b, 0x91, 0xbd, 0xff, 0x53],
// ];
//
// for (const row of testData) {
//   const command = parser.getCommandFromBuffer(new Buffer(row));
//   console.log(command.toString());
// }
