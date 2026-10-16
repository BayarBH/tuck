// Build the Windows installer. `node scripts/dist.js` builds locally; `--publish` uploads to a
// GitHub Releases draft (needs GH_TOKEN). `--mac` builds the macOS dmg + zip instead (run on a Mac;
// arm64 and x64, see build.mac in package.json). Signing is picked from the environment (see SIGNING.md):
//   CSC_LINK + CSC_KEY_PASSWORD             -> .pfx / OV certificate (electron-builder signs on its own)
//   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
//   AZURE_SIGN_ENDPOINT, AZURE_SIGN_ACCOUNT, AZURE_SIGN_PROFILE -> Azure Artifact (Trusted) Signing
//   neither                                  -> unsigned build (Windows SmartScreen will warn)
const { build, Platform } = require('electron-builder');

const env = process.env;
const mac = process.argv.includes('--mac');
const win = {};
const azure = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_SIGN_ENDPOINT', 'AZURE_SIGN_ACCOUNT', 'AZURE_SIGN_PROFILE'];

if (mac) {
  // electron-builder signs with a "Developer ID Application" identity from CSC_LINK or the keychain and
  // notarizes on its own when APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID are set
  const notarize = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'].every((k) => env[k]);
  console.log(env.CSC_LINK ? 'signing: Developer ID from CSC_LINK' : 'signing: keychain identity if any, else ad-hoc (Gatekeeper will warn)');
  console.log(notarize ? 'notarize: yes' : 'notarize: no (APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID not set)');
} else if (azure.every((k) => env[k])) {
  win.azureSignOptions = {
    endpoint: env.AZURE_SIGN_ENDPOINT,
    codeSigningAccountName: env.AZURE_SIGN_ACCOUNT,
    certificateProfileName: env.AZURE_SIGN_PROFILE,
  };
  // lets electron-updater verify the signature of downloaded updates
  if (env.AZURE_PUBLISHER_NAME) win.signtoolOptions = { publisherName: env.AZURE_PUBLISHER_NAME };
  console.log('signing: Azure Artifact Signing');
} else if (env.CSC_LINK || env.WIN_CSC_LINK) {
  console.log('signing: certificate from CSC_LINK');
} else {
  console.log('signing: none (UNSIGNED build, SmartScreen will warn)');
}

build({
  targets: mac ? Platform.MAC.createTarget() : Platform.WINDOWS.createTarget('nsis'),
  publish: process.argv.includes('--publish') ? 'always' : 'never',
  config: mac ? {} : { win },
}).then((files) => console.log(files.join('\n')), (e) => { console.error(e); process.exit(1); });
