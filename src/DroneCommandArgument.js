import Enum from './util/Enum';

export default class DroneCommandArgument {
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

  get name() {
    return this._name;
  }

  get description() {
    return this._description;
  }

  get type() {
    return this._type;
  }

  get value() {
    if (this.type === 'string' && !this._value.endsWith('\0')) {
      return this._value + '\0';
    }

    return this._value;
  }

  get hasEnumProperty() {
    return typeof this.enum !== 'undefined';
  }

  set value(value) {
    if (Object.is(value, -0)) {
      value = 0;
    }

    this._value = this._parseValue(value);
  }

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

        throw new Error(`Value ${value} could not be interpreted as an enum value for ${this.name}. Available options are ${this.enum.toString()}`);
      case 'string':
        return String(value);
    }

    // Default behavior
    return Number(value);
  }

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

  toString() {
    if (this.hasEnumProperty) {
      const valueName = this.enum.findForValue(this.value);

      return `${this.name}="${valueName}"(${this.value})`;
    }

    return `${this.name}="${this.value}"`;
  }
}
