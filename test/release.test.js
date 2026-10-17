'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');
const { updateLatestYml } = require('../scripts/refresh-latest-yml');
const { mergeMacYml } = require('../scripts/merge-mac-yml');

test('release: updateLatestYml rewrites sha512/size of the signed exe', () => {
  const src = `version: 0.1.0
files:
  - url: Tuck-Setup-0.1.0.exe
    sha512: OLD
    size: 1
path: Tuck-Setup-0.1.0.exe
sha512: OLD
releaseDate: '2026-10-16T16:58:02.340Z'
`;
  const doc = yaml.load(updateLatestYml(src, { name: 'Tuck-Setup-0.1.0.exe', sha512: 'NEW', size: 42 }));
  assert.deepEqual(doc.files, [{ url: 'Tuck-Setup-0.1.0.exe', sha512: 'NEW', size: 42 }]);
  assert.equal(doc.sha512, 'NEW');
  assert.equal(doc.releaseDate, '2026-10-16T16:58:02.340Z');
  assert.throws(() => updateLatestYml(src, { name: 'other.exe', sha512: 'x', size: 1 }));
});

test('release: mergeMacYml concatenates files of both arches', () => {
  const y = (arch) => `version: 0.1.0
files:
  - url: Tuck-0.1.0-${arch}.zip
    sha512: z${arch}
    size: 1
  - url: Tuck-0.1.0-${arch}.dmg
    sha512: d${arch}
    size: 2
path: Tuck-0.1.0-${arch}.zip
sha512: z${arch}
`;
  const doc = yaml.load(mergeMacYml([y('arm64'), y('x64')]));
  assert.deepEqual(doc.files.map((f) => f.url), ['Tuck-0.1.0-arm64.zip', 'Tuck-0.1.0-arm64.dmg', 'Tuck-0.1.0-x64.zip', 'Tuck-0.1.0-x64.dmg']);
  assert.equal(doc.path, 'Tuck-0.1.0-arm64.zip');
  assert.throws(() => mergeMacYml([y('arm64'), y('x64').replace('0.1.0', '0.2.0')]));
});
