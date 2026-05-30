const Enum = require('./util/Enum');

// the following characteristic UUID segments come from the documentation at
// http://forum.developer.parrot.com/t/minidrone-characteristics-uuid/4686/3
// the 4th bytes are used to identify the characteristic
// the usage of the channels are also documented here
// http://forum.developer.parrot.com/t/ble-characteristics-of-minidrones/5912/2

/**
 * Send characteristsic UUIDs
 *
 * @property {string} SEND_NO_ACK - not-ack commands (PCMD only)
 * @property {string} SEND_WITH_ACK - ack commands (all piloting commands)
 * @property {string} SEND_HIGH_PRIORITY - emergency commands
 * @property {string} ACK_COMMAND - ack for data sent on 0e
 *
 * @type {Enum}
 */
const sendUuids = new Enum({
  SEND_NO_ACK: 'fa0a', // not-ack commands (PCMD only)
  SEND_WITH_ACK: 'fa0b', // ack commands (all piloting commands)
  SEND_HIGH_PRIORITY: 'fa0c', // emergency commands
  ACK_COMMAND: 'fa1e', // ack for data sent on 0e
});

/**
 * Receive characteristsic UUIDs
 *
 * @property {string} ACK_DRONE_DATA - drone data that needs an ack (needs to be ack on 1e)
 * @property {string} NO_ACK_DRONE_DATA - data from drone (including battery and others), no ack
 * @property {string} ACK_COMMAND_SENT - ack 0b channel, SEND_WITH_ACK
 * @property {string} ACK_HIGH_PRIORITY - ack 0c channel, SEND_HIGH_PRIORITY
 *
 * @type {Enum}
 */
const receiveUuids = new Enum({
  ACK_DRONE_DATA: 'fb0e', // drone data that needs an ack (needs to be ack on 1e)
  NO_ACK_DRONE_DATA: 'fb0f', // data from drone (including battery and others), no ack
  ACK_COMMAND_SENT: 'fb1b', // ack 0b channel, SEND_WITH_ACK
  ACK_HIGH_PRIORITY: 'fb1c', // ack 0c channel, SEND_HIGH_PRIORITY
});

/**
 * Receive and send characteristsic UUIDs
 *
 * @property {string} ACK_DRONE_DATA - drone data that needs an ack (needs to be ack on 1e)
 * @property {string} NO_ACK_DRONE_DATA - data from drone (including battery and others), no ack
 * @property {string} ACK_COMMAND_SENT - ack 0b channel, SEND_WITH_ACK
 * @property {string} ACK_HIGH_PRIORITY - ack 0c channel, SEND_HIGH_PRIORITY
 * @property {string} SEND_NO_ACK - not-ack commands (PCMD only)
 * @property {string} SEND_WITH_ACK - ack commands (all piloting commands)
 * @property {string} SEND_HIGH_PRIORITY - emergency commands
 * @property {string} ACK_COMMAND - ack for data sent on 0e
 *
 * @type {Enum}
 */
const characteristicUuids = new Enum(Object.assign({}, sendUuids, receiveUuids));

/**
 * @see http://forum.developer.parrot.com/t/minidrone-characteristics-uuid/4686/3
 */
const serviceUuids = new Enum({
  ARCOMMAND_SENDING_SERVICE: 'fa',
  ARCOMMAND_RECEIVING_SERVICE: 'fb',
  PERFORMANCE_COUNTER_SERVICE: 'fc',
  NORMAL_BLE_FTP_SERVICE: 'fd21',
  UPDATE_BLE_FTP: 'fd51',
  UPDATE_RFCOMM_SERVICE: 'fe00',
  DeviceInfo: '1800',
  unknown: '1801',
});

/**
 * @see http://forum.developer.parrot.com/t/minidrone-characteristics-uuid/4686/3
 */
const handshakeUuids = [
  'fb0f', 'fb0e', 'fb1b', 'fb1c',
  'fd22', 'fd23', 'fd24', 'fd52',
  'fd53', 'fd54',
];

module.exports = {
  sendUuids,
  receiveUuids,
  serviceUuids,
  handshakeUuids,
  characteristicUuids,
};
