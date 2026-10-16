'use strict';
const path = require('path');
const fs = require('fs');
const { BrowserWindow, ipcMain, shell, clipboard, nativeTheme } = require('electron');
const { appendEntry } = require('./notesWriter');
const { parseNotes } = require('./notesReader');

// Read-only notebook window that renders the notes file. One window; reopening focuses it.
function createNotebook({ notes, icon }) {
  let nb = null, watcher = null, timer = null;
  const file = () => path.resolve(notes.dir, notes.file);
  const fromNotebook = (e) => nb && !nb.isDestroyed() && e.sender === nb.webContents;

  function read() {
    let md = '';
    try { md = fs.readFileSync(file(), 'utf8'); } catch {}
    return { entries: parseNotes(md), file: file() };
  }

  function watch() {
    try {
      fs.mkdirSync(notes.dir, { recursive: true });
      watcher = fs.watch(notes.dir, (_ev, name) => {
        if (name && name !== notes.file) return;
        clearTimeout(timer);
        timer = setTimeout(() => { if (nb && !nb.isDestroyed()) nb.webContents.send('notes:changed'); }, 150);
      });
    } catch (e) { console.error('[tuck] watch failed:', e.message); }
  }

  ipcMain.handle('notes:get', (e) => (fromNotebook(e) ? read() : null));
  ipcMain.on('notes:copy', (e, text) => { if (fromNotebook(e) && typeof text === 'string') clipboard.writeText(text); });
  ipcMain.on('notes:open-file', (e) => {
    if (!fromNotebook(e)) return;
    try { shell.openPath(appendEntry('', notes)); } catch (err) { console.error('[tuck] open failed:', err.message); }
  });
  ipcMain.on('notes:open-folder', (e) => { if (fromNotebook(e)) shell.openPath(notes.dir); });

  function open() {
    if (nb && !nb.isDestroyed()) {
      if (nb.isMinimized()) nb.restore();
      nb.show();
      nb.focus();
      return;
    }
    nb = new BrowserWindow({
      width: 1040, height: 760, minWidth: 560, minHeight: 420,
      title: 'Tuck', icon, show: false, autoHideMenuBar: true,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#17161a' : '#f6f2ea',
      webPreferences: { preload: path.join(__dirname, 'preload-notebook.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    nb.setMenu(null);
    nb.webContents.on('will-navigate', (e) => e.preventDefault());
    nb.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    nb.once('ready-to-show', () => nb.show());
    nb.on('closed', () => {
      nb = null;
      if (watcher) { watcher.close(); watcher = null; }
    });
    nb.loadFile(path.join(__dirname, 'renderer', 'notebook.html'));
    watch();
  }

  return { open };
}

module.exports = { createNotebook };
