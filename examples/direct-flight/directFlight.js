const Controller = require('./controller');
require('winston').level = 'debug';
const {DroneConnection, CommandParser} = require('../../dist/bundle');


const parser = new CommandParser();
const drone = new DroneConnection();
const takeoff = parser.getCommand('minidrone', 'Piloting', 'TakeOff');
const landing = parser.getCommand('minidrone', 'Piloting', 'Landing');
const takePicture = parser.getCommand('minidrone', 'MediaRecord', 'PictureV2');

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
  if(paramsChanged(flightParams, oldParams)) {
    const command = parser.getCommand('minidrone', 'Piloting', 'PCMD', flightParams);
    drone.runCommand(command);
  }
}

drone.on('connected', () => {
  setInterval(writeFlightParams, 50);
});

const controller = new Controller({
  onStartPress: () => drone.runCommand(takeoff),
  onBackPress: () => drone.runCommand(landing),

  // onLeftTriggerMove: () => drone.flipRight(),
  // onLeftshoulderPress: () => drone.flipRight(),
  // onRightshoulderPress: () => drone.flipFront(),
  // onRightTriggerMove: () => drone.flipBack(),

  // onLeftstickPress: () => drone.emergency(),
  // onRightstickPress: () => drone.emergency(),

  onXPress: () => drone.runCommand(takePicture),
  // onYPress: () => drone.trim(),
  // onAPress: () => drone.togglePilotingMode(),

  onRightAnalogMove: data => {
    setFlightParams({roll: data.x, pitch: data.y});
  },

  onLeftAnalogMove: data => {
    setFlightParams({yaw: data.x, gaz: data.y});
  },
});
