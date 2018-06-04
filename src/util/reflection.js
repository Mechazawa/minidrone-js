/**
 * Get the name of the value type
 * @param {*} value - Any value
 * @private
 * @returns {string} - Value type name
 */
function getTypeName(value) {
  value = typeof value === 'function' ? value : value.constructor;

  return value.name;
}

function promiseify(func) {
  return function() {
    return new Promise((accept, reject) => {
      try {
        func(...arguments, accept);
      } catch (e) {
        reject(e);
      }
    });
  };
}


module.exports = {
  getTypeName,
  promiseify,
};
