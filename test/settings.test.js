'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSettings, DEFAULTS } = require('../src/settings');
const { createLogger } = require('../src/logger');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tuck-set-'));

test('defaults, set validates + persists only set keys, emits changed keys', () => {
  const env = process.env.TUCK_NOTES_DIR;
  delete process.env.TUCK_NOTES_DIR;
  try {
    const dir = tmp(), file = path.join(dir, 'settings.json');
    const s = createSettings({ file });
    assert.equal(s.get('longPressMs'), 600);
    assert.equal(s.get('autoUpdate'), false);
    assert.deepEqual(s.all().excludeApps, DEFAULTS.excludeApps);
    const seen = [];
    s.onChange((all, changed) => seen.push([all.longPressMs, changed]));
    s.set({ longPressMs: 800, autoUpdate: false, excludeApps: [' Foo.EXE ', 'foo.exe', ''] });
    assert.deepEqual(seen, [[800, ['longPressMs', 'excludeApps']]]);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { longPressMs: 800, autoUpdate: false, excludeApps: ['foo.exe'] });
    s.set({ longPressMs: 800 });
    assert.equal(seen.length, 1); // no change, no event
    assert.throws(() => s.set({ longPressMs: 5, animSpeed: 1.5 }), /longPressMs/);
    assert.throws(() => s.set({ nope: 1 }), /nope/);
    assert.throws(() => s.set({ notesDir: 'relative/dir' }), /notesDir/);
    assert.throws(() => s.set({ notesFile: '../x.md' }), /notesFile/);
    assert.throws(() => s.set({ dailyNotificationTime: '24:00' }), /dailyNotificationTime/);
    assert.equal(s.get('animSpeed'), 1); // whole patch rejected
    s.all().excludeApps.push('mutated');
    assert.deepEqual(s.get('excludeApps'), ['foo.exe']);
    assert.equal(createSettings({ file }).get('longPressMs'), 800); // reload
    fs.rmSync(dir, { recursive: true, force: true });
  } finally {
    if (env !== undefined) process.env.TUCK_NOTES_DIR = env;
  }
});

test('notesDirBookmark (Mac App Store): string up to 20000 chars, persisted', () => {
  const dir = tmp(), file = path.join(dir, 'settings.json');
  const s = createSettings({ file });
  assert.equal(s.get('notesDirBookmark'), '');
  assert.throws(() => s.set({ notesDirBookmark: 5 }), /notesDirBookmark/);
  assert.throws(() => s.set({ notesDirBookmark: 'x'.repeat(20001) }), /notesDirBookmark/);
  const bm = 'Ym9va21hcms=' + 'A'.repeat(19988);
  s.set({ notesDirBookmark: bm });
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).notesDirBookmark, bm);
  assert.equal(createSettings({ file }).get('notesDirBookmark'), bm);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('corrupt file -> defaults, kept aside as .bad; TUCK_NOTES_DIR overrides notesDir', () => {
  const env = process.env.TUCK_NOTES_DIR;
  const dir = tmp(), file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, '{oops');
  process.env.TUCK_NOTES_DIR = path.join(dir, 'env-notes');
  try {
    const s = createSettings({ file });
    assert.equal(s.get('longPressMs'), 600);
    assert.equal(fs.readdirSync(dir).filter((n) => /^settings\.json\..+\.bad$/.test(n)).length, 1);
    assert.equal(s.get('notesDir'), path.join(dir, 'env-notes'));
  } finally {
    if (env === undefined) delete process.env.TUCK_NOTES_DIR; else process.env.TUCK_NOTES_DIR = env;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('unreadable (locked) file: defaults in memory, never written over', () => {
  const dir = tmp(), file = path.join(dir, 'settings.json');
  fs.mkdirSync(file); // reading a directory fails with EISDIR, like an AV/sync lock would with EBUSY
  const warns = [];
  const s = createSettings({ file, logger: { warn: (_s, m) => warns.push(m) } });
  assert.equal(s.get('longPressMs'), 600);
  assert.throws(() => s.set({ longPressMs: 900 }), /locked/);
  assert.equal(s.get('longPressMs'), 600);
  assert.ok(fs.statSync(file).isDirectory()); // not renamed, not replaced
  assert.equal(fs.readdirSync(dir).length, 1);
  assert.ok(warns.some((m) => /read failed: EISDIR/.test(m)));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('logger: one line per entry, error stack indented, rotates at 1 MB', () => {
  const dir = tmp();
  const log = createLogger({ dir });
  log.info('app', 'hello\nworld');
  log.error('x', new Error('boom'));
  const lines = fs.readFileSync(log.file, 'utf8').split('\n');
  assert.match(lines[0], /^\d{4}-\d\d-\d\dT.* INFO \[app\] hello \| world$/);
  assert.match(lines[1], /ERROR \[x\] boom$/);
  assert.match(lines[2], /^ {4}at /);
  fs.writeFileSync(log.file, Buffer.alloc(1024 * 1024, 'a'));
  log.warn('w', 'after');
  assert.ok(fs.existsSync(log.file + '.1'));
  assert.match(fs.readFileSync(log.file, 'utf8'), /WARN \[w\] after/);
  fs.rmSync(dir, { recursive: true, force: true });
});
