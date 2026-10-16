'use strict';
// Platform-aware labels, loaded before each page script. Every preload exposes `platform`.
// On macOS, any element with data-mac="…" gets that text instead of its Windows text. Page scripts
// use PLATFORM.combo('C') ("⌘C" / "Ctrl+C") for strings they build and PLATFORM.mod(event) for shortcuts.
// The CSS side uses the platform-<os> class that the preload puts on <html>.
const PLATFORM = (() => {
  const api = window.tuck || window.notebook || window.onboarding || window.tuckSettings || {};
  const isMac = api.platform === 'darwin';
  if (isMac) document.querySelectorAll('[data-mac]').forEach((n) => { n.textContent = n.dataset.mac; });
  return {
    isMac,
    sep: isMac ? '/' : '\\',
    combo: (key) => (isMac ? '⌘' + key : 'Ctrl+' + key),
    mod: (e) => (isMac ? e.metaKey : e.ctrlKey), // the shortcut modifier held in a keyboard event
  };
})();
