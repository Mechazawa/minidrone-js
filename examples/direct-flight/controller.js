// Stolen from mambo-no-5 project
const XboxController = require("xbox-controller");

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const led = {
  ALTERNATE_BLINKING: 0x0c,
  ONE_LIGHT: 0x06,
  TWO_LIGHTS: 0x07,
  THREE_LIGHTS: 0x08,
  FOUR_LIGHTS: 0x09
};

const buttons = [
  "start",
  "back",
  "dup",
  "ddown",
  "dleft",
  "dright",
  "leftstick",
  "rightstick",
  "a",
  "b",
  "x",
  "y",
  "leftshoulder",
  "rightshoulder",
  "xboxbutton"
];

function shouldUpdate(next, prev, callback) {
  const newX = next.x !== prev.x;
  const newY = next.y !== prev.y;
  if (newX || newY) {
    try {
      callback();
    } catch (e) {
      console.error(e);
    }
  }
}

let maxX = 0;
function max(val) {
  if (val > maxX) {
    maxX = val;
  }
  console.warn(maxX);
}

class Controller {
  constructor(options = {}) {
    const defaults = {
      sensitivity: 100,
      // No-op event handlers designed to be overridden via the options object
      onRightAnalogMove: () => {},
      onLeftAnalogMove: () => {},
      onRightTriggerMove: () => {},
      onLeftTriggerMove: () => {}
    };

    this.options = Object.assign({}, defaults, options);

    this.controller = new XboxController();
    this.leftStickData = { x: -100, y: 100 };
    this.rightStickData = { x: -100, y: 100 };
    // add event handlers
    buttons.forEach(button => {
      this.controller.on(
        `${button}:release`,
        this.options[`on${capitalize(button)}Press`] || console.log
      );
    });

    this.controller.on("lefttrigger", this.onLeftTriggerMove.bind(this));
    this.controller.on("righttrigger", this.onRightTriggerMove.bind(this));
    this.controller.on("left:move", this.onLeftAnalogMove.bind(this));
    this.controller.on("right:move", this.onRightAnalogMove.bind(this));
  }

  /**
   * Normalizes the analog inputs to return a range of +/- the set
   * sensitivity value.
   *
   * @param  {object} value the data object from the move event
   * @return {object}       the data object with the processed data
   */
  normalizeAnalogInputs(value) {
    return Object.keys(value).reduce((prev, key) => {
      let val = Math.floor(
        this.options.sensitivity * (-value[key] + 1) / 32767
      );

      prev[key] = val;
      return prev;
    }, {});
  }

  /**
   * Event handler for the left analog stick
   * normalizes data, and inverts x
   *
   * @param  {data} data the event data object
   * @return {Controller} the controller instance
   */
  onLeftAnalogMove(data) {
    const cleanData = this.normalizeAnalogInputs(data);
    cleanData.x = cleanData.x * -1; // inverse

    shouldUpdate(cleanData, this.leftStickData, () => {
      this.options.onRightAnalogMove(cleanData);
    });
    this.leftStickData = cleanData;

    return this;
  }

  /**
   * Event handler for the right analog stick
   * normalizes data, and inverts x.
   *
   * @param  {data} data the event data object
   * @return {Controller} the controller instance
   */
  onRightAnalogMove(data) {
    const cleanData = this.normalizeAnalogInputs(data);
    cleanData.x = cleanData.x * -1; // inverse

    shouldUpdate(cleanData, this.rightStickData, () => {
      this.options.onLeftAnalogMove(cleanData);
    });
    this.rightStickData = cleanData;

    return this;
  }

  /**
   * Normalizes the trigger inputs to return a number
   * normalizes the amount pressed as a percentage
   *
   * @param  {object} value the data object from the move event
   * @return {object}       the data object with the processed data
   */
  normalizeTriggerInputs(value) {
    return Math.floor(this.options.sensitivity * (value + 1) / 256);
  }

  /**
   * Event handler for the right trigger
   * normalizes the amount pressed as a percentage
   *
   * @param  {data} data the event data object
   * @return {Controller} the controller instance
   */
  onRightTriggerMove(delta) {
    const cleandata = this.normalizeTriggerInputs(delta);

    this.options.onRightTriggerMove(cleandata);
    return this;
  }

  /**
   * Event handler for the left trigger
   * normalizes and the amount pressed as a percentage
   *
   * @param  {data} data the event data object
   * @return {Controller} the controller instance
   */
  onLeftTriggerMove(delta) {
    const cleandata = this.normalizeTriggerInputs(delta);

    this.options.onLeftTriggerMove(cleandata);

    return this;
  }

  setFourLights() {
    this.controller.setLed(led.FOUR_LIGHTS);
  }
  setThreeLights() {
    this.controller.setLed(led.TWO_LIGHTS);
  }
  setTwoLights() {
    this.controller.setLed(led.THREE_LIGHTS);
  }
  setOneLight() {
    this.controller.setLed(led.ONE_LIGHT);
  }
  setBlinking() {
    this.controller.setLed(led.ALTERNATE_BLINKING);
  }
}

module.exports = Controller;
