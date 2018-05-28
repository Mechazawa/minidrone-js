const Enum = require('./util/Enum');

/**
 * Buffer types
 *
 * @property {number} ACK - Acknowledgment of previously received data
 * @property {number} DATA - Normal data (no ack requested)
 * @property {number} NON_ACK - Same as DATA
 * @property {number} HIGH_PRIO - Not sure about this one could be LLD
 * @property {number} LOW_LATENCY_DATA - Treated as normal data on the network, but are given higher priority internally
 * @property {number} DATA_WITH_ACK - Data requesting an ack. The receiver must send an ack for this data unit!
 *
 * @type {Enum}
 */
const bufferType = new Enum({
  ACK: 0x01,
  DATA: 0x02,
  NON_ACK: 0x02,
  HIGH_PRIO: 0x02,
  LOW_LATENCY_DATA: 0x03,
  DATA_WITH_ACK: 0x04,
});

/**
 * Maps buffer types against characteristics for BLE
 *
 * @type {Enum}
 */
const bufferCharacteristicTranslationMap = new Enum({
  ACK: 'ACK_COMMAND',
  DATA: 'SEND_NO_ACK',
  NON_ACK: 'SEND_NO_ACK',
  HIGH_PRIO: 'SEND_HIGH_PRIORITY',
  LOW_LATENCY_DATA: 'SEND_NO_ACK',
  DATA_WITH_ACK: 'SEND_WITH_ACK',
});

module.exports = {
  bufferType,
  bufferCharacteristicTranslationMap,
};
