const Enum = require('./util/Enum');

// the following characteristic UUID segments come from the documentation at
// http://forum.developer.parrot.com/t/minidrone-characteristics-uuid/4686/3
// the 4th bytes are used to identify the characteristic
// the usage of the channels are also documented here
// http://forum.developer.parrot.com/t/ble-characteristics-of-minidrones/5912/2

const characteristicSendUuids = new Enum({
  SEND_NO_ACK: '0a', // not-ack commands (PCMD only)
  SEND_WITH_ACK: '0b', // ack commands (all piloting commands)
  SEND_HIGH_PRIORITY: '0c', // emergency commands
  ACK_COMMAND: '1e', // ack for data sent on 0e
});

const characteristicReceiveUuids = new Enum({
  ACK_DRONE_DATA: '0e', // drone data that needs an ack (needs to be ack on 1e)
  NO_ACK_DRONE_DATA: '0f', // data from drone (including battery and others), no ack
  ACK_COMMAND_SENT: '1b', // ack 0b channel, SEND_WITH_ACK
  ACK_HIGH_PRIORITY: '1c', // ack 0c channel, SEND_HIGH_PRIORITY
});

module.exports = {
  characteristicSendUuids,
  characteristicReceiveUuids,
};
