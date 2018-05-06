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

Using yarn

```bash
yarn add minidrone-js
```

or using npm

```bash
npm install minidrone-js
```

## Example

This example will make the drone take-off, do a flip and then land again.

```js
const {DroneConnection, CommandParser} = require('minidrone-js');

const parser = new CommandParser();
const drone = new DroneConnection();


/* 
 * Commands are easily found by reading the xml specification
 * https://github.com/Parrot-Developers/arsdk-xml/blob/master/xml/
 */
const takeoff = parser.getCommand('minidrone', 'Piloting', 'TakeOff');
const landing = parser.getCommand('minidrone', 'Piloting', 'Landing');
const backFlip = parser.getCommand('minidrone', 'Animations', 'Flip', {direction: 'back'});



drone.on('connected', () => {
  // Makes the code a bit clearer
  const runCommand = x => drone.runCommand(x);

  runCommand(takeoff);

  setTimeout(runCommand, 2000, backFlip);
  setTimeout(runCommand, 4000, landing);
  setTimeout(process.exit, 5000);
});
```

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

Copyright 2018 Mechazawa <mega@ioexception.at>

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
