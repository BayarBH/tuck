'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { extractTags, formatTime, formatEntry, appendEntry, createDeduper } = require('../src/notesWriter');

const date = new Date(2026, 9, 16, 23, 10);

test('formatTime local', () => {
  assert.strictEqual(formatTime(new Date(2026, 0, 5, 7, 3)), '2026-01-05 07:03');
});

test('SPEC example exact', () => {
  const e = formatEntry({ text: 'line one\nline two', thought: 'nice #right_problem #产品', appName: 'chrome.exe', date });
  assert.strictEqual(e,
    '### 2026-10-16 23:10 · chrome.exe\n> line one\n> line two\n\n**My thought**: nice #right_problem #产品\n**Tags**: #right_problem #产品\n\n---\n\n');
});

test('CRLF, CR, blank lines, trailing newlines', () => {
  const e = formatEntry({ text: 'a\r\n\r\nb\rc\r\n\n', date });
  assert.strictEqual(e, '### 2026-10-16 23:10\n> a\n>\n> b\n> c\n\n---\n\n');
});

test('tags: CJK/English/underscore/dedupe', () => {
  assert.deepStrictEqual(extractTags('#产品 and #idea_1, #产品 #Right_problem。'), ['#产品', '#idea_1', '#Right_problem']);
  assert.deepStrictEqual(extractTags('no tags # here'), []);
});

test('no thought -> no thought/tags lines; no appName -> no dot', () => {
  const e = formatEntry({ text: 'x', thought: '   ', date });
  assert.ok(!e.includes('My thought') && !e.includes('Tags') && !e.includes(' · '));
});

test('thought without tags -> no tags line', () => {
  const e = formatEntry({ text: 'x', thought: 'first\nsecond', appName: 'a.exe', date });
  assert.strictEqual(e, '### 2026-10-16 23:10 · a.exe\n> x\n\n**My thought**: first\nsecond\n\n---\n\n');
});

test('appendEntry creates dir and header once', () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zhailu-')), 'sub', 'deep');
  const p1 = appendEntry('E1', { dir, file: 'excerpts.md' });
  const p2 = appendEntry('E2', { dir, file: 'excerpts.md' });
  assert.strictEqual(p1, p2);
  assert.ok(path.isAbsolute(p1));
  const buf = fs.readFileSync(p1);
  assert.notStrictEqual(buf[0], 0xef); // no BOM
  assert.strictEqual(buf.toString('utf8'), '# Excerpts\n\nE1E2');
  fs.rmSync(path.dirname(path.dirname(dir)), { recursive: true, force: true });
});

test('deduper window', () => {
  const d = createDeduper(3000);
  assert.strictEqual(d.isDuplicate('a', 0), false);
  d.markSaved('a', 1000);
  assert.strictEqual(d.isDuplicate('a', 3999), true);
  assert.strictEqual(d.isDuplicate('b', 2000), false);
  assert.strictEqual(d.isDuplicate('a', 4000), false);
});
