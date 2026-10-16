'use strict';
// Updates from GitHub Releases (electron-updater). Default OFF: no request is made unless
// settings.autoUpdate is on (check ~10 s after start, then every 24 h) or the user clicks
// "Check for updates…". Downloads only after the user agrees; installs on quit (or "Restart now").
// electron-updater is required lazily, so nothing of it loads or runs while updates are off.
const DAY = 24 * 60 * 60 * 1000;

function createUpdater(ctx) {
  const { app, settings, logger } = ctx;
  const { dialog, Notification } = require('electron');
  let au = null;           // autoUpdater, loaded on first check
  let checking = false;
  let manual = false;      // current check was started by the user: report every outcome
  let declined = null;     // version the user said "Later" to; background checks don't nag again
  let downloading = false;
  let timer = null;
  let first = null;
  let pendingNote = null;

  const box = (o) => dialog.showMessageBox({ title: 'Tuck', noLink: true, ...o });

  function load() {
    if (au) return au;
    au = require('electron-updater').autoUpdater;
    au.autoDownload = false;
    au.autoInstallOnAppQuit = true;
    au.allowPrerelease = false;
    // versions/URLs only; nothing personal goes through these
    au.logger = { info() {}, debug() {}, warn: (m) => logger.warn('updater', String(m)), error: (m) => logger.error('updater', String(m)) };
    au.on('update-available', (info) => {
      const wasManual = manual;
      checking = manual = false;
      logger.info('updater', 'available ' + info.version);
      if (wasManual) return askDownload(info);
      if (declined === info.version || downloading) return;
      if (!Notification.isSupported()) return askDownload(info);
      // kept in a variable that outlives this handler: a collected Notification loses its click handler
      const n = pendingNote = new Notification({ title: 'Tuck update available', body: `Version ${info.version} is ready to download. Click for details.` });
      n.on('click', () => { pendingNote = null; askDownload(info); });
      n.on('close', () => { if (pendingNote === n) pendingNote = null; });
      n.show();
    });
    au.on('update-not-available', () => {
      const wasManual = manual;
      checking = manual = false;
      logger.info('updater', 'up to date');
      if (wasManual) box({ type: 'info', message: 'Tuck is up to date.', detail: `You have version ${app.getVersion()}.` });
    });
    au.on('error', (e) => {
      const wasManual = manual;
      checking = manual = false;
      downloading = false;
      logger.error('updater', e);
      if (wasManual) box({ type: 'warning', message: 'Could not check for updates.', detail: (e && e.message ? e.message : String(e)).split('\n')[0] });
    });
    au.on('update-downloaded', async (info) => {
      downloading = false;
      logger.info('updater', 'downloaded ' + info.version);
      const { response } = await box({
        type: 'info', message: `Tuck ${info.version} is ready to install.`,
        detail: 'It will be installed the next time Tuck quits. Restart now to install it right away.',
        buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1,
      });
      if (response === 0) setImmediate(() => au.quitAndInstall(true, true));
    });
    return au;
  }

  async function askDownload(info) {
    if (downloading) return;
    const { response } = await box({
      type: 'question', message: `Tuck ${info.version} is available.`,
      detail: `You have ${app.getVersion()}. Download it from GitHub now? It installs when Tuck quits.` +
        (app.isPackaged ? '\n\nIf the installer is not code-signed, Windows may show a SmartScreen warning.' : ''),
      buttons: ['Download', 'Later'], defaultId: 0, cancelId: 1,
    });
    if (response !== 0) { declined = info.version; return; }
    downloading = true;
    load().downloadUpdate().catch(() => {}); // failures arrive via 'error'
  }

  function check(isManual) {
    if (isManual) manual = true;
    if (checking) return;
    checking = true;
    Promise.resolve()
      .then(() => load().checkForUpdates())
      .catch((e) => {
        // normally the 'error' event already handled it (and reset manual); this covers load failures
        if (au && !manual) return;
        logger.error('updater', e);
        if (manual) box({ type: 'warning', message: 'Could not check for updates.', detail: String(e && e.message || e).split('\n')[0] });
      })
      .finally(() => { checking = manual = false; });
  }

  function schedule() {
    clearTimeout(first); clearInterval(timer); first = timer = null;
    if (!settings.get('autoUpdate') || !app.isPackaged) return;
    first = setTimeout(() => check(false), 10000);
    timer = setInterval(() => check(false), DAY);
  }

  return {
    init() {
      schedule();
      settings.onChange((_all, changed) => { if (changed.includes('autoUpdate')) schedule(); });
    },
    checkNow() {
      if (!app.isPackaged) {
        box({ type: 'info', message: 'Updates work only in the installed app.', detail: 'This is a development build (npm start). No request was made.' });
        return;
      }
      check(true);
    },
  };
}

module.exports = { createUpdater };
