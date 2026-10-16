// Run node --check on every .js under src/ test/ scripts/ plus config.js
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = ['src', 'test', 'scripts'].reduce((a, d) => walk(path.join(root, d), a), [path.join(root, 'config.js')]);
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) { failed++; process.stderr.write(r.stderr || `${f}: check failed\n`); }
}
console.log(`lint: ${files.length - failed}/${files.length} ok`);
process.exit(failed ? 1 : 0);
