// Local macOS release packaging (unsigned).
//
// Produces `Bruno-dev_<version>_<arch>_mac.dmg` / `.zip` suitable for attaching to a
// GitHub Release. Differences from electron-builder-config.js:
//   - productName/appId  → Bruno-dev, separate bundle id and userData folder name
//   - identity: null     → no Apple Developer certificate required
//   - afterSign: null    → skips notarize.js (no APPLE_ID / APPLE_PASSWORD)
//   - hardenedRuntime    → off, it requires a signature to take effect
//   - protocols: []      → does not steal the `bruno://` URL scheme from real Bruno
//
// Usage (from packages/bruno-electron):
//   npx electron-builder --mac --config electron-builder-dev-dmg.js

const base = require('./electron-builder-config');

module.exports = {
  ...base,
  appId: 'com.usebruno.app.dev',
  productName: 'Bruno-dev',
  afterSign: null,
  directories: {
    ...base.directories,
    output: 'out-release'
  },
  mac: {
    ...base.mac,
    artifactName: '${name}_${version}_${arch}_${os}.${ext}',
    target: [
      {
        target: 'dmg',
        arch: ['arm64', 'x64']
      },
      {
        target: 'zip',
        arch: ['arm64', 'x64']
      }
    ],
    hardenedRuntime: false,
    identity: null,
    notarize: false,
    // Omitted on purpose — see header.
    protocols: []
  }
};
