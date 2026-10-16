'use strict';
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, shell, clipboard, dialog } = require('electron');
const { frameOptions, followTheme } = require('./frame');
const { dailyPick, onThisDay, weekly, ymd } = require('./review');
const { createExporter } = require('./export');

// Notebook window over the notes file: browse, edit/delete (with undo), export, review.
// One window; reopening focuses it. notes() -> { dir, file } (current settings); store = notesStore.
function createNotebook({ notes, store, logger, icon }) {
  let nb = null, watcher = null, timer = null;
  const fromNotebook = (e) => nb && !nb.isDestroyed() && e.sender === nb.webContents;
  const changed = () => { if (nb && !nb.isDestroyed()) nb.webContents.send('notes:changed'); };
  const exporter = createExporter({ app, dialog, clipboard, logger });

  function review(entries) {
    const today = ymd(new Date());
    const pick = dailyPick(entries, today);
    return {
      today,
      pick,
      onThisDay: onThisDay(entries, today).filter((e) => !pick || e.key !== pick.key).slice(0, 3),
      week: weekly(entries, new Date()),
    };
  }

  function read() {
    try { const r = store.read(); return { ...r, review: review(r.entries) }; } catch (e) {
      logger.error('notebook', e);
      const { dir, file } = notes();
      return { entries: [], file: path.resolve(dir, file), error: e.message };
    }
  }

  // store calls: expected conflicts come back as { ok:false, error }; IO errors are logged, never thrown at the page
  function guarded(scope, fn) {
    return async (e, ...a) => {
      if (!fromNotebook(e)) return null;
      try { return await fn(...a); } catch (err) {
        logger.error(scope, err);
        return { ok: false, error: 'io', message: err.message };
      }
    };
  }
  const isKey = (k) => typeof k === 'string' && /^[0-9a-f]{12}(-\d+)?$/.test(k);
  const BAD = { ok: false, error: 'invalid' };

  ipcMain.handle('notes:update', guarded('notebook', (key, patch) => {
    if (!isKey(key) || !patch || typeof patch !== 'object') return BAD;
    const p = {};
    for (const k of ['quote', 'thought']) {
      if (patch[k] === undefined) continue;
      if (typeof patch[k] !== 'string') return BAD;
      p[k] = patch[k];
    }
    return store.update(key, p);
  }));
  ipcMain.handle('notes:remove', guarded('notebook', (key) => (isKey(key) ? store.remove(key) : BAD)));
  ipcMain.handle('notes:undo', guarded('notebook', (token) => (typeof token === 'string' ? store.undo(token) : BAD)));

  const title = (t) => (typeof t === 'string' ? t.slice(0, 80) : '');
  ipcMain.handle('notes:export-md', guarded('export', (opts) => {
    const keys = Array.isArray(opts && opts.keys) ? opts.keys.filter(isKey) : [];
    const { file } = store.read();
    let md = '';
    try { md = fs.readFileSync(file, 'utf8'); } catch (err) { if (err.code !== 'ENOENT') throw err; }
    return exporter.markdown(nb, { md, keys, title: title(opts.title) });
  }));
  ipcMain.handle('notes:export-pdf', guarded('export', (opts) => exporter.pdf(nb, { title: title(opts && opts.title) })));
  ipcMain.handle('notes:capture', guarded('export', (rect, action) => {
    const ok = rect && ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(rect[k])) && rect.width >= 1 && rect.height >= 1;
    if (!ok || (action !== 'copy' && action !== 'save')) return BAD;
    return exporter.image(nb, rect, action);
  }));

  function unwatch() { if (watcher) { watcher.close(); watcher = null; } }

  function watch() {
    unwatch();
    const { dir, file } = notes();
    try {
      fs.mkdirSync(dir, { recursive: true });
      watcher = fs.watch(dir, (_ev, name) => {
        if (name && name !== file) return;
        clearTimeout(timer);
        timer = setTimeout(changed, 150);
      });
      watcher.on('error', (e) => logger.warn('notebook', 'watch error: ' + e.message));
    } catch (e) { logger.warn('notebook', 'watch failed: ' + e.message); }
  }

  ipcMain.handle('notes:get', (e) => (fromNotebook(e) ? read() : null));
  ipcMain.on('notes:copy', (e, text) => { if (fromNotebook(e) && typeof text === 'string') clipboard.writeText(text); });
  ipcMain.on('notes:open-file', (e) => {
    if (!fromNotebook(e)) return;
    try { shell.openPath(store.append('')); } catch (err) { logger.error('notebook', err); }
  });
  ipcMain.on('notes:open-folder', (e) => { if (fromNotebook(e)) shell.openPath(notes().dir); });

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
      ...frameOptions(),
      webPreferences: { preload: path.join(__dirname, 'preload-notebook.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    nb.setMenu(null);
    followTheme(nb);
    nb.webContents.on('will-navigate', (e) => e.preventDefault());
    nb.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    nb.once('ready-to-show', () => nb.show());
    nb.on('closed', () => {
      nb = null;
      unwatch();
    });
    nb.loadFile(path.join(__dirname, 'renderer', 'notebook.html'));
    watch();
  }

  // settings changed the notes location: follow it
  function notesChanged() {
    if (!nb || nb.isDestroyed()) return;
    watch();
    changed();
  }

  return { open, notesChanged };
}

module.exports = { createNotebook };
