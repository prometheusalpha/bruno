// Dev packaging override for electron-builder.
//
// Produces a local `Bruno-dev.app` that can sit in /Applications next to a real
// Bruno install without clashing:
//   - distinct productName/appId → separate bundle id, separate userData folder
//   - no `protocols`            → does not steal the `bruno://` URL scheme
//   - identity: null, afterSign: null → no certificate / notarization needed
//
// Usage (from packages/bruno-electron):
//   npx electron-builder --mac --arm64 --dir   --config electron-builder-dev.js  # .app only
//   npx electron-builder --mac --arm64 --dmg   --config electron-builder-dev.js  # .dmg

const base = require('./electron-builder-config');

module.exports = {
  ...base,
  appId: 'com.usebruno.app.dev',
  productName: 'Bruno-dev',
  afterSign: null,
  directories: {
    ...base.directories,
    output: 'out-dev'
  },
  mac: {
    ...base.mac,
    target: [
      { target: 'dir', arch: ['arm64'] },
      { target: 'dmg', arch: ['arm64'] }
    ],
    identity: null,
    notarize: false,
    // Omitted on purpose — see header.
    protocols: []
  }
};
