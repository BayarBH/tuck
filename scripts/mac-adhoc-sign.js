'use strict';
// electron-builder afterPack hook. macOS only: ad-hoc sign the packed app so an unsigned build is still
// a consistently signed bundle (Apple Silicon reports apps with a broken signature as "damaged", and
// right-click > Open cannot get past that). With a Developer ID (see SIGNING.md) electron-builder signs
// again afterwards with --force, replacing this signature.
const path = require('path');
const { execFileSync } = require('child_process');

exports.default = async function adhocSign(ctx) {
  if (ctx.electronPlatformName !== 'darwin') return;
  const app = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
