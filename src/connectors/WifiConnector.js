const AbstractDroneConnector = require('./AbstractDroneConnector');
const mdns = require('mdns');
const Logger = require('winston');

module.exports = class WifiConnector extends AbstractDroneConnector {
  constructor(options = {}) {
    super(options);
    this.service = null;
    this.browser = mdns.browseThemAll(); // createBrowser(mdns.udp('arsdk-090b'));

    this.browser.on('serviceUp', service => this._onMdnsServiceDiscovery(service));

    this.browser.start();
  }

  _onMdnsServiceDiscovery(service) {
    if (service.type.name.startsWith('arsdk-') && service.type.protocol === 'udp') {
      this.browser.stop();

      Logger.info('Found service ' + service.type.toString());

      this.service = service;
    }
  }
};
