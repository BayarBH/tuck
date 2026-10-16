'use strict';
// Pure: maps uiohook keycodes to what keyDetector understands, per platform.
// Windows: Ctrl+C. macOS: Command+C, so Meta/MetaRight are fed as the 'ctrl' trigger modifier and the
// physical Control key is fed as the 'meta' (other) flag, which makes Ctrl+Cmd+C an ignored combination.
// K = uiohook-napi's UiohookKey (passed in so this stays testable without the native module).

function keyMap(platform, K) {
  const mac = platform === 'darwin';
  const trigger = mac ? [K.Meta, K.MetaRight] : [K.Ctrl, K.CtrlRight];
  const other = mac ? [K.Ctrl, K.CtrlRight] : [K.Meta, K.MetaRight];
  // group -> keycodes, and group -> uiohook event flag (e.ctrlKey ...) that reports the same physical keys
  const mods = { ctrl: trigger, shift: [K.Shift, K.ShiftRight], alt: [K.Alt, K.AltRight], meta: other };
  const flags = mac
    ? { ctrl: 'metaKey', shift: 'shiftKey', alt: 'altKey', meta: 'ctrlKey' }
    : { ctrl: 'ctrlKey', shift: 'shiftKey', alt: 'altKey', meta: 'metaKey' };
  const keyOf = (code) => (code === K.C ? 'c' : trigger.includes(code) ? 'ctrl' : 'other');
  return { keyOf, mods, flags };
}

module.exports = { keyMap };
