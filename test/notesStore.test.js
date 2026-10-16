'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { formatEntry } = require('../src/notesWriter');
const { createNotesStore } = require('../src/notesStore');
const { writeFileAtomic } = require('../src/fsAtomic');

const d = (h, min) => new Date(2026, 9, 16, h, min);

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tuck-store-'));
  const dir = path.join(root, 'notes');
  const backupDir = path.join(root, 'backups');
  const store = createNotesStore({ getPaths: () => ({ dir, file: 'tuck.md' }), backupDir, logger: null });
  const file = path.join(dir, 'tuck.md');
  store.append(formatEntry({ text: 'first', thought: 'one #a', appName: 'a.exe', date: d(9, 0) }));
  store.append(formatEntry({ text: 'second', date: d(9, 5) }));
  store.append(formatEntry({ text: 'third', appName: 'c.exe', date: d(9, 9) }));
  fs.rmSync(backupDir, { recursive: true, force: true }); // drop today's daily append backup (tested separately)
  const md = () => fs.readFileSync(file, 'utf8');
  const byQuote = (q) => store.read().entries.find((e) => e.quote === q);
  const backups = () => (fs.existsSync(backupDir) ? fs.readdirSync(backupDir) : []);
  const done = () => fs.rmSync(root, { recursive: true, force: true });
  return { store, file, md, byQuote, backups, backupDir, done };
}

test('read: entries newest first, missing file = empty', () => {
  const t = setup();
  const r = t.store.read();
  assert.deepEqual(r.entries.map((e) => e.quote), ['third', 'second', 'first']);
  assert.equal(r.file, t.file);
  fs.unlinkSync(t.file);
  assert.deepEqual(t.store.read().entries, []);
  t.done();
});

test('update rewrites only that entry, keeps date/app, backs up first', () => {
  const t = setup();
  const before = t.md();
  const e = t.byQuote('first');
  const r = t.store.update(e.key, { thought: 'edited #b' });
  assert.equal(r.ok, true);
  assert.equal(typeof r.undo, 'string');
  const after = t.md();
  const expected = before.replace(
    formatEntry({ text: 'first', thought: 'one #a', appName: 'a.exe', date: d(9, 0) }),
    formatEntry({ text: 'first', thought: 'edited #b', appName: 'a.exe', date: d(9, 0) }));
  assert.equal(after, expected);
  assert.equal(t.byQuote('first').key, r.key);
  assert.deepEqual(t.byQuote('first').tags, ['#b']);
  const b = t.backups();
  assert.equal(b.length, 1);
  assert.match(b[0], /^tuck\.md-\d{8}-\d{6}\.md$/);
  assert.equal(fs.readFileSync(path.join(t.backupDir, b[0]), 'utf8'), before);
  assert.deepEqual(fs.readdirSync(path.dirname(t.file)), ['tuck.md']); // no tmp file left behind
  t.done();
});

test('update can change the quote; empty quote is refused', () => {
  const t = setup();
  const k = t.byQuote('second').key;
  assert.deepEqual(t.store.update(k, { quote: '  ' }), { ok: false, error: 'invalid' });
  assert.equal(t.store.update(k, { quote: 'line 1\nline 2' }).ok, true);
  assert.ok(t.md().includes('### 2026-10-16 09:05\n> line 1\n> line 2\n\n---\n\n'));
  t.done();
});

test('remove + undo restores exact previous content', () => {
  const t = setup();
  const before = t.md();
  const r = t.store.remove(t.byQuote('second').key);
  assert.equal(r.ok, true);
  assert.deepEqual(t.store.read().entries.map((e) => e.quote), ['third', 'first']);
  assert.equal(t.store.undo(r.undo).ok, true);
  assert.equal(t.md(), before);
  assert.deepEqual(t.store.undo(r.undo), { ok: false, error: 'expired' }); // one-shot
  t.done();
});

test('undo after a later append re-inserts at the right place', () => {
  const t = setup();
  const r = t.store.remove(t.byQuote('second').key);
  t.store.append(formatEntry({ text: 'fourth', date: d(9, 20) }));
  assert.equal(t.store.undo(r.undo).ok, true);
  assert.deepEqual(t.store.read().entries.map((e) => e.quote), ['fourth', 'third', 'second', 'first']);

  const u = t.store.update(t.byQuote('third').key, { thought: 'x' });
  t.store.append(formatEntry({ text: 'fifth', date: d(9, 30) }));
  assert.equal(t.store.undo(u.undo).ok, true);
  assert.equal(t.byQuote('third').thought, '');
  assert.equal(t.byQuote('fifth').quote, 'fifth');
  t.done();
});

test('removing the newest entry then appending: undo puts it back before the later one', () => {
  const t = setup();
  const r = t.store.remove(t.byQuote('third').key);
  t.store.append(formatEntry({ text: 'later', date: d(10, 0) }));
  assert.equal(t.store.undo(r.undo).ok, true);
  assert.deepEqual(t.store.read().entries.map((e) => e.quote), ['later', 'third', 'second', 'first']);
  t.done();
});

test('conflict: entry changed on disk -> ok:false changed, file untouched', () => {
  const t = setup();
  const e = t.byQuote('first');
  fs.writeFileSync(t.file, t.md().replace('one #a', 'hand edited'), 'utf8');
  const before = t.md();
  assert.deepEqual(t.store.update(e.key, { thought: 'x' }), { ok: false, error: 'changed' });
  assert.deepEqual(t.store.remove(e.key), { ok: false, error: 'changed' });
  assert.equal(t.md(), before);
  assert.equal(t.backups().length, 0);

  // undo of an edit whose result was hand-edited away cannot apply
  const k = t.byQuote('second').key;
  const u = t.store.update(k, { thought: 'mine' });
  fs.writeFileSync(t.file, t.md().replace('mine', 'theirs'), 'utf8');
  assert.deepEqual(t.store.undo(u.undo), { ok: false, error: 'changed' });
  t.done();
});

test('CRLF file (edited in Notepad) keeps other entries byte-identical', () => {
  const t = setup();
  fs.writeFileSync(t.file, t.md().replace(/\n/g, '\r\n'), 'utf8');
  const before = t.md();
  const e = t.byQuote('second');
  assert.equal(t.store.remove(e.key).ok, true);
  assert.equal(t.md(), before.slice(0, e.raw.start) + before.slice(e.raw.end));
  t.done();
});

test('keeps only the newest 20 backups', () => {
  const t = setup();
  fs.mkdirSync(t.backupDir, { recursive: true });
  for (let i = 0; i < 25; i++) {
    const f = path.join(t.backupDir, `tuck.md-20200101-0000${String(i).padStart(2, '0')}.md`);
    fs.writeFileSync(f, 'old');
    fs.utimesSync(f, new Date(2020, 0, 1, 0, 0, i), new Date(2020, 0, 1, 0, 0, i));
  }
  fs.writeFileSync(path.join(t.backupDir, 'unrelated.txt'), 'keep');
  t.store.remove(t.byQuote('first').key);
  const b = t.backups().filter((n) => n.startsWith('tuck.md-'));
  assert.equal(b.length, 20);
  assert.ok(!b.includes('tuck.md-20200101-000000.md'));
  assert.ok(t.backups().includes('unrelated.txt'));
  t.done();
});

test('append makes one backup per day of an existing file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tuck-store-'));
  const dir = path.join(root, 'n'), backupDir = path.join(root, 'b');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'tuck.md'), '# Tuck\n\nold');
  const store = createNotesStore({ getPaths: () => ({ dir, file: 'tuck.md' }), backupDir, logger: null });
  store.append('A');
  store.append('B');
  const b = fs.readdirSync(backupDir);
  assert.equal(b.length, 1);
  assert.equal(fs.readFileSync(path.join(backupDir, b[0]), 'utf8'), '# Tuck\n\nold');
  assert.match(b[0], /^tuck\.md-\d{8}-\d{6}-daily\.md$/);
  assert.equal(fs.readFileSync(path.join(dir, 'tuck.md'), 'utf8'), '# Tuck\n\nold\n\nA\n\nB');
  // a fresh store (app restart) on the same day does not back up again
  createNotesStore({ getPaths: () => ({ dir, file: 'tuck.md' }), backupDir, logger: null }).append('C');
  assert.equal(fs.readdirSync(backupDir).length, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('daily backups are a separate pool: many edits never prune them', () => {
  const t = setup();
  fs.mkdirSync(t.backupDir, { recursive: true });
  const daily = path.join(t.backupDir, 'tuck.md-20200101-000000-daily.md');
  fs.writeFileSync(daily, 'day start');
  fs.utimesSync(daily, new Date(2020, 0, 1), new Date(2020, 0, 1));
  for (let i = 0; i < 25; i++) {
    const k = t.byQuote('third').key;
    assert.equal(t.store.update(k, { thought: 'n' + i }).ok, true);
  }
  assert.ok(fs.existsSync(daily));
  assert.equal(t.backups().filter((n) => !n.includes('-daily')).length, 20);
  t.done();
});

test('edit/remove keep user text after the separator; unparsed lines refuse edits', () => {
  const t = setup();
  const extra = 'my own paragraph\n\n## Week 42\n\n';
  const first = formatEntry({ text: 'first', thought: 'one #a', appName: 'a.exe', date: d(9, 0) });
  fs.writeFileSync(t.file, t.md().replace(first, first + extra));
  assert.equal(t.store.update(t.byQuote('first').key, { quote: 'first!' }).ok, true);
  assert.ok(t.md().includes(formatEntry({ text: 'first!', thought: 'one #a', appName: 'a.exe', date: d(9, 0) }) + extra));
  const r = t.store.remove(t.byQuote('first!').key);
  assert.equal(r.ok, true);
  assert.ok(t.md().includes(extra));
  assert.equal(t.store.undo(r.undo).ok, true);
  // a stray line inside an entry body (hand edit) -> edit refused, file untouched
  fs.writeFileSync(t.file, t.md().replace('> second\n', '> second\nstray line\n'));
  const before = t.md();
  assert.deepEqual(t.store.update(t.byQuote('second').key, { thought: 'x' }), { ok: false, error: 'unparsable' });
  assert.equal(t.md(), before);
  t.done();
});

test('old thought containing a "---" line: editing the quote keeps the rest of it', () => {
  const t = setup();
  const md = t.md() + '### 2026-10-16 10:00 · x.exe\n> q\n\n**My thought**: top\n---\nhidden rest\n\n---\n\n';
  fs.writeFileSync(t.file, md);
  assert.equal(t.store.update(t.byQuote('q').key, { quote: 'q2' }).ok, true);
  assert.ok(t.md().includes('hidden rest'));
  t.done();
});

test('undo after the notes file changed location -> changed, new file untouched', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tuck-store-'));
  let dir = path.join(root, 'a');
  const store = createNotesStore({ getPaths: () => ({ dir, file: 'tuck.md' }), backupDir: path.join(root, 'b'), logger: null });
  store.append(formatEntry({ text: 'one', date: d(9, 0) }));
  const r = store.remove(store.read().entries[0].key);
  dir = path.join(root, 'c');
  store.append(formatEntry({ text: 'two', date: d(9, 1) }));
  const before = fs.readFileSync(path.join(dir, 'tuck.md'), 'utf8');
  assert.deepEqual(store.undo(r.undo), { ok: false, error: 'changed' });
  assert.equal(fs.readFileSync(path.join(dir, 'tuck.md'), 'utf8'), before);
  fs.rmSync(root, { recursive: true, force: true });
});

test('writeFileAtomic replaces content and leaves no tmp file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tuck-atomic-'));
  const f = path.join(root, 'sub', 'x.md');
  writeFileAtomic(f, 'one');
  writeFileAtomic(f, 'two ✓');
  assert.equal(fs.readFileSync(f, 'utf8'), 'two ✓');
  assert.deepEqual(fs.readdirSync(path.dirname(f)), ['x.md']);
  fs.rmSync(root, { recursive: true, force: true });
});
