'use strict';
const path = require('path');
const { BrowserWindow, ipcMain } = require('electron');
const { frameOptions, followTheme } = require('./frame');
const { appIcon } = require('./trayIcon');

// First-run tutorial window. Steps 2/3 are real: main calls notifyCapture(mode) after every successful save,
// and the page advances when the expected gesture arrives. Closing or skipping marks onboarding as done.
// On macOS a permission step comes first: practice only works once Accessibility is granted.
function createOnboarding(ctx) {
  let w = null;
  const fromWin = (e) => w && !w.isDestroyed() && e.sender === w.webContents;

  ipcMain.handle('onboarding:info', (e) => {
    if (!fromWin(e)) return null;
    const { dir, file } = ctx.notes();
    return { notesPath: path.resolve(dir, file), longPressMs: ctx.settings.get('longPressMs') };
  });
  ipcMain.on('onboarding:open-notebook', (e) => { if (fromWin(e)) ctx.openNotebook(); });
  ipcMain.on('onboarding:done', (e) => { if (fromWin(e)) w.close(); });
  // macOS: the tutorial asks for Accessibility before the practice steps (ctx.permissions is always trusted on Windows)
  const perms = ctx.permissions;
  ipcMain.handle('onboarding:permission', (e) => (fromWin(e) ? perms.isTrusted() : null));
  ipcMain.on('onboarding:grant', (e) => {
    if (!fromWin(e)) return;
    perms.request();
    perms.openSettings();
  });
  perms.onChange(() => { if (w && !w.isDestroyed()) w.webContents.send('onboarding:permission-changed', perms.isTrusted()); });

  function markDone() {
    if (ctx.settings.get('onboardingDone')) return;
    try { ctx.settings.set({ onboardingDone: true }); } catch (e) { ctx.logger.error('onboarding', e); }
  }

  function open() {
    if (w && !w.isDestroyed()) {
      if (w.isMinimized()) w.restore();
      w.show();
      w.focus();
      return;
    }
    w = new BrowserWindow({
      width: 640, height: 520, useContentSize: true, center: true,
      resizable: false, maximizable: false, fullscreenable: false,
      title: 'Welcome to Tuck', icon: appIcon(), show: false, autoHideMenuBar: true,
      ...frameOptions(),
      webPreferences: { preload: path.join(__dirname, 'preload-onboarding.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    w.setMenu(null);
    followTheme(w);
    w.webContents.on('will-navigate', (e) => e.preventDefault());
    w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    w.once('ready-to-show', () => w.show());
    w.on('closed', () => { w = null; markDone(); });
    w.loadFile(path.join(__dirname, 'renderer', 'onboarding.html'));
  }

  return {
    open,
    maybeShowOnFirstRun() { if (!ctx.settings.get('onboardingDone')) open(); },
    notifyCapture(mode) { if (w && !w.isDestroyed()) w.webContents.send('onboarding:captured', mode); },
  };
}

module.exports = { createOnboarding };
