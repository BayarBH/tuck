'use strict';
// electron-builder afterPack hook. macOS only: ad-hoc sign the packed app so an unsigned build is still
// a consistently signed bundle (Apple Silicon reports apps with a broken signature as "damaged", and
// right-click > Open cannot get past that). Skipped when a Developer ID comes from CSC_LINK / CSC_NAME
// (see SIGNING.md); a keychain identity found by auto-discovery re-signs over this with --force anyway.
const path = require('path');
const { execFileSync } = require('child_process');

exports.default = async function adhocSign(ctx) {
  if (ctx.electronPlatformName !== 'darwin') return;
  if (process.env.CSC_LINK || process.env.CSC_NAME) return;
  const app = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
