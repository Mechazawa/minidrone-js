const dualShock = require('dualshock-controller');
const { WifiConnector, CommandParser } = require('minidrone-js');

const controller = dualShock({ config: 'dualShock4-alternate-driver' });
const parser = new CommandParser();
const drone = new WifiConnector();
const takeoff = parser.getCommand('minidrone', 'Piloting', 'TakeOff');
const landing = parser.getCommand('minidrone', 'Piloting', 'Landing');
const flatTrim = parser.getCommand('minidrone', 'Piloting', 'FlatTrim');
const takePicture = parser.getCommand('minidrone', 'MediaRecord', 'PictureV2');
const fireGun = parser.getCommand('minidrone', 'UsbAccessory', 'GunControl', { id: 0, action: 'FIRE' });
const clawOpen = parser.getCommand('minidrone', 'UsbAccessory', 'ClawControl', { id: 0, action: 'OPEN' });
const clawClose = parser.getCommand('minidrone', 'UsbAccessory', 'ClawControl', { id: 0, action: 'CLOSE' });
const allState = parser.getCommand('common', 'Common', 'AllStates');
const autoTakeOff = parser.getCommand('minidrone', 'Piloting', 'AutoTakeOffMode', { state: 1 });

let startTime;
let flightParams = {
  roll: 0, pitch: 0, yaw: 0, gaz: 0, flag: true,
};

function setFlightParams(data) {
  flightParams = Object.assign({}, flightParams, data);
}


function writeFlightParams() {
  if (typeof startTime === 'undefined') {
    startTime = Date.now();
  }

  const params = Object.assign({}, flightParams, {
    timestamp: Date.now() - startTime,
  });

  const command = parser.getCommand('minidrone', 'Piloting', 'PCMD', params);

  drone.sendCommand(command);
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
  console.log('Registering controller');

  setInterval(writeFlightParams, 100); // Event loop

  // Bind controls
  controller.on('connected', () => console.log('Controller connected!'));
  controller.on('disconnecting', () => {
    console.log('Controller disconnected!');
    setFlightParams({
      roll: 0, pitch: 0, yaw: 0, gaz: -10,
    });
  });

  controller.on('circle:press', () => {
    console.log(Object.values(drone._sensorStore).map(x => x.toString()).join('\n'));
    drone.sendCommand(allState);
  });
  controller.on('x:press', () => drone.sendCommand(takeoff));
  controller.on('square:press', () => drone.sendCommand(landing));
  controller.on('triangle:press', () => drone.sendCommand(autoTakeOff));

  controller.on('right:move', data => setFlightParams({
    yaw: joyToFlightParam(data.x),
    gaz: -joyToFlightParam(data.y),
  }));
  controller.on('left:move', data => setFlightParams({
    roll: joyToFlightParam(data.x),
    pitch: -joyToFlightParam(data.y),
  }));
});

drone.connect();
