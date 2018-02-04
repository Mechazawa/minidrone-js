Minidrone-js
---------------

Minidrone-js is an easy to use drone library for the Parrot 
Minidrones. In theory it supports many different Parrot drones 
besides Minidrones but this is untested. 

This library is loosely based on the work by [fetherston] 
([npm-parrot-minidrone]) and [amymcgovern] ([pymambo]).

[amymcgovern]: https://github.com/amymcgovern
[pymambo]: https://github.com/amymcgovern/pymambo
[fetherston]: https://github.com/fetherston
[npm-parrot-minidrone]: https://github.com/fetherston/npm-parrot-minidrone

# Installation

Using yarn

```bash
yarn add minidrone-js
```

or using npm

```bash
npm install minidrone-js
```

# Example

This example will make the drone take-off, do a flip and then land again.

```js
const {DroneConnection, CommandParser} = require('minidrone-js');

const parser = new CommandParser();
const drone = new DroneConnection();
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
