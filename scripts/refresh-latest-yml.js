'use strict';
// After the Windows installer is signed outside electron-builder (SignPath in release.yml) its bytes
// change: rebuild dist/<exe>.blockmap and the sha512/size in dist/latest.yml, or electron-updater
// rejects the download. Usage: node scripts/refresh-latest-yml.js [distDir]
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// pure: latest.yml text + new {name, sha512, size} of one file -> updated text
function updateLatestYml(text, { name, sha512, size }) {
  const doc = yaml.load(text);
  const f = (doc.files || []).find((x) => x.url === name);
  if (!f) throw new Error(`${name} not listed in latest.yml`);
  Object.assign(f, { sha512, size });
  if (doc.path === name) doc.sha512 = sha512;
  return yaml.dump(doc, { lineWidth: -1 });
}

if (require.main === module) {
  const { execFileSync } = require('child_process');
  const { appBuilderPath } = require('app-builder-bin');
  const dist = path.resolve(process.argv[2] || 'dist');
  const yml = path.join(dist, 'latest.yml');
  const name = fs.readdirSync(dist).find((n) => /^Tuck-Setup-.*\.exe$/.test(n));
  if (!name) throw new Error(`no Tuck-Setup-*.exe in ${dist}`);
  const exe = path.join(dist, name);
  // prints {"size":..,"sha512":".."} for the input file
  const out = execFileSync(appBuilderPath, ['blockmap', '--input', exe, '--output', `${exe}.blockmap`], { encoding: 'utf8' });
  const { sha512, size } = JSON.parse(out);
  fs.writeFileSync(yml, updateLatestYml(fs.readFileSync(yml, 'utf8'), { name, sha512, size }));
  console.log(`${name}: size ${size}, sha512 ${sha512}`);
}

module.exports = { updateLatestYml };
