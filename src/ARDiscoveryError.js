const Enum = require('./util/Enum');

/**
 * @type Enum
 *
 * @property {number} OK - No error
 * @property {number} ERROR - Unknown generic error
 * @property {number} ERROR_SIMPLE_POLL - Avahi failed to create simple poll object
 * @property {number} ERROR_BUILD_NAME - Avahi failed to create simple poll object
 * @property {number} ERROR_CLIENT - Avahi failed to create client
 * @property {number} ERROR_CREATE_CONFIG - Failed to create config file
 * @property {number} ERROR_DELETE_CONFIG - Failed to delete config file
 * @property {number} ERROR_ENTRY_GROUP - Avahi failed to create entry group
 * @property {number} ERROR_ADD_SERVICE - Avahi failed to add service
 * @property {number} ERROR_GROUP_COMMIT - Avahi failed to commit group
 * @property {number} ERROR_BROWSER_ALLOC - Avahi failed to allocate desired number of browsers
 * @property {number} ERROR_BROWSER_NEW - Avahi failed to create one browser
 * @property {number} ERROR_ALLOC - Failed to allocate connection resources
 * @property {number} ERROR_INIT - Wrong type to connect as
 * @property {number} ERROR_SOCKET_CREATION - Socket creation error
 * @property {number} ERROR_SOCKET_PERMISSION_DENIED - Socket access permission denied
 * @property {number} ERROR_SOCKET_ALREADY_CONNECTED - Socket is already connected
 * @property {number} ERROR_ACCEPT - Socket accept failed
 * @property {number} ERROR_SEND - Failed to write frame to socket
 * @property {number} ERROR_READ - Failed to read frame from socket
 * @property {number} ERROR_SELECT - Failed to select sets
 * @property {number} ERROR_TIMEOUT - timeout error
 * @property {number} ERROR_ABORT - Aborted by the user
 * @property {number} ERROR_PIPE_INIT - Failed to intitialize a pipe
 * @property {number} ERROR_BAD_PARAMETER - Bad parameters
 * @property {number} ERROR_BUSY - discovery is busy
 * @property {number} ERROR_SOCKET_UNREACHABLE - host or net is not reachable
 * @property {number} ERROR_OUTPUT_LENGTH - the length of the output is to small
 * @property {number} ERROR_JNI - JNI error
 * @property {number} ERROR_JNI_VM - JNI virtual machine, not initialized
 * @property {number} ERROR_JNI_ENV - null JNI environment
 * @property {number} ERROR_JNI_CALLBACK_LISTENER - null jni callback listener
 * @property {number} ERROR_CONNECTION - Connection error
 * @property {number} ERROR_CONNECTION_BUSY - Product already connected
 * @property {number} ERROR_CONNECTION_NOT_READY - Product not ready to connect
 * @property {number} ERROR_CONNECTION_BAD_ID - It is not the good Product
 * @property {number} ERROR_DEVICE - Device generic error
 * @property {number} ERROR_DEVICE_OPERATION_NOT_SUPPORTED - The current device does not support this operation
 * @property {number} ERROR_JSON - Json generic error
 * @property {number} ERROR_JSON_PARSSING - Json parssing error
 * @property {number} ERROR_JSON_BUFFER_SIZE - The size of the buffer storing the Json is too small
 *
 * @see https://github.com/Parrot-Developers/libARDiscovery/blob/master/Includes/libARDiscovery/ARDISCOVERY_Error.h
 */
const ARDiscoveryError = module.exports = new Enum({
  // Do not change these values, they are sent by the device in the Json of connection.
  OK: 0,
  ERROR: -1,
  // End of values sent by the device in the Json of connection.

  ERROR_SIMPLE_POLL: -1000,
  ERROR_BUILD_NAME: -999,
  ERROR_CLIENT: -998,
  ERROR_CREATE_CONFIG: -997,
  ERROR_DELETE_CONFIG: -996,
  ERROR_ENTRY_GROUP: -995,
  ERROR_ADD_SERVICE: -994,
  ERROR_GROUP_COMMIT: -993,
  ERROR_BROWSER_ALLOC: -992,
  ERROR_BROWSER_NEW: -991,

  ERROR_ALLOC: -2000,
  ERROR_INIT: -1999,
  ERROR_SOCKET_CREATION: -1998,
  ERROR_SOCKET_PERMISSION_DENIED: -1997,
  ERROR_SOCKET_ALREADY_CONNECTED: -1996,
  ERROR_ACCEPT: -1995,
  ERROR_SEND: -1994,
  ERROR_READ: -1993,
  ERROR_SELECT: -1992,
  ERROR_TIMEOUT: -1991,
  ERROR_ABORT: -1990,
  ERROR_PIPE_INIT: -1989,
  ERROR_BAD_PARAMETER: -1988,
  ERROR_BUSY: -1987,
  ERROR_SOCKET_UNREACHABLE: -1986,
  ERROR_OUTPUT_LENGTH: -1985,

  ERROR_JNI: -3000,
  ERROR_JNI_VM: -2999,
  ERROR_JNI_ENV: -2998,
  ERROR_JNI_CALLBACK_LISTENER: -2997,

  // Do not change these values, they are sent by the device in the Json of connection.
  ERROR_CONNECTION: -4000,
  ERROR_CONNECTION_BUSY: -3999,
  ERROR_CONNECTION_NOT_READY: -3998,
  ERROR_CONNECTION_BAD_ID: -3997,
  // End of values sent by the device in the Json of connection.

  ERROR_DEVICE: -5000,
  ERROR_DEVICE_OPERATION_NOT_SUPPORTED: -499,

  ERROR_JSON: -6000,
  ERROR_JSON_PARSSING: -5999,
  ERROR_JSON_BUFFER_SIZE: -5998,
});
