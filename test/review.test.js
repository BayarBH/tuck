'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { dailyPick, onThisDay, weekly, truncate, createReviewScheduler } = require('../src/review');
const { formatEntry } = require('../src/notesWriter');
const { parseNotes } = require('../src/notesReader');
const { buildMarkdown } = require('../src/export');

const e = (date, quote, extra = {}) => ({ date, time: '10:00', app: '', quote, thought: '', tags: [], key: quote, ...extra });

test('dailyPick: stable per day, prefers notes older than 3 days, never today', () => {
  const list = [e('2026-10-17', 'today'), e('2026-10-15', 'recent'), e('2026-10-01', 'old1'), e('2026-09-20', 'old2'), e('2026-08-02', 'old3')];
  const p = dailyPick(list, '2026-10-17');
  assert.ok(['old1', 'old2', 'old3'].includes(p.quote));
  assert.equal(dailyPick(list.slice().reverse(), '2026-10-17').quote, p.quote); // order-independent
  const picks = new Set(['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'].map((d) => dailyPick(list, d).quote));
  assert.ok(picks.size > 1, 'varies across days');
  // only recent past notes: falls back to them
  assert.equal(dailyPick([e('2026-10-17', 'today'), e('2026-10-16', 'yday')], '2026-10-17').quote, 'yday');
  assert.equal(dailyPick([e('2026-10-17', 'today')], '2026-10-17'), null);
  assert.equal(dailyPick([], '2026-10-17'), null);
  assert.equal(dailyPick(list, 'nope'), null);
});

test('onThisDay: same day-of-month in earlier months and years, newest first', () => {
  const list = [e('2026-10-17', 'today'), e('2026-09-17', 'm1'), e('2026-04-17', 'm6'), e('2025-10-17', 'y1'), e('2024-10-17', 'y2'), e('2026-09-16', 'other'), e('2026-11-17', 'future')];
  const r = onThisDay(list, '2026-10-17');
  assert.deepEqual(r.map((x) => x.quote), ['m1', 'm6', 'y1', 'y2']);
  assert.deepEqual(r.map((x) => x.ago), ['1 month ago', '6 months ago', '1 year ago', '2 years ago']);
  assert.deepEqual(onThisDay(list, ''), []);
});

test('weekly: Monday..Sunday window with counts, top tags and sources', () => {
  const now = new Date(2026, 9, 17, 15, 0); // Saturday
  const list = [
    e('2026-10-12', 'mon', { tags: ['#a'], app: 'chrome.exe', thought: 'x #a' }),
    e('2026-10-17', 'sat1', { tags: ['#a', '#b'], app: 'chrome.exe', thought: '#a #b' }),
    e('2026-10-17', 'sat2', { app: 'code.exe' }),
    e('2026-10-11', 'lastSun', { tags: ['#z'] }),
  ];
  const w = weekly(list, now);
  assert.equal(w.start, '2026-10-12');
  assert.equal(w.end, '2026-10-18');
  assert.equal(w.count, 3);
  assert.equal(w.withThought, 2);
  assert.equal(w.activeDays, 2);
  assert.deepEqual(w.days.map((d) => d.n), [1, 0, 0, 0, 0, 2, 0]);
  assert.deepEqual(w.tags, [['#a', 2], ['#b', 1]]);
  assert.deepEqual(w.apps, [['chrome.exe', 2], ['code.exe', 1]]);
  assert.equal(weekly(list, new Date(2026, 9, 18)).start, '2026-10-12'); // Sunday belongs to the same week
});

test('truncate: collapses whitespace, adds ellipsis', () => {
  assert.equal(truncate('a\n b', 120), 'a b');
  assert.equal(truncate('abcdef', 4), 'abc…');
});

test('buildMarkdown: exports chosen entries verbatim in file order, re-parses the same', () => {
  const d = (h) => new Date(2026, 9, 16, h, 0);
  const md = '# Tuck\r\n\r\n' + [
    formatEntry({ text: 'one', thought: 'hi #x', appName: 'a.exe', date: d(9) }),
    formatEntry({ text: 'two', date: d(10) }),
    formatEntry({ text: 'three\nlines', date: d(11) }),
  ].join('').replace(/\n/g, '\r\n');
  const entries = parseNotes(md);
  const keys = entries.filter((x) => x.quote !== 'two').map((x) => x.key);
  const out = buildMarkdown(md, keys, '#x');
  assert.ok(out.startsWith('# Tuck: #x\n\n### 2026-10-16 09:00 · a.exe\n'));
  assert.ok(!out.includes('\r'));
  const back = parseNotes(out);
  assert.deepEqual(back.map((x) => x.quote), ['three\nlines', 'one']);
  assert.deepEqual(back[1].tags, ['#x']);
  assert.equal(buildMarkdown(md, [], ''), '# Tuck\n\n');
});

test('review scheduler: once a day, within an hour after the set time, only when enabled', () => {
  const shown = [];
  class N {
    static isSupported() { return true; }
    constructor(o) { this.o = o; }
    on() {}
    show() { shown.push(this.o.body); }
  }
  const conf = { dailyNotification: false, dailyNotificationTime: '09:00' };
  const long = 'x'.repeat(300);
  const ctx = {
    settings: { get: (k) => conf[k] },
    store: { read: () => ({ entries: [e('2026-10-01', long)] }) },
    logger: { error() {} },
    openNotebook() {},
  };
  const s = createReviewScheduler(ctx, { Notification: N });
  s.tick(new Date(2026, 9, 17, 9, 5));
  assert.equal(shown.length, 0, 'disabled');
  conf.dailyNotification = true;
  s.tick(new Date(2026, 9, 17, 8, 59));
  assert.equal(shown.length, 0, 'too early');
  s.tick(new Date(2026, 9, 17, 9, 5));
  assert.equal(shown.length, 1);
  assert.equal([...shown[0]].length, 120);
  s.tick(new Date(2026, 9, 17, 9, 30));
  assert.equal(shown.length, 1, 'once per day');
  s.tick(new Date(2026, 9, 18, 10, 0));
  assert.equal(shown.length, 1, 'more than an hour late');
  s.tick(new Date(2026, 9, 19, 9, 0));
  assert.equal(shown.length, 2);
});
