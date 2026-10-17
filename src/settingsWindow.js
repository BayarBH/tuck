'use strict';
// Settings window. ctx = { app, settings, logger, store, notes, openNotebook, broadcast, status, permissions,
// obsidianVault, openInObsidian }
// electron is required lazily inside createSettingsWindow so relocateNotes stays testable with node --test.
const fs = require('fs');
const path = require('path');
const diagnostics = require('./diagnostics');
const obsidian = require('./obsidian');

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

// Bring the notes file along to a new folder. mode: 'copy' | 'move' | 'new'. Never overwrites `to`.
// 'move' keeps a copy of the original in backupDir/moved (never pruned) before removing it, so nothing is ever lost.
// commit() (switch settings to the new folder) runs after the copy and before the original is removed;
// if it throws, the copy is deleted again and the original stays where settings still point.
function relocateNotes(from, to, mode, backupDir, now = new Date(), commit = () => {}) {
  if (mode === 'new') return commit();
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
  try {
    const data = fs.readFileSync(from);
    if (!data.equals(fs.readFileSync(to))) throw new Error('copy verification failed');
    if (mode === 'move') {
      const keep = path.join(backupDir, 'moved');
      fs.mkdirSync(keep, { recursive: true });
      fs.writeFileSync(path.join(keep, `${path.basename(from)}-${stamp(now)}.md`), data, { flag: 'wx' });
    }
    commit();
  } catch (e) {
    try { fs.unlinkSync(to); } catch {} // only our own fresh copy (COPYFILE_EXCL above)
    throw e;
  }
  if (mode === 'move') fs.unlinkSync(from);
}

function createSettingsWindow(ctx) {
  const { BrowserWindow, ipcMain, dialog, shell, clipboard, screen, nativeTheme } = require('electron');
  const { frameOptions, followTheme } = require('./frame');
  const { app, settings, logger, store } = ctx;
  const userData = app.getPath('userData');
  const backupDir = path.join(userData, 'backups');
  let w = null;
  let elevated; // cached: one powershell spawn per app run
  const fromSettings = (e) => w && !w.isDestroyed() && e.sender === w.webContents;
  const send = (ch, data) => { if (w && !w.isDestroyed()) w.webContents.send(ch, data); };

  settings.onChange((all) => send('settings:changed', all));
  // macOS Accessibility status (Windows: always trusted; the renderer only shows it on macOS)
  const perms = ctx.permissions;
  perms.onChange(() => send('settings:permissions-changed', perms.isTrusted()));

  const info = () => ({
    settings: settings.all(),
    defaults: require('./settings').DEFAULTS,
    backupDir,
    logFile: logger.file,
    notesDirOverridden: !!process.env.TUCK_NOTES_DIR,
    version: app.getVersion(),
    store: !!process.windowsStore, // the Store updates the app, so the GitHub update check is hidden
  });

  ipcMain.handle('settings:get', (e) => (fromSettings(e) ? info() : null));
  ipcMain.handle('settings:set', (e, patch) => {
    if (!fromSettings(e)) return null;
    // folder/file only change through settings:pick-folder (writable check + move/copy question)
    if (!patch || typeof patch !== 'object' || 'notesDir' in patch || 'notesFile' in patch) return { ok: false, error: 'not allowed' };
    try { return { ok: true, settings: settings.set(patch) }; } catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('settings:pick-folder', (e) => (fromSettings(e) ? pickFolder() : null));
  ipcMain.handle('settings:vaults', (e) => (fromSettings(e) ? { vaults: obsidian.listVaults(), current: ctx.obsidianVault() } : null));
  // Obsidian mode: notes go to <vault>/Tuck. Only vaults from Obsidian's own list are accepted.
  ipcMain.handle('settings:use-vault', (e, vaultPath) => {
    if (!fromSettings(e)) return null;
    const v = obsidian.listVaults().find((x) => x.path === vaultPath);
    return v ? pickFolder(path.join(v.path, 'Tuck')) : { ok: false, error: 'unknown vault' };
  });
  ipcMain.on('settings:open-obsidian', (e) => { if (fromSettings(e)) ctx.openInObsidian(); });
  ipcMain.handle('settings:list-apps', async (e) => (fromSettings(e) ? diagnostics.listWindowedApps() : null));
  ipcMain.handle('settings:diagnostics', async (e) => {
    if (!fromSettings(e)) return null;
    if (elevated === undefined) elevated = await diagnostics.isElevated();
    const rows = await diagnostics.collect({ app, screen, settings, store, logger, status: ctx.status, elevated });
    return { rows, text: diagnostics.format(rows) };
  });
  ipcMain.handle('settings:permissions', (e) => (fromSettings(e) ? perms.isTrusted() : null));
  ipcMain.on('settings:open-permissions', (e) => { if (fromSettings(e)) perms.openSettings(); });
  ipcMain.on('settings:copy', (e, text) => { if (fromSettings(e) && typeof text === 'string') clipboard.writeText(text); });
  ipcMain.on('settings:open-log', (e) => {
    if (!fromSettings(e)) return;
    if (!fs.existsSync(logger.file)) logger.info('app', 'log opened');
    shell.openPath(logger.file);
  });
  ipcMain.on('settings:open-folder', (e, which) => {
    if (!fromSettings(e)) return;
    const dir = which === 'backups' ? backupDir : settings.get('notesDir');
    fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
  });

  // preset: a folder chosen by the app (Obsidian vault) instead of the folder dialog
  async function pickFolder(preset) {
    const cur = settings.all();
    let dir = preset;
    if (!dir) {
      const r = await dialog.showOpenDialog(w, { title: 'Choose a folder for your notes', defaultPath: cur.notesDir, properties: ['openDirectory', 'createDirectory'] });
      if (r.canceled || !r.filePaths[0]) return { ok: false, error: 'canceled' };
      dir = r.filePaths[0];
    }
    if (path.resolve(dir).toLowerCase() === path.resolve(cur.notesDir).toLowerCase()) return { ok: false, error: 'same' };
    const probe = diagnostics.probeWritable(dir);
    if (!probe.ok) {
      await dialog.showMessageBox(w, { type: 'error', title: 'Tuck', message: 'Tuck cannot write to this folder.', detail: `${dir}\n\n${probe.error}` });
      return { ok: false, error: 'not writable' };
    }
    const from = path.resolve(cur.notesDir, cur.notesFile);
    const to = path.resolve(dir, cur.notesFile);
    let size = 0;
    try { size = fs.statSync(from).size; } catch {}
    let mode = 'new';
    if (size && fs.existsSync(to)) {
      const a = await dialog.showMessageBox(w, {
        type: 'question', title: 'Tuck', buttons: ['Use that file', 'Cancel'], defaultId: 0, cancelId: 1, noLink: true,
        message: `This folder already has a ${cur.notesFile}.`,
        detail: 'Tuck will save new notes into that file. Your current file stays where it is, untouched.',
      });
      if (a.response === 1) return { ok: false, error: 'canceled' };
    } else if (size) {
      const a = await dialog.showMessageBox(w, {
        type: 'question', title: 'Tuck', buttons: ['Move', 'Copy', 'Start a new file', 'Cancel'], defaultId: 0, cancelId: 3, noLink: true,
        message: 'What should happen to your existing notes?',
        detail: `Move: your notes go to the new folder (a copy of the old file is kept in Tuck's backups).\nCopy: both folders keep a copy; new notes go to the new one.\nStart a new file: the old file stays where it is.\n\nFrom: ${from}`,
      });
      if (a.response === 3) return { ok: false, error: 'canceled' };
      mode = ['move', 'copy', 'new'][a.response];
    }
    try {
      relocateNotes(from, to, mode, backupDir, new Date(), () => settings.set({ notesDir: dir }));
    } catch (err) {
      logger.error('settings', err);
      await dialog.showMessageBox(w, { type: 'error', title: 'Tuck', message: 'Could not change the notes folder.', detail: err.message });
      return { ok: false, error: err.message };
    }
    logger.info('settings', 'notes folder changed (' + mode + ')');
    return { ok: true, settings: settings.all() };
  }

  function open(section) {
    if (w && !w.isDestroyed()) {
      if (w.isMinimized()) w.restore();
      w.show();
      w.focus();
      if (section) send('settings:section', section);
      return;
    }
    w = new BrowserWindow({
      width: 900, height: 680, minWidth: 640, minHeight: 460,
      title: 'Tuck Settings', icon: require('./trayIcon').appIcon(), show: false, autoHideMenuBar: true,
      ...frameOptions(),
      webPreferences: { preload: path.join(__dirname, 'preload-settings.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    w.setMenu(null);
    followTheme(w);
    w.webContents.on('will-navigate', (e) => e.preventDefault());
    w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    w.once('ready-to-show', () => { w.show(); if (section) send('settings:section', section); });
    w.on('closed', () => { w = null; });
    w.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  }

  return { open };
}

module.exports = { createSettingsWindow, relocateNotes };
