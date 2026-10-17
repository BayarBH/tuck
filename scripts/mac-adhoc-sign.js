'use strict';
// electron-builder afterPack hook, macOS only.
// darwin (dmg/zip): ad-hoc sign the packed app so an unsigned build is still a consistently signed bundle
// (Apple Silicon reports apps with a broken signature as "damaged", and right-click > Open cannot get past
// that). Skipped when a Developer ID comes from CSC_LINK / CSC_NAME (see SIGNING.md); a keychain identity
// found by auto-discovery re-signs over this with --force anyway.
// mas: fix Info.plist before electron-builder signs it. electron-builder 25 applies only build.mac.extendInfo
// (build.mas.extendInfo is ignored, see app-builder-lib macPackager applyCommonInfo), so the MAS-only keys
// are set here: no Apple Events usage text (the MAS build never talks to System Events) and the export
// compliance answer. Runs for each arch of a universal build and again on the merged app; both steps are
// idempotent, so the per-arch plists stay identical for @electron/universal.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

exports.default = async function afterPack(ctx) {
  const app = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`);
  if (ctx.electronPlatformName === 'mas') {
    const plist = path.join(app, 'Contents', 'Info.plist');
    // the key name is stored as plain ASCII in XML and binary plists alike
    if (fs.readFileSync(plist).includes('NSAppleEventsUsageDescription')) {
      execFileSync('plutil', ['-remove', 'NSAppleEventsUsageDescription', plist], { stdio: 'inherit' });
    }
    execFileSync('plutil', ['-replace', 'ITSAppUsesNonExemptEncryption', '-bool', 'NO', plist], { stdio: 'inherit' });
    return;
  }
  if (ctx.electronPlatformName !== 'darwin') return;
  if (process.env.CSC_LINK || process.env.CSC_NAME) return;
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
