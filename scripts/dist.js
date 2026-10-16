// Build the Windows installer. `node scripts/dist.js` builds locally; `--publish` uploads to a
// GitHub Releases draft (needs GH_TOKEN). Signing is picked from the environment (see SIGNING.md):
//   CSC_LINK + CSC_KEY_PASSWORD             -> .pfx / OV certificate (electron-builder signs on its own)
//   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
//   AZURE_SIGN_ENDPOINT, AZURE_SIGN_ACCOUNT, AZURE_SIGN_PROFILE -> Azure Artifact (Trusted) Signing
//   neither                                  -> unsigned build (Windows SmartScreen will warn)
const { build, Platform } = require('electron-builder');

const env = process.env;
const win = {};
const azure = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_SIGN_ENDPOINT', 'AZURE_SIGN_ACCOUNT', 'AZURE_SIGN_PROFILE'];

if (azure.every((k) => env[k])) {
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
  targets: Platform.WINDOWS.createTarget('nsis'),
  publish: process.argv.includes('--publish') ? 'always' : 'never',
  config: { win },
}).then((files) => console.log(files.join('\n')), (e) => { console.error(e); process.exit(1); });
