const Enum = require('./util/Enum');

// @see https://github.com/Parrot-Developers/libARDiscovery/blob/master/Includes/libARDiscovery/ARDISCOVERY_Error.h
module.exports = new Enum({
  // Do not change these values, they are sent by the device in the Json of connection.
  OK: 0, /** < No error */
  ERROR: -1, /** < Unknown generic error */
  // End of values sent by the device in the Json of connection.

  ERROR_SIMPLE_POLL: -1000, /** < Avahi failed to create simple poll object */
  ERROR_BUILD_NAME: -999, /** < Avahi failed to create simple poll object */
  ERROR_CLIENT: -998, /** < Avahi failed to create client */
  ERROR_CREATE_CONFIG: -997, /** < Failed to create config file */
  ERROR_DELETE_CONFIG: -996, /** < Failed to delete config file */
  ERROR_ENTRY_GROUP: -995, /** < Avahi failed to create entry group */
  ERROR_ADD_SERVICE: -994, /** < Avahi failed to add service */
  ERROR_GROUP_COMMIT: -993, /** < Avahi failed to commit group */
  ERROR_BROWSER_ALLOC: -992, /** < Avahi failed to allocate desired number of browsers */
  ERROR_BROWSER_NEW: -991, /** < Avahi failed to create one browser */

  ERROR_ALLOC: -2000, /** < Failed to allocate connection resources */
  ERROR_INIT: -1999, /** < Wrong type to connect as */
  ERROR_SOCKET_CREATION: -1998, /** < Socket creation error */
  ERROR_SOCKET_PERMISSION_DENIED: -1997, /** < Socket access permission denied */
  ERROR_SOCKET_ALREADY_CONNECTED: -1996, /** < Socket is already connected */
  ERROR_ACCEPT: -1995, /** < Socket accept failed */
  ERROR_SEND: -1994, /** < Failed to write frame to socket */
  ERROR_READ: -1993, /** < Failed to read frame from socket */
  ERROR_SELECT: -1992, /** < Failed to select sets */
  ERROR_TIMEOUT: -1991, /** < timeout error */
  ERROR_ABORT: -1990, /** < Aborted by the user*/
  ERROR_PIPE_INIT: -1989, /** < Failed to intitialize a pipe*/
  ERROR_BAD_PARAMETER: -1988, /** < Bad parameters */
  ERROR_BUSY: -1987, /** < discovery is busy*/
  ERROR_SOCKET_UNREACHABLE: -1986, /** < host or net is not reachable */
  ERROR_OUTPUT_LENGTH: -1985, /** < the length of the output is to small */

  ERROR_JNI: -3000, /** < JNI error */
  ERROR_JNI_VM: -2999, /** < JNI virtual machine, not initialized */
  ERROR_JNI_ENV: -2998, /** < null JNI environment  */
  ERROR_JNI_CALLBACK_LISTENER: -2997, /** <  null jni callback listener*/

  // Do not change these values, they are sent by the device in the Json of connection.
  ERROR_CONNECTION: -4000, /** < Connection error */
  ERROR_CONNECTION_BUSY: -3999, /** < Product already connected */
  ERROR_CONNECTION_NOT_READY: -3998, /** < Product not ready to connect */
  ERROR_CONNECTION_BAD_ID: -3997, /** < It is not the good Product */
  // End of values sent by the device in the Json of connection.

  ERROR_DEVICE: -5000, /** < Device generic error */
  ERROR_DEVICE_OPERATION_NOT_SUPPORTED: -499, /** < The current device does not support this operation */

  ERROR_JSON: -6000, /** < Json generic error */
  ERROR_JSON_PARSSING: -5999, /** < Json parssing error */
  ERROR_JSON_BUFFER_SIZE: -5998, /** < The size of the buffer storing the Json is too small */
});
