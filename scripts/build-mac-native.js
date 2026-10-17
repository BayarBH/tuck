'use strict';
// Build native/mac (tuck_mac.node, universal arm64 + x86_64) for the Mac App Store build. Needs a Mac with
// Xcode Command Line Tools (xcode-select --install) and python3. Uses npm's own bundled node-gyp
// (npm sets npm_config_node_gyp for scripts): the copy under node_modules is node-gyp 9, pulled in by
// @electron/rebuild, whose gyp still imports distutils and breaks on Python 3.12+. The addon is plain
// N-API, so Node's headers are enough; no Electron-specific rebuild is needed.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

if (process.platform !== 'darwin') {
  console.error('build:mac-native: run this on a Mac (needs Xcode Command Line Tools).');
  process.exit(1);
}
const local = path.join(__dirname, '..', 'node_modules', 'node-gyp', 'bin', 'node-gyp.js');
const gyp = [process.env.npm_config_node_gyp, local].find((p) => p && fs.existsSync(p));
if (!gyp) {
  console.error('build:mac-native: node-gyp not found; run it through npm (npm run build:mac-native).');
  process.exit(1);
}
const r = spawnSync(process.execPath, [gyp, 'rebuild'], { cwd: path.join(__dirname, '..', 'native', 'mac'), stdio: 'inherit' });
process.exit(r.status == null ? 1 : r.status);
