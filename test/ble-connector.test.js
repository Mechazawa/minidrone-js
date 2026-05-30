'use strict';

// BLEConnector requires '@abandonware/noble', whose native binding may be absent
// in this environment. Intercept the module loader and hand back a fake before
// requiring BLEConnector so the test never touches real BLE hardware.
const Module = require('module');
const _load = Module._load;
const fakeNoble = {
  on() {},
  once() {},
  removeAllListeners() {},
  state: 'unknown',
  startScanning() {},
  stopScanning() {},
};
Module._load = function (request, ...rest) {
  return request === '@abandonware/noble' ? fakeNoble : _load.call(this, request, ...rest);
};

const BLEConnector = require('../src/connectors/BLEConnector');
const { bufferType } = require('../src/BufferEnums');
const { sendUuids } = require('../src/CharacteristicEnums');

const { test } = require('node:test');
const assert = require('node:assert');

// Silence the harmless "[winston] Attempt to write logs with no transports" noise.
require('winston').clear();

/**
 * Build a fresh connector with a warmed-up parser and a stubbed write() that
 * records every frame instead of touching a noble characteristic.
 * @returns {{ connector: BLEConnector, sent: Array<{buf: Buffer, ch: string}> }}
 */
function makeConnector() {
  const connector = new BLEConnector();

  connector.parser.warmup();

  const sent = [];

  connector.write = (buf, ch) => {
    sent.push({ buf, ch });

    return Promise.resolve();
  };

  return { connector, sent };
}

test('sendCommand writes one frame for an ack command and registers a flat callback', async () => {
  const { connector, sent } = makeConnector();

  const command = connector.parser.getCommand('minidrone', 'Piloting', 'TakeOff');

  assert.strictEqual(command.shouldAck, true, 'TakeOff is expected to require an ack');

  const promise = connector.sendCommand(command);

  // The ack callback is registered synchronously inside the Promise executor,
  // and write() is called right after - so no tick/await is needed here.
  assert.strictEqual(sent.length, 1, 'exactly one frame should have been written');

  const frame = sent[0];

  assert.strictEqual(
    frame.ch,
    command.sendCharacteristicUuid,
    'frame should be written to the command send characteristic',
  );

  assert.strictEqual(
    frame.buf[0],
    command.bufferFlag & 0xFF,
    'first header byte should be the low byte of the buffer flag',
  );
  assert.strictEqual(frame.buf[1], 0, 'second header byte should be packet id 0');

  assert.strictEqual(
    typeof connector._commandCallback[0],
    'function',
    'an ack callback should be registered flat under packet id 0',
  );

  // Resolve the pending ack so the internal 5s timeout is cleared and does not
  // leak past the end of this test as an unhandled rejection.
  connector._handleIncoming(Buffer.from([bufferType.ACK, 0, 0]));

  await promise;
});

test('an ACK frame resolves the sendCommand promise and clears the callback', async () => {
  const { connector } = makeConnector();

  const command = connector.parser.getCommand('minidrone', 'Piloting', 'TakeOff');

  assert.strictEqual(command.shouldAck, true, 'TakeOff is expected to require an ack');

  const promise = connector.sendCommand(command);

  assert.strictEqual(
    typeof connector._commandCallback[0],
    'function',
    'an ack callback should be registered before the ack arrives',
  );

  // Feed an ACK frame: [type, our seq, acked packet id]. Acked packet id is 0.
  connector._handleIncoming(Buffer.from([bufferType.ACK, 0, 0]));

  await promise;

  assert.strictEqual(
    typeof connector._commandCallback[0],
    'undefined',
    'the ack callback should be deleted after the ack resolves it',
  );
});

test('a non-ack command resolves immediately and registers no callback', async () => {
  const { connector, sent } = makeConnector();

  const command = connector.parser.getCommand('minidrone', 'Piloting', 'PCMD');

  assert.strictEqual(command.shouldAck, false, 'PCMD is expected to be fire-and-forget');

  const promise = connector.sendCommand(command);

  // Should resolve without any incoming ack frame.
  await promise;

  assert.strictEqual(sent.length, 1, 'the command frame should still be written');
  assert.strictEqual(
    typeof connector._commandCallback[0],
    'undefined',
    'no ack callback should be registered for a non-ack command',
  );
});

test('_handleIncoming parses a DATA frame and emits the parsed command as incoming', () => {
  const { connector } = makeConnector();

  const source = connector.parser.getCommand('minidrone', 'Piloting', 'TakeOff');
  const payload = source.toBuffer();

  // BLE frame: 2-byte header [type, sequence] followed by the command payload.
  // The first payload byte is the project id (non-zero), so the data[2]===0 skip
  // does not trigger.
  const frame = Buffer.concat([Buffer.from([bufferType.DATA, 1]), payload]);

  let received = null;

  connector.on('incoming', (command) => {
    received = command;
  });

  connector._handleIncoming(frame);

  assert.notStrictEqual(received, null, 'an incoming command should have been emitted');
  assert.strictEqual(
    received.getToken(),
    'minidrone-Piloting-TakeOff',
    'the emitted command should round-trip to the original token',
  );
});

test('_handleIncoming acks a DATA_WITH_ACK frame and still emits incoming', () => {
  const { connector, sent } = makeConnector();

  const source = connector.parser.getCommand('minidrone', 'Piloting', 'TakeOff');
  const payload = source.toBuffer();

  const seq = 7;
  const frame = Buffer.concat([Buffer.from([bufferType.DATA_WITH_ACK, seq]), payload]);

  let received = null;

  connector.on('incoming', (command) => {
    received = command;
  });

  connector._handleIncoming(frame);

  const ackFrame = sent.find(entry => entry.ch === sendUuids.ACK_COMMAND);

  assert.ok(ackFrame, 'an ack frame should be written to the ACK_COMMAND characteristic');
  assert.strictEqual(ackFrame.buf[0], bufferType.ACK, 'the ack frame type byte should be ACK');
  assert.strictEqual(ackFrame.buf[2], seq, 'the ack frame should echo the acknowledged sequence');

  // Fall-through: a DATA_WITH_ACK frame is still parsed and emitted as incoming.
  assert.notStrictEqual(received, null, 'an incoming command should still be emitted');
  assert.strictEqual(
    received.getToken(),
    'minidrone-Piloting-TakeOff',
    'the emitted command should round-trip to the original token',
  );
});

test('the package index exports the public connector and command surface', () => {
  // The noble mock is still active, so requiring the index (which pulls in
  // BLEConnector) is safe.
  const index = require('../src');

  assert.strictEqual(typeof index.DroneCommand, 'function', 'DroneCommand should be exported');
  assert.strictEqual(typeof index.DroneConnection, 'function', 'DroneConnection should be exported');
  assert.strictEqual(typeof index.BaseConnector, 'function', 'BaseConnector should be exported');
  assert.strictEqual(typeof index.BLEConnector, 'function', 'BLEConnector should be exported');
  assert.strictEqual(typeof index.WifiConnector, 'function', 'WifiConnector should be exported');
  assert.strictEqual(typeof index.CommandParser, 'function', 'CommandParser should be exported');
});

// Restore the original module loader so the interception does not leak into
// other test files sharing the process.
test('restore the module loader', () => {
  Module._load = _load;

  assert.strictEqual(Module._load, _load, 'the original module loader should be restored');
});
