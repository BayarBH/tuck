'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { clean, fromCfHtml, read } = require('../src/sourceUrl');
const { formatEntry } = require('../src/notesWriter');
const { parseNotes } = require('../src/notesReader');
const { createNotesStore } = require('../src/notesStore');
const { parseVaults, vaultOf, openUri } = require('../src/obsidian');

// header as Chromium writes it (seen with Electron's own copy)
const CF = 'Version:0.9\r\nStartHTML:0000000160\r\nEndHTML:0000000795\r\nStartFragment:0000000196\r\nEndFragment:0000000759\r\n'
  + 'SourceURL:https://user:pw@example.com/essay?x=1#top\r\n<html>\r\n<body>\r\n<!--StartFragment-->SourceURL:https://evil.test/<!--EndFragment-->';

test('source url: CF_HTML header, http(s) only, no credentials, never from the markup', () => {
  assert.equal(fromCfHtml(CF), 'https://example.com/essay?x=1#top');
  assert.equal(fromCfHtml(CF.replace(/SourceURL:[^\r]*\r\n/, '')), null); // only the fragment has one
  assert.equal(fromCfHtml('Version:0.9\r\nSourceURL:about:blank\r\n<html>'), null);
  assert.equal(fromCfHtml(''), null);
  assert.equal(clean('file:///C:/x.html'), null);
  assert.equal(clean('javascript:alert(1)'), null);
  assert.equal(clean('https://a.test/' + 'x'.repeat(3000)), null);
  assert.equal(clean('http://a.test/\u0000'), 'http://a.test/');
  const cb = (map) => ({ readBuffer: (f) => Buffer.from(map[f] || '') });
  assert.equal(read(cb({ 'HTML Format': CF }), 'win32'), 'https://example.com/essay?x=1#top');
  assert.equal(read(cb({ 'org.chromium.source-url': 'https://m.test/a' }), 'darwin'), 'https://m.test/a');
  assert.equal(read({ readBuffer: () => { throw new Error('x'); } }, 'win32'), null);
});

test('source link: written under the quote, parsed back, kept by edits, and old keys unchanged', () => {
  const date = new Date(2026, 9, 17, 10, 42);
  const withSrc = formatEntry({ text: 'q', thought: 'why #t', appName: 'chrome.exe', date, source: 'https://a.test/p' });
  assert.match(withSrc, /^> q\n\n\*\*Source\*\*: https:\/\/a\.test\/p\n\n\*\*My thought\*\*: why #t\n/m);
  const [e] = parseNotes(withSrc);
  assert.deepEqual([e.source, e.quote, e.thought, e.tags, e.raw.skipped], ['https://a.test/p', 'q', 'why #t', ['#t'], 0]);
  const plain = parseNotes(formatEntry({ text: 'q', thought: 'why #t', appName: 'chrome.exe', date }))[0];
  assert.equal(plain.source, '');
  assert.notEqual(plain.key, e.key);
  // a thought line that looks like a source line is escaped, so it stays thought text
  const [f] = parseNotes(formatEntry({ text: 'q', thought: 'a\n**Source**: x', date }));
  assert.deepEqual([f.source, f.thought], ['', 'a\n **Source**: x']);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tuck-src-'));
  const dir = path.join(root, 'notes');
  const store = createNotesStore({ getPaths: () => ({ dir, file: 'tuck.md' }), backupDir: path.join(root, 'b'), logger: null });
  store.append(withSrc);
  const r = store.update(store.read().entries[0].key, { thought: 'edited' });
  assert.equal(r.ok, true);
  assert.equal(store.read().entries[0].source, 'https://a.test/p');
  fs.rmSync(root, { recursive: true, force: true });
});

test('obsidian: vault list, containing vault, open uri', () => {
  const root = path.resolve('/vaults');
  const json = JSON.stringify({ vaults: {
    a: { path: path.join(root, 'Old'), ts: 1 }, b: { path: path.join(root, 'Main'), ts: 9, open: true }, c: { path: 'relative' }, d: null,
  } });
  const v = parseVaults(json);
  assert.deepEqual(v.map((x) => x.name), ['Main', 'Old']);
  assert.deepEqual(parseVaults('{bad'), []);
  assert.deepEqual(parseVaults('{}'), []);
  assert.equal(vaultOf(path.join(root, 'Main', 'Tuck'), v, 'win32').name, 'Main');
  assert.equal(vaultOf(path.join(root, 'main'), v, 'win32').name, 'Main'); // case-insensitive
  assert.equal(vaultOf(path.join(root, 'Mainly'), v, 'win32'), null);
  assert.equal(vaultOf(root, v, 'win32'), null);
  assert.equal(openUri('C:\\V\\Tuck\\tuck.md'), 'obsidian://open?path=C%3A%5CV%5CTuck%5Ctuck.md');
});
