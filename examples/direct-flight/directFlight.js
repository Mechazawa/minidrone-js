const dualShock = require('dualshock-controller');
require('winston').level = 'debug';
const {DroneConnection, CommandParser} = require('../../dist/bundle');

const controller = dualShock({config: 'dualShock4-alternate-driver'});
const parser = new CommandParser();
const drone = new DroneConnection();
const takeoff = parser.getCommand('minidrone', 'Piloting', 'TakeOff');
const landing = parser.getCommand('minidrone', 'Piloting', 'Landing');
const takePicture = parser.getCommand('minidrone', 'MediaRecord', 'PictureV2');
const fireGun = parser.getCommand('minidrone', 'UsbAccessory', 'GunControl', {id: 0, action: 'FIRE'});
const clawOpen = parser.getCommand('minidrone', 'UsbAccessory', 'ClawControl', {id: 0, action: 'OPEN'});
const clawClose = parser.getCommand('minidrone', 'UsbAccessory', 'ClawControl', {id: 0, action: 'CLOSE'});

function paramsChanged(a, b) {
  for (const key of Object.keys(a)) {
    if (b[key] !== a[key]) {
      return true;
    }
  }

  return false;
}

let oldParams = {};
let flightParams = {
  roll: 0, pitch: 0, yaw: 0, gaz: 0, flag: true,
};

function setFlightParams(data) {
  oldParams = flightParams;
  flightParams = Object.assign({}, flightParams, data);
}

function writeFlightParams() {
  const command = parser.getCommand('minidrone', 'Piloting', 'PCMD', flightParams);
  drone.runCommand(command);
}

function joyToFlightParam(value) {
  const deadZone = 10; // both ways
  const center = 255 / 2;

  if (value > center - deadZone && value < center + deadZone) {
    return 0;
  }

  return (value / center) * 100 - 100;
}

drone.on('connected', () => {
  setInterval(writeFlightParams, 100); // Event loop
});

controller.on('connected', () => console.log('Controller connected!'));
controller.on('disconnecting', () => {
  console.log('Controller disconnected!');
  setFlightParams({
    roll: 0, pitch: 0, yaw: 0, gaz: -10,
  });
});

controller.on('x:press', () => drone.runCommand(clawClose));
controller.on('circle:press', () => drone.runCommand(clawOpen));
controller.on('triangle:press', () => drone.runCommand(takeoff));
controller.on('square:press', () => drone.runCommand(landing));

controller.on('right:move', data => setFlightParams({yaw: joyToFlightParam(data.x), gaz: -joyToFlightParam(data.y)}));
controller.on('left:move', data => setFlightParams({roll: joyToFlightParam(data.x), pitch: -joyToFlightParam(data.y)}));

