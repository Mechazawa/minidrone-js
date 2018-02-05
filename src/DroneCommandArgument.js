import Enum from './util/Enum';

/**
 * Drone Command Argument class
 *
 * Used for storing command arguments
 *
 * @property {Enum|undefined} enum - Enum store containing possible enum values if `this.type === 'enum'`. If set then `this.hasEnumProperty === true`.
 */
export default class DroneCommandArgument {
  /**
   * Command argument constructor
   * @param {object} raw - Raw command argument data from the xml specification
   */
  constructor(raw) {
    this._name = raw.$.name;
    this._description = String(raw._).trim();
    this._type = raw.$.type;
    this._value = this.type === 'string' ? '' : 0;

    // Parse enum if needed
    if (this.type === 'enum') {
      const enumData = {};
      let enumValue = 0;

      for (const option of raw.enum) {
        const enumName = option.$.name;

        enumData[enumName] = enumValue++;
      }

      this._enum = new Enum(enumData);

      Object.defineProperty(this, 'enum', {
        enumerable: false,
        get: () => this._enum,
      });
    }
  }

  /**
   * Parameter name
   * @returns {string}
   */
  get name() {
    return this._name;
  }

  /**
   * Parameter description
   * @returns {string}
   */
  get description() {
    return this._description;
  }

  /**
   * Parameter type
   * @returns {string}
   */
  get type() {
    return this._type;
  }

  /**
   * Get the parameter value
   * @returns {number|string}
   * @see DroneCommandArgument#type
   */
  get value() {
    if (this.type === 'string' && !this._value.endsWith('\0')) {
      return this._value + '\0';
    } else if (this.type === 'float') {
      return Math.fround(this._value);
    }

    return this._value;
  }

  /**
   * Set the parameter value
   * @param value {number|string}
   */
  set value(value) {
    if (Object.is(value, -0)) {
      value = 0;
    }

    this._value = this._parseValue(value);
  }

  /**
   * If it has the enum property set
   * @returns {boolean}
   */
  get hasEnumProperty() {
    return typeof this.enum !== 'undefined';
  }

  /**
   * Parses the value before setting it
   * @param {number|string} value
   * @returns {number|string}
   * @private
   * @throws TypeError
   */
  _parseValue(value) {
    switch (this.type) {
      case 'enum':
        if (this.enum.hasKey(value)) {
          return this.enum[value];
        } else if (this.enum.hasValue(value)) {
          return value;
          // } else if (value === 256) {
          //   // This is some BS value I sometimes get from the drone
          //   // Pretty much just means "unavailable"
          //   return value;
        }

        throw new TypeError(`Value ${value} could not be interpreted as an enum value for ${this.name}. Available options are ${this.enum.toString()}`);
      case 'string':
        return String(value);
    }

    // Default behavior
    return Number(value);
  }

  /**
   * Gets the byte size of the value.
   * @returns {number}
   */
  getValueSize() {
    switch (this.type) {
      case 'string':
        return this.value.length;
      case 'u8':
      case 'i8':
        return 1;
      case 'u16':
      case 'i16':
        return 2;
      case 'u32':
      case 'i32':
        return 4;
      case 'u64':
      case 'i64':
        return 8;
      case 'float':
        return 4;
      case 'double':
        return 8;
      case 'enum':
        return 4;
    }

    return 0;
  }

  /**
   * Returns a string representation of the DroneCommandArgument instance
   * @param {boolean} debug - If extra debug info should be shown.
   * @returns {string}
   */
  toString(debug = false) {
    if (this.hasEnumProperty) {
      const valueName = this.enum.findForValue(this.value);

      return `${this.name}="${valueName}"(${this.value})`;
    }

    const precision = 3;
    const value = Math.round(this.value * (precision * 10)) / (precision * 10);
    const message = `${this.name}="${value}"`;

    if (!debug) {
      return message;
    }

    return `${message}(${this.type})`;
  }
}
