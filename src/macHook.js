'use strict';
// Mac App Store key hook: the native/mac listen-only tap (Input Monitoring) behind uiohook-napi's interface,
// so keys.js and main.js startHook work unchanged. The addon loads lazily: requiring this file on Windows
// (tests) never touches it.
const path = require('path');
const { EventEmitter } = require('events');

// Same values as uiohook-napi's UiohookKey for the keys Tuck uses
const UiohookKey = { C: 46, Ctrl: 29, CtrlRight: 3613, Shift: 42, ShiftRight: 54, Alt: 56, AltRight: 3640, Meta: 3675, MetaRight: 3676 };

// macOS virtual keycode -> [uiohook keycode, device-dependent modifier bit (flagsChanged only)]
const VK = {
  8: [UiohookKey.C],
  55: [UiohookKey.Meta, 0x08], 54: [UiohookKey.MetaRight, 0x10],
  59: [UiohookKey.Ctrl, 0x01], 62: [UiohookKey.CtrlRight, 0x2000],
  56: [UiohookKey.Shift, 0x02], 60: [UiohookKey.ShiftRight, 0x04],
  58: [UiohookKey.Alt, 0x20], 61: [UiohookKey.AltRight, 0x40],
};

let addon = null;
function native() {
  if (!addon) addon = require(path.join(__dirname, '..', 'native', 'mac', 'build', 'Release', 'tuck_mac.node'));
  return addon;
}

// Pure. kind 0=keydown 1=keyup 2=flagsChanged; flags = CGEventFlags as a Number (bits < 2^32, so & is safe).
function translate(kind, vk, flags) {
  const m = VK[vk];
  let type;
  if (kind === 0) type = 'keydown';
  else if (kind === 1) type = 'keyup';
  else if (kind === 2) {
    if (!m || !m[1]) return null; // caps lock, fn, ...: not keys Tuck tracks
    type = flags & m[1] ? 'keydown' : 'keyup';
  } else return null;
  return {
    type, keycode: m ? m[0] : 0x10000 + vk,
    metaKey: !!(flags & 0x100000), ctrlKey: !!(flags & 0x40000), shiftKey: !!(flags & 0x20000), altKey: !!(flags & 0x80000),
  };
}

const uIOhook = new EventEmitter();
uIOhook.start = () => {
  const n = native(); // outside the try: a missing/broken addon must not read as "permission needed"
  try {
    n.start((kind, vk, flags) => {
      const e = translate(kind, vk, flags);
      if (e) uIOhook.emit(e.type, e);
    });
  } catch (e) {
    e.code = 'TUCK_NO_INPUT_MONITORING'; // main.js shows the permission prompt instead of an error dialog
    throw e;
  }
};
uIOhook.stop = () => { if (addon) addon.stop(); };

module.exports = { uIOhook, UiohookKey, translate, native };
