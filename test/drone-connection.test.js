const { test } = require('node:test');
const assert = require('node:assert');
const EventEmitter = require('node:events');

// Silence harmless "Attempt to write logs with no transports" winston noise.
require('winston').clear();

const DroneConnection = require('../src/DroneConnection');
const BaseConnector = require('../src/connectors/BaseConnector');

/**
 * Build a fake connector (no native deps) that satisfies the surface
 * DroneConnection delegates to.
 * @returns {EventEmitter} fake connector
 */
function makeFakeConnector() {
  const fake = new EventEmitter();

  fake.parser = { warmup() {} };
  fake.connected = false;
  fake.sent = undefined;
  fake.sendCommand = command => {
    fake.sent = command;

    return Promise.resolve('ok');
  };
  fake.getSensor = (...a) => ({ a });
  fake.getSensorFromToken = t => ({ t });

  return fake;
}

test('DroneConnection re-emits connected/disconnected/error from the connector', () => {
  const fake = makeFakeConnector();
  const drone = new DroneConnection(fake, false);

  let connectedFired = 0;
  let disconnectedFired = 0;
  let errorPayload = null;

  drone.on('connected', () => connectedFired++);
  drone.on('disconnected', () => disconnectedFired++);
  drone.on('error', err => {
    errorPayload = err;
  });

  fake.emit('connected');
  fake.emit('disconnected');

  const theError = new Error('boom');
  fake.emit('error', theError);

  assert.strictEqual(connectedFired, 1, "drone should re-emit 'connected'");
  assert.strictEqual(disconnectedFired, 1, "drone should re-emit 'disconnected'");
  assert.strictEqual(errorPayload, theError, "drone should re-emit 'error' with the original error payload");
});

test("DroneConnection re-emits 'sensor:*' as both 'sensor:*' and the token-specific event", () => {
  const fake = makeFakeConnector();
  const drone = new DroneConnection(fake, false);

  const command = { getToken: () => 'p-C-N' };

  let wildcardPayload = null;
  let tokenPayload = null;

  drone.on('sensor:*', cmd => {
    wildcardPayload = cmd;
  });
  drone.on('sensor:p-C-N', cmd => {
    tokenPayload = cmd;
  });

  fake.emit('sensor:*', command);

  assert.strictEqual(tokenPayload, command, "drone should emit 'sensor:p-C-N' with the command");
  assert.strictEqual(wildcardPayload, command, "drone should emit 'sensor:*' with the command");
});

test('DroneConnection.runCommand delegates to connector.sendCommand and returns its promise', async () => {
  const fake = makeFakeConnector();
  const drone = new DroneConnection(fake, false);

  const result = drone.runCommand('X');

  assert.ok(result instanceof Promise, 'runCommand should return a Promise');
  assert.strictEqual(await result, 'ok', 'runCommand should resolve with the connector result');
  assert.strictEqual(fake.sent, 'X', 'connector.sendCommand should receive the command');
});

test('DroneConnection.getSensor and getSensorFromToken delegate to the connector', () => {
  const fake = makeFakeConnector();
  const drone = new DroneConnection(fake, false);

  const sensor = drone.getSensor('proj', 'cls', 'cmd');

  assert.deepStrictEqual(sensor, { a: ['proj', 'cls', 'cmd'] }, 'getSensor should forward all arguments to the connector');

  const tokenSensor = drone.getSensorFromToken('tok');

  assert.deepStrictEqual(tokenSensor, { t: 'tok' }, 'getSensorFromToken should forward the token to the connector');
});

test('DroneConnection.parser proxies the connector parser, and connected reflects the connector', () => {
  const fake = makeFakeConnector();
  const drone = new DroneConnection(fake, false);

  assert.strictEqual(drone.parser, fake.parser, 'drone.parser should be the connector parser');

  assert.strictEqual(drone.connected, false, 'drone.connected should reflect connector.connected (false)');

  fake.connected = true;

  assert.strictEqual(drone.connected, true, 'drone.connected should reflect connector.connected (true)');
});

test('DroneConnection warmup=true calls parser.warmup once', () => {
  const fake = makeFakeConnector();

  let warmups = 0;

  fake.parser = { warmup() {
    warmups++;
  } };

  // eslint-disable-next-line no-new
  new DroneConnection(fake, true);

  assert.strictEqual(warmups, 1, 'constructing with warmup=true should call parser.warmup once');
});

/**
 * Concrete BaseConnector subclass for testing the abstract base.
 */
class TestConnector extends BaseConnector {
  get connected() {
    return true;
  }

  connect() {
    return Promise.resolve();
  }
}

test("BaseConnector stores 'incoming' commands and emits the sensor event", () => {
  const connector = new TestConnector();

  const command = {
    getToken: () => 'a-b-c',
    clone: () => ({ cloned: true }),
  };

  let sensorEvent = null;

  connector.on('sensor:a-b-c', cmd => {
    sensorEvent = cmd;
  });

  connector.emit('incoming', command);

  assert.strictEqual(sensorEvent, command, "emitting 'incoming' should emit 'sensor:a-b-c' with the command");

  const fetched = connector.getSensorFromToken('a-b-c');

  assert.deepStrictEqual(fetched, { cloned: true }, 'getSensorFromToken should return the cloned stored command');
});

test('BaseConnector.getSensorFromToken returns undefined for an unknown token', () => {
  const connector = new TestConnector();

  assert.strictEqual(connector.getSensorFromToken('missing'), undefined, 'unknown token should yield undefined');
});

test('BaseConnector._setAckCallback resolves immediately for a non-ack command', async () => {
  const connector = new TestConnector();

  const command = {
    shouldAck: false,
    bufferId: 1,
    bufferType: 'DATA',
    toString: () => '',
  };

  // Should resolve (no value) without registering a callback.
  await connector._setAckCallback(command, 5);

  assert.strictEqual(
    connector._commandCallback[1],
    undefined,
    'a non-ack command should not register a command callback'
  );
});

test('BaseConnector._setAckCallback registers an accept callback that forwards its argument', async () => {
  const connector = new TestConnector();

  const command = {
    shouldAck: true,
    bufferId: 2,
    bufferType: 'DATA_WITH_ACK',
    toString: () => '',
  };

  const promise = connector._setAckCallback(command, 7);

  const entry = connector._commandCallback[2] && connector._commandCallback[2][7];

  assert.ok(entry, 'an ack command should register _commandCallback[2][7]');
  assert.strictEqual(typeof entry.accept, 'function', 'the registered entry should expose an accept function');
  assert.strictEqual(typeof entry.reject, 'function', 'the registered entry should expose a reject function');

  // Verify the (...args) forwarding: calling accept with an arg resolves the promise with that arg.
  entry.accept('resolved-value');

  assert.strictEqual(
    await promise,
    'resolved-value',
    'accept(arg) should resolve the ack promise with the forwarded argument'
  );
});
