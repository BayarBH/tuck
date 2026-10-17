'use strict';
// release.yml builds arm64 and x64 on separate runners, each writing its own latest-mac.yml. Merge them
// into one (files[] concatenated, the rest from the first). Usage: node scripts/merge-mac-yml.js out.yml a.yml b.yml
const fs = require('fs');
const yaml = require('js-yaml');

function mergeMacYml(texts) {
  const [first, ...rest] = texts.map((t) => yaml.load(t));
  for (const d of rest) {
    if (d.version !== first.version) throw new Error(`version mismatch: ${first.version} vs ${d.version}`);
    first.files = first.files.concat(d.files);
  }
  return yaml.dump(first, { lineWidth: -1 });
}

if (require.main === module) {
  const [out, ...inputs] = process.argv.slice(2);
  if (inputs.length < 1) throw new Error('usage: merge-mac-yml.js out.yml in1.yml [in2.yml ...]');
  fs.writeFileSync(out, mergeMacYml(inputs.map((f) => fs.readFileSync(f, 'utf8'))));
}

module.exports = { mergeMacYml };
