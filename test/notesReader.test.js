'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { formatEntry } = require('../src/notesWriter');
const { parseNotes } = require('../src/notesReader');

const d = (h, min) => new Date(2026, 9, 16, h, min);

test('round-trips entries written by formatEntry, newest first', () => {
  const md = '# Tuck\n\n'
    + formatEntry({ text: 'line one\r\n\r\nline two', thought: 'nice #right_problem #产品', appName: 'chrome.exe', date: d(23, 10) })
    + formatEntry({ text: 'only quote', thought: '', appName: '', date: d(23, 12) })
    + formatEntry({ text: 'q', thought: 'first\nsecond', appName: 'claude.exe', date: d(23, 15) });
  const e = parseNotes(md);
  assert.equal(e.length, 3);
  assert.deepEqual(e[2], { id: 0, date: '2026-10-16', time: '23:10', app: 'chrome.exe', quote: 'line one\n\nline two', thought: 'nice #right_problem #产品', tags: ['#right_problem', '#产品'] });
  assert.deepEqual(e[1], { id: 1, date: '2026-10-16', time: '23:12', app: '', quote: 'only quote', thought: '', tags: [] });
  assert.equal(e[0].thought, 'first\nsecond');
  assert.equal(e[0].app, 'claude.exe');
});

test('empty or header-only file gives no entries', () => {
  assert.deepEqual(parseNotes(''), []);
  assert.deepEqual(parseNotes('# Tuck\n\n'), []);
});

test('hand-edited entry without tags line still gets tags from thought', () => {
  const e = parseNotes('### 2026-10-16 09:00\n> x\n\n**My thought**: see #idea\n\n---\n');
  assert.deepEqual(e[0].tags, ['#idea']);
});
