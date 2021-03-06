/**
 * Get the name of the value type
 * @param {*} value - Any value
 * @private
 * @returns {string} - Value type name
 */
module.exports.getTypeName = function getTypeName(value) {
  value = typeof value === 'function' ? value : value.constructor;

  return value.name;
};
