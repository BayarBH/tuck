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
  const strip = ({ key, raw, ...rest }) => rest;
  assert.deepEqual(strip(e[2]), { id: 0, date: '2026-10-16', time: '23:10', app: 'chrome.exe', quote: 'line one\n\nline two', thought: 'nice #right_problem #产品', tags: ['#right_problem', '#产品'] });
  assert.deepEqual(strip(e[1]), { id: 1, date: '2026-10-16', time: '23:12', app: '', quote: 'only quote', thought: '', tags: [] });
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

test('raw offsets cover each entry span, also with CRLF', () => {
  const a = formatEntry({ text: 'a', thought: 't', appName: 'x.exe', date: d(9, 0) });
  const b = formatEntry({ text: 'b', date: d(9, 1) });
  for (const nl of ['\n', '\r\n']) {
    const md = ('# Tuck\n\n' + a + b).replace(/\n/g, nl);
    const [eb, ea] = parseNotes(md);
    assert.equal(md.slice(ea.raw.start, ea.raw.end), a.replace(/\n/g, nl));
    assert.equal(md.slice(eb.raw.start, eb.raw.end), b.replace(/\n/g, nl));
    assert.equal(eb.raw.end, md.length);
    assert.equal(ea.thought, 't');
  }
});

test('keys: stable, content-based, 12 hex; duplicates get a suffix', () => {
  const a = formatEntry({ text: 'same', date: d(9, 0) });
  const k1 = parseNotes(a)[0].key;
  assert.match(k1, /^[0-9a-f]{12}$/);
  assert.equal(parseNotes('# Tuck\n\n' + formatEntry({ text: 'other', date: d(8, 0) }) + a).find((e) => e.quote === 'same').key, k1);
  assert.deepEqual(parseNotes(a + a + a).map((e) => e.key).reverse(), [k1, k1 + '-2', k1 + '-3']);
  assert.notEqual(parseNotes(formatEntry({ text: 'same', thought: 'x', date: d(9, 0) }))[0].key, k1);
});

