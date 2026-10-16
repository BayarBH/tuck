'use strict';
const { nativeTheme } = require('electron');

// Windows: no system title bar; the native min/max/close buttons are drawn over the page in its own
// background color (matches --bg in notebook.css). Pages add a 40px drag strip (renderer/titlebar.css).
const BAR_H = 40;
const COLORS = {
  light: { bg: '#f6f2ea', symbol: '#5f574d' },
  dark: { bg: '#17161a', symbol: '#b9b1a6' },
};
const current = () => COLORS[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'];
const overlay = () => ({ color: current().bg, symbolColor: current().symbol, height: BAR_H });

function frameOptions() {
  return { backgroundColor: current().bg, titleBarStyle: 'hidden', titleBarOverlay: overlay() };
}

// keep the button colors in step with light/dark mode changes
function followTheme(win) {
  const apply = () => {
    if (win.isDestroyed()) return;
    win.setTitleBarOverlay(overlay());
    win.setBackgroundColor(current().bg);
  };
  nativeTheme.on('updated', apply);
  win.on('closed', () => nativeTheme.removeListener('updated', apply));
}

module.exports = { frameOptions, followTheme };
