'use strict';
// Platform foreground/focus/clipboard helpers. API: getForeground() -> {hwnd, processName, title}|null,
// focusWindow(id) -> Promise<bool>, clipboardPrivate() -> Promise<true|false|null>, dispose(), setLogger(fn).
// darwin.js also has frontPid() (used only on macOS code paths in main.js).
module.exports = process.platform === 'darwin' ? require('./darwin') : require('./win32');
