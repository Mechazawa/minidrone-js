// Regression test over real captured drone packets (migrated from the old root test.js,
// which only printed them). Each row is a raw BLE notification; the first two bytes are the
// device id and message counter, so the command frame is row.slice(2).
require('winston').clear();

const { test } = require('node:test');
const assert = require('node:assert');
const CommandParser = require('../src/CommandParser');

const parser = new CommandParser();

parser.warmup();

// [ raw bytes, expected token ] — tokens captured from the current parser.
const FIXTURES = [
  [[0x02, 0x0c, 0x02, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04], 'minidrone-UsbAccessoryState-LightState'],
  [[0x02, 0x0d, 0x02, 0x0f, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04], 'minidrone-UsbAccessoryState-ClawState'],
  [[0x02, 0x0e, 0x02, 0x0f, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04], 'minidrone-UsbAccessoryState-GunState'],
  [[0x02, 0x0f, 0x02, 0x13, 0x02, 0x00, 0x01, 0x00, 0x00, 0x00], 'minidrone-MinicamState-StateChanged'],
  [[0x02, 0x10, 0x02, 0x03, 0x03, 0x00, 0x00], 'minidrone-PilotingState-AutoTakeOffModeChanged'],
  [[0x02, 0x11, 0x00, 0x05, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01], 'common-CommonState-SensorsStatesListChanged'],
  [[0x02, 0x05, 0x02, 0x12, 0x00, 0x00, 0xef, 0x11, 0x02, 0x3f, 0x33, 0xd2, 0x7d, 0xbf, 0xb4, 0xff, 0x00, 0x00, 0x00, 0x00], 'minidrone-NavigationDataState-DronePosition'],
  [[0x02, 0x12, 0x00, 0x05, 0x08, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01], 'common-CommonState-SensorsStatesListChanged'],
  [[0x02, 0x06, 0x02, 0x12, 0x01, 0x41, 0x55, 0xeb, 0x85, 0xbc, 0x10, 0xe7, 0x32, 0x3c, 0x2a, 0x9b, 0x91, 0xbd, 0xff, 0x53], 'minidrone-NavigationDataState-DroneSpeed'],
];

for (const [row, expectedToken] of FIXTURES) {
  test(`parses captured packet -> ${expectedToken}`, () => {
    const frame = Buffer.from(row.slice(2)); // drop device id + message counter
    let command;

    assert.doesNotThrow(() => { command = parser.parseBuffer(frame); }, `parseBuffer threw for ${expectedToken}`);
    assert.strictEqual(command.getToken(), expectedToken);
  });
}

test('DroneSpeed packet exposes a numeric speed_x argument', () => {
  const row = FIXTURES[FIXTURES.length - 1][0];
  const command = parser.parseBuffer(Buffer.from(row.slice(2)));

  assert.strictEqual(typeof command.speed_x.value, 'number');
});
