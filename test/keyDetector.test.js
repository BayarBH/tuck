'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createKeyDetector } = require('../src/keyDetector');

const LONG = 600, GAP = 1000;
const mk = () => createKeyDetector({ longPressMs: LONG, doubleGapMs: GAP });
const down = (time, mods = { ctrl: true }) => ({ type: 'keydown', key: 'c', time, ctrl: false, shift: false, alt: false, meta: false, ...mods });
const up = (time, mods = { ctrl: true }) => ({ ...down(time, mods), type: 'keyup' });
const ctrlUp = (time) => ({ type: 'keyup', key: 'ctrl', time, ctrl: false, shift: false, alt: false, meta: false });
const other = (time) => ({ type: 'keydown', key: 'other', time, ctrl: true, shift: false, alt: false, meta: false });

// feed events in order, collect non-null outputs
function run(d, events) {
  const out = [];
  for (const e of events) {
    const r = typeof e === 'number' ? d.tick(e) : d.handle(e);
    if (r) out.push(r);
  }
  return out;
}

test('single tap: no trigger', () => {
  const d = mk();
  assert.deepEqual(run(d, [down(0), 50, up(100), 200, 2000, 5000]), []);
});

test('double tap triggers double once', () => {
  assert.deepEqual(run(mk(), [down(0), up(80), down(300), up(380), 500, 2000]), ['double']);
});

test('gap >= DOUBLE_GAP_MS: no trigger', () => {
  assert.deepEqual(run(mk(), [down(0), up(80), down(GAP), up(GAP + 80)]), []);
  assert.deepEqual(run(mk(), [down(0), up(80), down(GAP + 500), up(GAP + 580)]), []);
});

test('long press via tick fires exactly once', () => {
  const ev = [down(0)];
  for (let t = 30; t <= 2000; t += 30) ev.push(t);
  ev.push(up(2010));
  assert.deepEqual(run(mk(), ev), ['long']);
});

test('long press via many auto-repeat keydowns fires once', () => {
  const ev = [down(0)];
  for (let t = 500; t <= 3000; t += 33) ev.push(down(t));
  ev.push(up(3010));
  assert.deepEqual(run(mk(), ev), ['long']);
});

test('auto-repeat during short hold does not create second press / double', () => {
  // hold 550ms (some auto-repeats), release: nothing fires
  assert.deepEqual(run(mk(), [down(0), down(500), down(533), up(550)]), []);
  // short press with auto-repeat, then another short press: two real presses -> exactly one double
  assert.deepEqual(run(mk(), [down(0), down(500), up(550), down(700), up(760)]), ['double']);
});

test('Ctrl+Shift+C / Ctrl+Alt+C / Ctrl+Win+C / plain C ignored', () => {
  for (const mods of [{ ctrl: true, shift: true }, { ctrl: true, alt: true }, { ctrl: true, meta: true }, {}]) {
    const ev = [down(0, mods), up(80, mods), down(200, mods), 900, up(1000, mods)];
    assert.deepEqual(run(mk(), ev), [], JSON.stringify(mods));
  }
});

test('modified C between taps clears pending double', () => {
  assert.deepEqual(run(mk(), [down(0), up(80), down(200, { ctrl: true, shift: true }), up(250, { ctrl: true, shift: true }), down(400), up(450)]), []);
});

test('other key between taps clears pending; ctrl re-press does not', () => {
  assert.deepEqual(run(mk(), [down(0), up(80), other(150), down(300), up(350)]), []);
  assert.deepEqual(run(mk(), [down(0), up(80), ctrlUp(120), down(300), up(350)]), ['double']);
});

test('releasing ctrl during hold cancels long', () => {
  const ev = [down(0), ctrlUp(300)];
  for (let t = 330; t <= 1500; t += 30) ev.push(t);
  ev.push(down(700, { ctrl: false }), up(1500, { ctrl: false }));
  assert.deepEqual(run(mk(), ev), []);
});

test('long press then tap does not produce double', () => {
  assert.deepEqual(run(mk(), [down(0), 600, up(700), down(800), up(850)]), ['long']);
});

test('3 taps produce one double', () => {
  assert.deepEqual(run(mk(), [down(0), up(50), down(200), up(250), down(400), up(450)]), ['double']);
});

test('reset clears pending', () => {
  const d = mk();
  run(d, [down(0), up(50)]);
  d.reset();
  assert.deepEqual(run(d, [down(200), up(250)]), []);
});
