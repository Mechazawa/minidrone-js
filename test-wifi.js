const mdns = require('mdns');
const Logger = require('winston');
const net = require('net');

Logger.level = 'debug';

let mambo;

function _onMdnsServiceDiscovery(service) {
  if (service.type.name.startsWith('arsdk-') && service.type.protocol === 'udp') {
    browser.stop();

    Logger.info('Found service ' + service.type.toString());

    mambo = service;
    console.log(service);

    const ip = service.addresses[0];
    const port = service.port;

    const config = {
      'd2c_port': 43210,
      'controller_type': 'minidrone-js',
      'controller_name': 'com.example.arsdkapp'
    };

    var client = new net.Socket();
    client.connect(port, ip, function() {
      console.log('Connected');
      console.log('Sending: ' + JSON.stringify(config));
      client.write(JSON.stringify(config));
    });

    client.on('data', function(data) {
      console.log('Received: ' + data);
      client.destroy(); // kill client after server's response
    });

    client.on('close', function() {
      console.log('Connection closed');
    });
  }
}

var sequence = [
  mdns.rst.DNSServiceResolve()
  , mdns.rst.DNSServiceGetAddrInfo({ families: [4] }),
];

let browser = mdns.createBrowser(mdns.udp('_arsdk-090b'), { resolverSequence: sequence }); // createBrowser(mdns.udp('arsdk-090b'));

browser.on('serviceUp', _onMdnsServiceDiscovery);

browser.start();
