const { test } = require('node:test');
const assert = require('node:assert');

// winston may complain about having no transports configured; that's harmless
// noise in this context, so silence it to keep the test output clean.
require('winston').clear();

const CommandParser = require('../src/CommandParser');
const DroneCommand = require('../src/DroneCommand');
const { bufferType } = require('../src/BufferEnums');

// A single warmed-up parser instance shared across the tests. warmup() pre-loads
// the xml definitions so getCommand()/parseBuffer() work without lazy surprises.
const parser = new CommandParser();
parser.warmup();

test('getCommand returns a DroneCommand with the expected token', () => {
  const cmd = parser.getCommand('minidrone', 'Piloting', 'TakeOff');

  assert.ok(cmd instanceof DroneCommand, 'getCommand should return a DroneCommand instance');
  assert.strictEqual(
    cmd.getToken(),
    'minidrone-Piloting-TakeOff',
    'getToken() should join project-class-command'
  );
});

test('parseBuffer round-trips a command with arguments, preserving the value', () => {
  const original = parser.getCommand('common', 'CommonState', 'BatteryStateChanged', { percent: 73 });

  assert.strictEqual(
    original.getToken(),
    'common-CommonState-BatteryStateChanged',
    'sanity: original token'
  );
  assert.strictEqual(original.percent.value, 73, 'argument should be set on the original command');

  const parsed = parser.parseBuffer(original.toBuffer());

  assert.ok(parsed instanceof DroneCommand, 'parseBuffer should return a DroneCommand');
  assert.strictEqual(
    parsed.getToken(),
    original.getToken(),
    'parsed token should match the original token after a buffer round-trip'
  );
  assert.strictEqual(
    parsed.percent.value,
    73,
    'parsed argument value should be preserved through the round-trip'
  );
});

test('clone() returns a distinct instance with the same token', () => {
  const cmd = parser.getCommand('minidrone', 'Piloting', 'TakeOff');
  const cloned = cmd.clone();

  assert.notStrictEqual(cloned, cmd, 'clone() should produce a different instance');
  assert.ok(cloned instanceof DroneCommand, 'clone() should still be a DroneCommand');
  assert.strictEqual(
    cloned.getToken(),
    cmd.getToken(),
    'clone() should preserve the command token'
  );
});

test('there is no copy() method (only clone())', () => {
  const cmd = parser.getCommand('minidrone', 'Piloting', 'TakeOff');

  assert.strictEqual(typeof cmd.copy, 'undefined', 'DroneCommand should not expose a copy() method');
  assert.strictEqual(typeof cmd.clone, 'function', 'clone() should be the way to duplicate a command');
});

test('type getters are coherent', () => {
  const cmd = parser.getCommand('minidrone', 'Piloting', 'TakeOff');

  // bufferType is a string and is a known enum key
  assert.strictEqual(typeof cmd.bufferType, 'string', 'bufferType should be a string');
  assert.ok(
    bufferType.hasKey(cmd.bufferType),
    `bufferType "${cmd.bufferType}" should be a known buffer type`
  );

  // bufferFlag is a number equal to the enum value for that buffer type
  assert.strictEqual(typeof cmd.bufferFlag, 'number', 'bufferFlag should be a number');
  assert.strictEqual(
    cmd.bufferFlag,
    bufferType[cmd.bufferType],
    'bufferFlag should equal the bufferType enum value'
  );

  // shouldAck is a boolean
  assert.strictEqual(typeof cmd.shouldAck, 'boolean', 'shouldAck should be a boolean');

  // sendCharacteristicUuid is a 4-char hex-ish string
  assert.strictEqual(
    typeof cmd.sendCharacteristicUuid,
    'string',
    'sendCharacteristicUuid should be a string'
  );
  assert.match(
    cmd.sendCharacteristicUuid,
    /^[0-9a-f]{4}$/i,
    'sendCharacteristicUuid should be a 4-char hex-ish string'
  );
});
