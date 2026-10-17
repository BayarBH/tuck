'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { translate, UiohookKey: K } = require('../src/macHook');

const CMD = 0x100000, CTRL = 0x40000, SHIFT = 0x20000, ALT = 0x80000;
const none = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

test('C keydown/keyup with Command held', () => {
  assert.deepEqual(translate(0, 8, CMD | 0x08), { type: 'keydown', keycode: K.C, ...none, metaKey: true });
  assert.deepEqual(translate(1, 8, 0), { type: 'keyup', keycode: K.C, ...none });
});

test('left/right Command via flagsChanged', () => {
  assert.deepEqual(translate(2, 55, CMD | 0x08), { type: 'keydown', keycode: K.Meta, ...none, metaKey: true });
  assert.deepEqual(translate(2, 55, 0), { type: 'keyup', keycode: K.Meta, ...none });
  assert.deepEqual(translate(2, 54, CMD | 0x10), { type: 'keydown', keycode: K.MetaRight, ...none, metaKey: true });
  // right released while left still held: device bit decides, not the shared Command flag
  assert.equal(translate(2, 54, CMD | 0x08).type, 'keyup');
});

test('Control, Shift, Option via flagsChanged', () => {
  assert.deepEqual(translate(2, 59, CTRL | 0x01), { type: 'keydown', keycode: K.Ctrl, ...none, ctrlKey: true });
  assert.equal(translate(2, 59, 0).type, 'keyup');
  assert.equal(translate(2, 62, CTRL | 0x2000).keycode, K.CtrlRight);
  assert.equal(translate(2, 62, CTRL | 0x2000).type, 'keydown');
  assert.equal(translate(2, 56, SHIFT | 0x02).keycode, K.Shift);
  assert.equal(translate(2, 60, SHIFT | 0x04).keycode, K.ShiftRight);
  assert.equal(translate(2, 58, ALT | 0x20).keycode, K.Alt);
  assert.equal(translate(2, 61, ALT | 0x40).type, 'keydown');
});

test('unknown flagsChanged and other keys', () => {
  assert.equal(translate(2, 57, 0x10000), null); // caps lock
  assert.equal(translate(2, 63, 0x800000), null); // fn
  assert.equal(translate(0, 0, 0).keycode, 0x10000); // 'a' is not a uiohook key Tuck knows
  assert.equal(translate(0, 9, 0).keycode, 0x10009);
  assert.equal(translate(5, 8, 0), null);
});

test('event flag booleans', () => {
  assert.deepEqual(translate(0, 8, CMD | CTRL | SHIFT | ALT),
    { type: 'keydown', keycode: K.C, metaKey: true, ctrlKey: true, shiftKey: true, altKey: true });
  assert.deepEqual(translate(0, 8, 0x100), { type: 'keydown', keycode: K.C, ...none }); // non-coalesced bit only
});

test('UiohookKey matches uiohook-napi', () => {
  const U = require('uiohook-napi').UiohookKey;
  for (const k of ['C', 'Ctrl', 'CtrlRight', 'Shift', 'ShiftRight', 'Alt', 'AltRight', 'Meta', 'MetaRight']) {
    assert.equal(K[k], U[k], k);
  }
});
