const { test } = require('node:test');
const assert = require('node:assert');

// winston may complain about having no transports configured; that's harmless
// noise in this context, so silence it to keep the test output clean.
require('winston').clear();

// Require the specific module (not ../src) so we never pull in BLEConnector ->
// @abandonware/noble. WifiConnector loads fine without mdns: mdns is required
// lazily inside connect() only when auto-discovery is used.
const WifiConnector = require('../src/connectors/WifiConnector');
const { bufferType } = require('../src/BufferEnums');

// Yield one macrotask tick. WifiConnector.sendCommand awaits write(buffer)
// BEFORE registering the ack callback, so we must let the microtask/macrotask
// queue drain before the callback exists in _commandCallback.
const tick = () => new Promise(resolve => setImmediate(resolve));

// Build a connector wired up with an in-memory stub socket. No real network is
// touched: client.send() simply records the buffer it was handed and reports
// success via the node-style callback.
function makeConnector() {
  const c = new WifiConnector();

  c.parser.warmup();

  const sent = [];

  c.ip = '1.2.3.4';
  c.port = 44444;
  c.client = {
    send: (buf, off, len, port, ip, cb) => {
      sent.push(buf);
      cb(null);
    },
  };

  return { c, sent };
}

test('sendCommand writes exactly one framed packet with a correct header', async () => {
  const { c, sent } = makeConnector();
  const command = c.parser.getCommand('minidrone', 'Piloting', 'TakeOff');

  assert.strictEqual(command.shouldAck, true, 'sanity: TakeOff is a command that should be acked');

  // Kick off the send. The returned promise only settles once the ack arrives,
  // so we deliberately do not await it here.
  const sendPromise = command && c.sendCommand(command);

  // Swallow the eventual rejection if this test ends before an ack is delivered
  // (it won't be in this test) so the process doesn't get an unhandled rejection.
  sendPromise.catch(() => {});

  // write() runs synchronously enough that the frame is recorded immediately.
  assert.strictEqual(sent.length, 1, 'sendCommand should write exactly one frame');

  const frame = sent[0];

  assert.strictEqual(frame[0], command.bufferFlag, 'frame[0] should be the command bufferFlag');
  assert.strictEqual(frame[1], command.bufferId, 'frame[1] should be the command bufferId');
  assert.strictEqual(frame[2], 0, 'frame[2] should be the first packetId (0)');
  assert.strictEqual(
    frame.readUInt32LE(3),
    frame.length,
    'frame[3..6] should be the LE uint32 total frame length'
  );

  // The ack callback is only registered AFTER the awaited write resolves.
  await tick();

  assert.ok(
    c._commandCallback[command.bufferId] && c._commandCallback[command.bufferId][0],
    'after a tick the ack callback for packetId 0 should be registered'
  );

  // Resolve the dangling send by delivering the matching ack so no timer leaks.
  const ack = Buffer.alloc(8);

  ack.writeUInt8(bufferType.ACK, 0);
  ack.writeUInt8(command.bufferId + 128, 1);
  ack.writeUInt8(0, 7);
  c._handleIncoming(ack);

  await sendPromise;
});

test('a matching ACK frame resolves the sendCommand promise and clears the callback', async () => {
  const { c } = makeConnector();
  const command = c.parser.getCommand('minidrone', 'Piloting', 'TakeOff');

  const sendPromise = c.sendCommand(command);

  await tick();

  const bufferId = command.bufferId;

  assert.ok(
    c._commandCallback[bufferId] && c._commandCallback[bufferId][0],
    'sanity: the ack callback should exist before the ack is delivered'
  );

  // Craft the ACK frame the drone would send back. _handleIncoming reads the
  // buffer id from byte 1 minus 128, and the packet id from byte 7.
  const ack = Buffer.alloc(8);

  ack.writeUInt8(bufferType.ACK, 0);
  ack.writeUInt8(bufferId + 128, 1);
  ack.writeUInt8(0, 7); // packetId

  c._handleIncoming(ack);

  // The promise should now resolve without timing out.
  await sendPromise;

  assert.strictEqual(
    c._commandCallback[bufferId][0],
    undefined,
    'the resolved ack callback should have been deleted'
  );
});

test('a stray ACK with no registered callback does not throw', () => {
  const { c } = makeConnector();

  // No sendCommand was issued, so there is no callback registered for any
  // packet. Feeding an ack for packet 99 must be a harmless no-op.
  const stray = Buffer.alloc(8);

  stray.writeUInt8(bufferType.ACK, 0);
  stray.writeUInt8(11 + 128, 1); // some plausible bufferId
  stray.writeUInt8(99, 7); // packetId with no callback

  assert.doesNotThrow(
    () => c._handleIncoming(stray),
    'a stray/unmatched ACK should not throw'
  );
});

test('an incoming DATA frame is parsed, emitted on sensor:* and stored', async () => {
  const { c } = makeConnector();

  // A real sensor reading payload (battery at 73%).
  const sensor = c.parser.getCommand('common', 'CommonState', 'BatteryStateChanged', { percent: 73 });
  const payload = sensor.toBuffer();

  // 7-byte network header followed by the command payload.
  const header = Buffer.alloc(7);

  header.writeUInt8(bufferType.DATA, 0);
  header.writeUInt8(126, 1); // NO_ACK_DRONE_DATA bufferId (value is irrelevant for DATA parsing)
  header.writeUInt8(1, 2); // sequence number
  header.writeUInt32LE(7 + payload.length, 3); // total frame size

  const frame = Buffer.concat([header, payload]);

  const received = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('sensor:* was never emitted')), 1000);

    c.once('sensor:*', emitted => {
      clearTimeout(timer);
      resolve(emitted);
    });

    c._handleIncoming(frame);
  });

  assert.strictEqual(
    received.getToken(),
    'common-CommonState-BatteryStateChanged',
    'sensor:* should emit the parsed battery command'
  );
  assert.strictEqual(received.percent.value, 73, 'emitted sensor should carry the parsed arg value');

  // The sensor store should now serve the same reading back via getSensor().
  const stored = c.getSensor('common', 'CommonState', 'BatteryStateChanged');

  assert.ok(stored, 'getSensor should return the stored reading');
  assert.strictEqual(
    stored.getToken(),
    'common-CommonState-BatteryStateChanged',
    'getSensor token should match'
  );
  assert.strictEqual(stored.percent.value, 73, 'getSensor should expose the parsed arg value');
});

test('a DATA_WITH_ACK frame writes an ACK back and still parses the payload', async () => {
  const { c, sent } = makeConnector();

  const sensor = c.parser.getCommand('common', 'CommonState', 'BatteryStateChanged', { percent: 73 });
  const payload = sensor.toBuffer();

  const header = Buffer.alloc(7);

  header.writeUInt8(bufferType.DATA_WITH_ACK, 0);
  header.writeUInt8(127, 1); // ACK_DRONE_DATA bufferId
  header.writeUInt8(5, 2); // sequence number echoed back into the ack
  header.writeUInt32LE(7 + payload.length, 3);

  const frame = Buffer.concat([header, payload]);

  const received = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('sensor:* was never emitted')), 1000);

    c.once('sensor:*', emitted => {
      clearTimeout(timer);
      resolve(emitted);
    });

    c._handleIncoming(frame);
  });

  // An ACK frame must have been written back to the drone.
  assert.strictEqual(sent.length, 1, 'a DATA_WITH_ACK frame should trigger one ACK write back');
  assert.strictEqual(
    sent[0][0],
    bufferType.ACK,
    'the written-back frame should be an ACK frame'
  );

  // ...and the payload should still fall through to be parsed and emitted.
  assert.strictEqual(
    received.getToken(),
    'common-CommonState-BatteryStateChanged',
    'DATA_WITH_ACK should still emit the parsed payload (fall-through)'
  );
  assert.strictEqual(received.percent.value, 73, 'fall-through payload should carry the parsed value');
});

test('connected getter reflects the socket/browser state', () => {
  const c = new WifiConnector();

  // Fresh connector: nothing is set up yet.
  assert.strictEqual(Boolean(c.connected), false, 'a fresh connector should not be connected');

  // While an mDNS browser is active we are not yet "connected".
  c.browser = {};
  assert.strictEqual(Boolean(c.connected), false, 'an active browser means not-yet-connected');

  // Both server and client present, no browser => connected.
  delete c.browser;
  c.server = {};
  c.client = {};
  assert.ok(c.connected, 'with server+client and no browser the connector is connected');
});

test('connect() with no args rejects when the optional mdns dependency is missing', async () => {
  const Module = require('module');
  const originalLoad = Module._load;

  // Simulate mdns being uninstalled for the duration of this one call only.
  Module._load = function patchedLoad(request, ...rest) {
    if (request === 'mdns') {
      const err = new Error("Cannot find module 'mdns'");

      err.code = 'MODULE_NOT_FOUND';

      throw err;
    }

    return originalLoad.call(this, request, ...rest);
  };

  try {
    const c = new WifiConnector();

    await assert.rejects(
      () => c.connect(),
      err => {
        assert.ok(err instanceof Error, 'rejection reason should be an Error');
        assert.match(err.message, /mdns/i, 'the error should mention the missing mdns dependency');

        return true;
      },
      'connect() should reject when mdns cannot be loaded'
    );
  } finally {
    Module._load = originalLoad;
  }
});
