const mdns = require('mdns');

const services = [];
const browser = mdns.browseThemAll(); // createBrowser(mdns.udp('arsdk-090b'));

browser.on('serviceUp', function(service) {
  if (service.type.name.startsWith('arsdk-') && service.type.protocol === 'udp') {
    console.log('service up: ', service);
    services.push(service);
  }
});

module.exports = { services, browser };
