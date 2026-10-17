'use strict';
// Obsidian vaults on this computer, from Obsidian's own vault list (obsidian.json). Read only: Tuck never
// changes Obsidian's settings. "Obsidian mode" = the notes folder lives inside a vault; the notes file is
// plain Markdown that Obsidian indexes as it is (#tags in thoughts become Obsidian tags).
const fs = require('fs');
const os = require('os');
const path = require('path');

function configFile(platform = process.platform, env = process.env, home = os.homedir()) {
  if (platform === 'win32') return path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'obsidian', 'obsidian.json');
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'obsidian', 'obsidian.json');
  return path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'obsidian', 'obsidian.json');
}

// obsidian.json: { "vaults": { "<id>": { "path": "...", "ts": 1700000000000, "open": true } } }
// -> [{ name, path }] most recently opened first
function parseVaults(text) {
  let j;
  try { j = JSON.parse(text); } catch { return []; }
  const v = j && typeof j.vaults === 'object' && j.vaults ? Object.values(j.vaults) : [];
  return v.filter((x) => x && typeof x.path === 'string' && path.isAbsolute(x.path))
    .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))
    .map((x) => ({ name: path.basename(x.path), path: path.normalize(x.path) }));
}

function listVaults(file = configFile()) {
  try { return parseVaults(fs.readFileSync(file, 'utf8')).filter((v) => fs.existsSync(v.path)); } catch { return []; }
}

// the vault that contains dir, or null (Windows and macOS file systems ignore case)
function vaultOf(dir, vaults, platform = process.platform) {
  const norm = (p) => { const r = path.resolve(p); return platform === 'linux' ? r : r.toLowerCase(); };
  const d = norm(dir);
  return vaults.find((v) => {
    const rel = path.relative(norm(v.path), d);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  }) || null;
}

// opens the file in the vault that holds it (Obsidian registers the obsidian:// handler)
const openUri = (file) => 'obsidian://open?path=' + encodeURIComponent(file);

module.exports = { configFile, parseVaults, listVaults, vaultOf, openUri };
