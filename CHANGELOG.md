# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0]

Connector architecture: transport handling moved out of `DroneConnection` into
pluggable connectors, adding Wifi support alongside Bluetooth LE (#21, #164).

### Added
- `BaseConnector`, `BLEConnector` and `WifiConnector`, all exported from the
  package, plus `DroneCommand`.
- Wifi support: mDNS auto-discovery (optional native `mdns`) or a direct
  `connect(host, port)`.
- `'error'` event on connectors/`DroneConnection`, forwarded from the transport.
- Acknowledgement handling for both transports — outgoing commands resolve on
  the drone's ACK, and incoming `DATA_WITH_ACK` frames are acked back.
- A `node:test` test suite (`npm test`) run in CI on Node 20/22/24, and an
  `engines` (`node >=20`) and `files` allow-list in `package.json`.

### Changed
- **Breaking:** `DroneConnection` now takes a connector instance, e.g.
  `new DroneConnection(new BLEConnector())`. See "Migrating from 0.6.x" in the
  README.
- `mdns` is now an `optionalDependency`, so installs no longer fail when it
  cannot be built; only no-argument Wifi discovery requires it.
- Dependency cleanup: dropped the unused `ava` and the redundant `dgram`/`net`
  shims, and moved `node-gyp` to `devDependencies`.

### Fixed
- `BLEConnector` crashed on connect (wrong `receiveUuids` import) and called the
  non-existent `noble.warn`; errors in noble callbacks now emit `'error'`
  instead of throwing uncatchably.
- Wifi mDNS discovery passed the whole service object instead of host/port.
- `WifiConnector.connected` always reported `false` after connecting.
- `DroneConnection` forwarded the wrong disconnect event, never re-emitted
  sensor events, and called the non-existent `DroneCommand.copy()`.

[0.7.0]: https://github.com/Mechazawa/minidrone-js/releases/tag/v0.7.0
