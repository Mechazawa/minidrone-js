import {constant as constantCase} from 'case';
import {getTypeName} from './reflection';


/**
 * Base enum class
 * @example
 * const Colors = new Enum(['RED', 'BLACK', 'GREEN', 'WHITE', 'BLUE']);
 *
 * const Answers = new Enum({
 *   YES: true,
 *   NO: false,
 *   // Passing functions as values will turn them into getters
 *   // Getter results will appear in ::values
 *   MAYBE: () => Math.random() >= 0.5,
 * });
 *
 * const FontStyles = new Enum(['italic', 'bold', 'underline', 'regular'], true);
 * FontStyles.ITALIC === 'italic'
 * FontStyles.BOLD   === 'bold'
 *
 * // etc...
 */
export default class Enum {
  /**
   * @param {Object<String, *>|Array<String>} enums - Data to build the enum from
   * @param {boolean} auto - Auto generate enum from data making assumptions about
   *                         the data, requires enums to be of type array.
   */
  constructor(enums, auto = false) {
    const isArray = enums instanceof Array;

    if (auto && !isArray) {
      throw new TypeError(`Expected enums to be of type "Array" got "${getTypeName(enums)}"`);
    }

    if (isArray && auto) {
      for (const row of enums) {
        const key = constantCase(row);

        Object.defineProperty(this, key, {
          enumerable: true,
          value: row,
        });
      }
    } else if (isArray) {
      for (const key of enums) {
        Object.defineProperty(this, key, {
          enumerable: true,
          value: Enum._iota,
        });
      }
    } else {
      for (const key of Object.keys(enums)) {
        const init = {enumerable: true};

        if (typeof enums[key] === 'function') {
          init.get = enums[key];
        } else {
          init.value = enums[key];
        }

        Object.defineProperty(this, key, init);
      }
    }

    Object.freeze(this);
  }

  /**
   * List enum keys
   * @returns {Array} - Enum keys
   */
  keys() {
    return Object.keys(this);
  }

  /**
   * List enum values
   * @returns {Array<*>} - Enum values
   */
  values() {
    return this.keys()
      .map(key => this[key])
      .filter((v, i, s) => s.indexOf(v) === i);
  }

  /**
   * Find if a key exists
   * @returns {boolean}
   */
  hasKey(name) {
    return this.keys().includes(name);
  }

  /**
   * Find if a key exists
   * @returns {boolean}
   */
  hasValue(name) {
    return this.values().includes(name);
  }

  /**
   * Find for value
   * @param {*} value
   * @returns {string} - name
   */
  findForValue(value) {
    const index = this.keys().map(key => this[key]).findIndex(x => x === value);

    return this.keys()[index];
  }

  static get _iota() {
    if (!Enum.__iota) {
      Enum.__iota = 0;
    }

    return Enum.__iota++;
  }

  toString() {
    return this.keys().map(key => key + '=' + this[key]).join(', ');
  }
}
