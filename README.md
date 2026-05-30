Minidrone-js [![](https://badge.fury.io/js/minidrone-js.svg)](https://badge.fury.io/js/minidrone-js) [![](https://api.codeclimate.com/v1/badges/fc937ad532e4160ea2f0/maintainability)](https://codeclimate.com/github/Mechazawa/minidrone-js/maintainability) [![](https://travis-ci.org/Mechazawa/minidrone-js.svg?branch=master)](https://travis-ci.org/Mechazawa/minidrone-js)
---------------

Minidrone-js is an easy to use drone library for the Parrot 
Minidrones. In theory it supports many different Parrot drones 
besides Minidrones but this is untested. 

This library is loosely based on the work by [fetherston] for 
[npm-parrot-minidrone] and [amymcgovern] for [pymambo].

[amymcgovern]: https://github.com/amymcgovern
[pymambo]: https://github.com/amymcgovern/pymambo
[fetherston]: https://github.com/fetherston
[npm-parrot-minidrone]: https://github.com/fetherston/npm-parrot-minidrone

## Functionality
This library is designed to support the two-way command communication 
protocol used by Parrot drones. It supports receiving sensor updates 
and sending commands based on the [xml specification]. 

[xml specification]: https://github.com/Parrot-Developers/arsdk-xml/blob/master/xml/

## Installation

```bash
npm install minidrone-js --save
```

## TypeScript

The package ships TypeScript declarations (`.d.ts`), generated from the JSDoc, so
editors and TypeScript projects get autocompletion and type-checking out of the
box — no separate `@types` package required.

## Example

This example will make the drone take-off, do a flip and then land again.

```js
const {DroneConnection, CommandParser, BLEConnector} = require('minidrone-js');

const parser = new CommandParser();

// Pick a connector for your drone: BLEConnector() for Bluetooth or
// WifiConnector() for Wifi drones. The DroneConnection wraps it.
const connector = new BLEConnector();
const drone = new DroneConnection(connector);


/* 
 * Commands are easily found by reading the xml specification
 * https://github.com/Parrot-Developers/arsdk-xml/blob/master/xml/
 */
const takeoff = parser.getCommand('minidrone', 'Piloting', 'TakeOff');
const landing = parser.getCommand('minidrone', 'Piloting', 'Landing');
const backFlip = parser.getCommand('minidrone', 'Animations', 'Flip', {direction: 'back'});

/** Helper function */
function sleep(ms) {
  return new Promise(a => setTimeout(a, ms));
}

void async function() {
  // connect() lives on the connector; the connection forwards its 'connected' event
  await connector.connect();
  await new Promise(resolve => drone.once('connected', resolve));

  // Makes the code a bit clearer
  const runCommand = x => drone.runCommand(x);

  await runCommand(takeoff);

  await sleep(2000);
  await runCommand(backFlip);

  await sleep(2000);
  await runCommand(landing);

  await sleep(5000);
  process.exit();
}();
```

## Connectors

A `DroneConnection` wraps a *connector* that handles the transport. Two are provided:

| Connector | Transport | `connect()` |
| --- | --- | --- |
| `BLEConnector` | Bluetooth LE (via `@abandonware/noble`) | `connect()` — scans for and connects to a nearby drone |
| `WifiConnector` | Wifi (UDP/TCP) | `connect()` — auto-discovers over mDNS; or `connect(host, port)` to connect directly |

```js
const { DroneConnection, WifiConnector } = require('minidrone-js');

const drone = new DroneConnection(new WifiConnector());
// drone.connector.connect();          // mDNS auto-discovery
// drone.connector.connect('192.168.99.3', 44444); // or connect directly
```

mDNS auto-discovery relies on the optional native [`mdns`] dependency. It is an
`optionalDependency`, so installs never fail when it can't be built (e.g. on Node
versions where it has no prebuilt binary). Without it, BLE and the direct
`connect(host, port)` path still work — only no-argument Wifi discovery needs it
(it rejects with a clear error otherwise). On Linux `mdns` needs
`libavahi-compat-libdnssd-dev`.

[`mdns`]: https://www.npmjs.com/package/mdns

You can also use a connector directly without `DroneConnection`:

```js
const { WifiConnector, CommandParser } = require('minidrone-js');

const parser = new CommandParser();
const drone = new WifiConnector();

drone.on('connected', () => drone.sendCommand(parser.getCommand('minidrone', 'Piloting', 'TakeOff')));
drone.connect();
```

### Events

`DroneConnection` (and the connectors) are `EventEmitter`s:

| Event | Fired when |
| --- | --- |
| `connected` | the drone is connected and ready for commands |
| `disconnected` | the connection to the drone was lost |
| `error` | the underlying transport raised an error |
| `sensor:<token>` | a sensor reading arrived (e.g. `sensor:minidrone-UsbAccessoryState-GunState`) |
| `sensor:*` | any sensor reading arrived |

```js
drone.on('sensor:minidrone-UsbAccessoryState-GunState', (sensor) => {
  if (sensor.state.value === sensor.state.enum.READY) {
    console.log('The gun is ready to fire!');
  }
});
```

> **Error handling.** Like any Node `EventEmitter`, an `'error'` event with no
> listener is thrown. Attach an `'error'` handler if you want to recover from
> transport errors instead of crashing.

## Migrating from 0.6.x

`DroneConnection` no longer talks to the radio itself — it now takes a connector:

```js
// 0.6.x
const drone = new DroneConnection();

// 0.7.0+
const drone = new DroneConnection(new BLEConnector()); // or new WifiConnector()
```

`connect()` lives on the connector, and `BLEConnector`/`WifiConnector` are
exported from the package. Everything else (`runCommand`, `getSensor`,
`sensor:*` events, `CommandParser`) is unchanged.

## Troubleshooting

#### MacOS won't connect to the drone
 - First turn off Bluetooth
 - Run the following code in your shell

```sh
rm -v ~/Library/Preferences/ByHost/com.apple.Bluetooth.*.plist
sudo rm /Library/Preferences/com.apple.Bluetooth.plist
```

 - Turn Bluetooth back on

 Or alternativly using [blueutil]:
 
 ```sh
blueutil off
rm -v ~/Library/Preferences/ByHost/com.apple.Bluetooth.*.plist
sudo rm /Library/Preferences/com.apple.Bluetooth.plist
blueutil on
 ```
 
 [blueutil]: http://www.frederikseiffert.de/blueutil/

## License

MIT License

Copyright 2018-2026 Mechazawa <mega@ioexception.at>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
