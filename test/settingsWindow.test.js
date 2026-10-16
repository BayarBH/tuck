'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { relocateNotes } = require('../src/settingsWindow');
const { probeWritable, format, collect } = require('../src/diagnostics');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tuck-sw-'));

test('relocateNotes: copy keeps both, move keeps a backup, never overwrites', () => {
  const root = tmp();
  const a = path.join(root, 'a', 'tuck.md');
  const bak = path.join(root, 'bak');
  fs.mkdirSync(path.dirname(a));
  fs.writeFileSync(a, 'NOTES');

  const b = path.join(root, 'b', 'tuck.md');
  relocateNotes(a, b, 'copy', bak);
  assert.equal(fs.readFileSync(a, 'utf8'), 'NOTES');
  assert.equal(fs.readFileSync(b, 'utf8'), 'NOTES');
  assert.throws(() => relocateNotes(a, b, 'copy', bak), { code: 'EEXIST' });

  const c = path.join(root, 'c', 'tuck.md');
  relocateNotes(a, c, 'move', bak, new Date(2026, 0, 2, 3, 4, 5));
  assert.equal(fs.existsSync(a), false);
  assert.equal(fs.readFileSync(c, 'utf8'), 'NOTES');
  assert.equal(fs.readFileSync(path.join(bak, 'moved', 'tuck.md-20260102-030405.md'), 'utf8'), 'NOTES');

  // settings switch fails -> copy removed, original kept
  const e = path.join(root, 'e', 'tuck.md');
  assert.throws(() => relocateNotes(c, e, 'move', bak, new Date(2026, 0, 2, 3, 4, 6), () => { throw new Error('EPERM settings'); }), /EPERM/);
  assert.equal(fs.existsSync(e), false);
  assert.equal(fs.readFileSync(c, 'utf8'), 'NOTES');

  relocateNotes(c, path.join(root, 'd', 'tuck.md'), 'new', bak);
  assert.equal(fs.existsSync(path.join(root, 'd', 'tuck.md')), false);
  assert.equal(fs.existsSync(c), true);
});

test('probeWritable leaves nothing behind', () => {
  const d = tmp();
  assert.deepEqual(probeWritable(d), { ok: true });
  assert.deepEqual(fs.readdirSync(d), []);
  assert.equal(probeWritable(path.join(d, 'x\0y')).ok, false);
});

test('diagnostics rows hold no note text', async () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'tuck.md'), 'SECRET QUOTE');
  const all = { notesDir: d, notesFile: 'tuck.md', excludeApps: ['a.exe'], excludeTitles: [], autoUpdate: false };
  const rows = await collect({
    app: { getVersion: () => '9.9.9', isPackaged: false },
    screen: { getAllDisplays: () => [{ id: 1, size: { width: 1920, height: 1080 }, bounds: { x: 0, y: 0 }, scaleFactor: 1.5 }], getPrimaryDisplay: () => ({ id: 1 }) },
    settings: { all: () => all },
    store: { read: () => ({ entries: [{ quote: 'SECRET QUOTE' }] }) },
    logger: { file: 'x.log' },
    status: () => ({ hookLoaded: true, paused: false, lastTrigger: { at: Date.now() - 5000, mode: 'double' } }),
    elevated: false,
  });
  const text = format(rows);
  assert.match(text, /Key hook: loaded/);
  assert.match(text, /1920x1080 at 150%/);
  assert.match(text, /1 entries/);
  assert.match(text, /double-tap/);
  assert.doesNotMatch(text, /SECRET/);
});
