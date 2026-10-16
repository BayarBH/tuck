'use strict';
// Pure state machine: keydown/keyup events in, 'double' | 'long' | null out. No timers, no IO.

function createKeyDetector({ longPressMs, doubleGapMs }) {
  let cDown = false;      // c currently held (any modifiers)
  let valid = false;      // this press is a plain Ctrl+C
  let pressStart = 0;
  let longFired = false;
  let cancelled = false;  // ctrl released during hold -> no long
  let pending = null;     // keydown time of the previous short press

  function checkLong(time) {
    if (cDown && valid && !longFired && !cancelled && time - pressStart >= longPressMs) {
      longFired = true;
      return 'long';
    }
    return null;
  }

  function handle(evt) {
    const { type, key, time } = evt;
    if (key === 'ctrl') {
      if (type === 'keyup' && cDown) cancelled = true;
      return null;
    }
    if (key !== 'c') {
      if (type === 'keydown') pending = null;
      return null;
    }
    if (type === 'keydown') {
      if (cDown) { // OS auto-repeat
        if (!evt.ctrl) cancelled = true;
        return checkLong(time);
      }
      cDown = true;
      valid = !!evt.ctrl && !evt.shift && !evt.alt && !evt.meta;
      if (!valid) { pending = null; return null; }
      pressStart = time;
      longFired = false;
      cancelled = false;
      return null;
    }
    // keyup c
    if (!cDown) return null;
    cDown = false;
    if (!valid) return null;
    if (longFired || time - pressStart >= longPressMs) { pending = null; return null; }
    if (pending !== null && pressStart - pending < doubleGapMs) { pending = null; return 'double'; }
    pending = pressStart;
    return null;
  }

  function reset() {
    cDown = valid = longFired = cancelled = false;
    pressStart = 0;
    pending = null;
  }

  return { handle, tick: checkLong, reset };
}

module.exports = { createKeyDetector };
