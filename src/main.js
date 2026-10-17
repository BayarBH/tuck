'use strict';
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Tray, Menu, ipcMain, clipboard, screen, shell, dialog, session, Notification } = require('electron');
// tests/E2E: keep settings, logs, backups out of %APPDATA%/Tuck. Must run before anything reads userData.
if (process.env.TUCK_USER_DATA) app.setPath('userData', process.env.TUCK_USER_DATA);
// minidumps stay in <userData>/Crashpad; never uploaded
require('./crash').start();

const config = require('../config');
const { createKeyDetector } = require('./keyDetector');
const { formatEntry, createDeduper } = require('./notesWriter');
const sourceUrl = require('./sourceUrl');
const plat = require('./platform'); // win32.js or darwin.js, same API
const { keyMap } = require('./keys');
const { createPermissions } = require('./permissions');
const { createTrayIcon, appIcon } = require('./trayIcon');
const { createNotebook } = require('./notebook');
const { createSettings } = require('./settings');
const { createLogger } = require('./logger');
const { createNotesStore } = require('./notesStore');
const { isExcluded } = require('./exclude');
const { createSettingsWindow } = require('./settingsWindow');
const { createOnboarding } = require('./onboarding');
const { createUpdater } = require('./updater');
const { createFeedback } = require('./feedback');
const { createReviewScheduler } = require('./review');
const obsidian = require('./obsidian');
const listFormat = require('./listFormat');
const startupTask = require('./startupTask');

const NAME = 'Tuck';
const IS_MAC = process.platform === 'darwin';
// Microsoft Store (MSIX) build: the Store updates it, and start at login is a manifest startup task
const IS_STORE = !!process.windowsStore;
const AX_NEEDED = 'Accessibility permission needed';
const userData = app.getPath('userData');
const logger = createLogger({ dir: path.join(userData, 'logs') });
const settings = createSettings({ file: path.join(userData, 'settings.json'), logger });
const notes = () => ({ dir: settings.get('notesDir'), file: settings.get('notesFile') });
const store = createNotesStore({ getPaths: notes, backupDir: path.join(userData, 'backups'), logger });
plat.setLogger((msg) => logger.error(process.platform, msg));
// Obsidian mode: the notes folder is inside a vault -> its name, else null
const obsidianVault = () => { const v = obsidian.vaultOf(settings.get('notesDir'), obsidian.listVaults()); return v ? v.name : null; };
function openInObsidian() {
  let file;
  try { file = store.append(''); } catch (e) { logger.error('obsidian', e); return; } // creates the file if missing
  shell.openExternal(obsidian.openUri(file)).catch((e) => { logger.warn('obsidian', 'open failed: ' + e.message); shell.openPath(file); });
}
process.on('uncaughtException', (e) => logger.error('uncaught', e));
process.on('unhandledRejection', (e) => logger.error('unhandled-rejection', e));

let win = null;
let tray = null;
let notebook = null;
let paused = false;
let hookError = null;
let hookLoaded = false;
let lastTrigger = null;  // { at, mode } for diagnostics; never any content
let seq = 0;
let doubleId = 0;        // id of the current silent animation
let hideTimer = null;
let longSession = null;  // { id, text, fg, date, armed }
let deduper = createDeduper(settings.get('dedupeMs'));
const makeDetector = () => createKeyDetector({ longPressMs: settings.get('longPressMs'), doubleGapMs: settings.get('doubleGapMs') });
let detector = makeDetector();
let feature = null;      // { settingsWindow, onboarding, updater, feedback, review }
let permissions = null;  // macOS Accessibility trust (always trusted elsewhere)
let hookRegistered = false;
let hookTicker = null;
let storeLogin = null;   // Store build: 'on' | 'off' | 'blocked' | null (unknown)

// overlay animation timings scaled by settings.animSpeed (>1 = slower)
function timings() {
  const k = settings.get('animSpeed');
  return { FLY_MS: Math.round(config.FLY_MS * k), PULSE_MS: Math.round(config.PULSE_MS * k), SAVED_HOLD_MS: Math.round(config.SAVED_HOLD_MS * k) };
}

function overlayConfig() {
  const { BAR_WIDTH, BAR_HEIGHT, BAR_BOTTOM, BAR_MAX_LINES } = config;
  return { BAR_WIDTH, BAR_HEIGHT, BAR_BOTTOM, BAR_MAX_LINES, ...timings() };
}

settings.onChange((_all, changed) => {
  const has = (...k) => k.some((x) => changed.includes(x));
  if (has('longPressMs', 'doubleGapMs')) detector = makeDetector();
  if (has('dedupeMs')) deduper = createDeduper(settings.get('dedupeMs'));
  if (has('animSpeed') && win && !win.isDestroyed()) win.webContents.send('config', overlayConfig());
  if (has('notesDir', 'notesFile') && notebook) notebook.notesChanged();
  if (has('notesDir')) updateTray(); // "Open in Obsidian" follows the folder
  logger.info('settings', 'changed: ' + changed.join(','));
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId('com.bayar.tuck');
  app.on('window-all-closed', () => {}); // lives in the tray, never quit here
  // launching Tuck again (desktop / Start menu shortcut) opens the notebook
  app.on('second-instance', () => { if (notebook) notebook.open(); });
  app.whenReady().then(init);
  // macOS has no second instance: opening Tuck again (Finder / Launchpad) sends 'activate' instead
  if (IS_MAC) app.on('activate', () => { if (notebook) notebook.open(); });
  app.on('will-quit', () => {
    try { require('uiohook-napi').uIOhook.stop(); } catch {}
    plat.dispose();
  });
}

function init() {
  logger.info('app', `start ${app.getVersion()}${app.isPackaged ? '' : ' (dev)'}`);
  if (IS_MAC && app.dock) app.dock.hide(); // menu bar app: no Dock icon (packaged builds also set LSUIElement)
  permissions = createPermissions({ logger });
  // no network from any page: only local files and devtools (the updater runs in main, not here)
  session.defaultSession.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !/^(file|devtools):/i.test(d.url) }));
  app.on('render-process-gone', (_e, wc, d) => logger.error('renderer', `gone: ${d.reason} (exit ${d.exitCode}) ${wc.getURL().split('/').pop()}`));
  app.on('child-process-gone', (_e, d) => logger.error('child', `gone: ${d.type} ${d.reason} (exit ${d.exitCode})`));
  createOverlay();
  notebook = createNotebook({ notes, store, logger, icon: appIcon(), obsidianVault, openInObsidian });
  const ctx = {
    app, settings, logger, store, notes, permissions, obsidianVault, openInObsidian,
    openNotebook: () => notebook.open(),
    status: () => ({ hookLoaded, hookError, paused, lastTrigger, ...(IS_MAC ? { accessibility: permissions.isTrusted() } : {}) }),
    broadcast: (channel, data) => BrowserWindow.getAllWindows().forEach((w) => { if (!w.isDestroyed()) w.webContents.send(channel, data); }),
  };
  feature = {
    settingsWindow: createSettingsWindow(ctx),
    onboarding: createOnboarding(ctx),
    updater: createUpdater(ctx),
    feedback: createFeedback(ctx),
    review: createReviewScheduler(ctx),
  };
  createTray();
  startHook();
  // macOS: the key hook can start only once Accessibility is granted (onboarding / tray asks); start it then
  if (IS_MAC) permissions.onChange(() => { logger.info('hook', 'accessibility granted, starting'); startHook(); });
  if (!IS_MAC) plat.getForeground(); // warm up the powershell child (first start ~2.4s)
  if (IS_STORE) startupTask.get().then((s) => { storeLogin = s; updateTray(); });
  else safe('updater', () => feature.updater.init())();
  safe('review', () => feature.review.start())();
  safe('onboarding', () => feature.onboarding.maybeShowOnFirstRun())();
  // QA / screenshots: TUCK_OPEN=settings or TUCK_OPEN=notebook opens that window at startup
  if (process.env.TUCK_OPEN === 'settings') safe('settings', () => feature.settingsWindow.open(process.env.TUCK_OPEN_SECTION))();
  if (process.env.TUCK_OPEN === 'notebook') notebook.open();
}

// feature modules must never take the tray / capture down with them
function safe(scope, fn) {
  return (...a) => { try { return fn(...a); } catch (e) { logger.error(scope, e); } };
}

// ---------- overlay window ----------
function createOverlay() {
  const { bounds } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    ...bounds,
    // macOS: a non-activating NSPanel, so showing it (silent double-tap) never activates Tuck
    ...(IS_MAC ? { type: 'panel' } : {}),
    transparent: true, frame: false, alwaysOnTop: true, skipTaskbar: true,
    resizable: false, movable: false, hasShadow: false, focusable: true, show: false,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  if (IS_MAC) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); // also over full-screen apps / other Spaces
  win.setIgnoreMouseEvents(true, { forward: true });
  // switching away during input (Alt+Tab / Win key) cancels, so a non-click-through overlay never sticks; no refocus
  win.on('blur', () => { if (longSession && longSession.armed) endLong(false); });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('did-finish-load', () => win.webContents.send('config', overlayConfig()));
  win.webContents.on('render-process-gone', () => {
    if (longSession) endLong();
    win.webContents.reload();
  });
  win.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
}

function hwndOf(w) {
  const b = w.getNativeWindowHandle();
  return (b.length >= 8 ? b.readBigUInt64LE(0) : BigInt(b.readUInt32LE(0))).toString();
}
const overlayHwnd = () => hwndOf(win);

function isOwnWindow(hwnd) {
  return BrowserWindow.getAllWindows().some((w) => !w.isDestroyed() && w !== win && hwndOf(w) === hwnd
    && !w.webContents.getURL().endsWith('onboarding.html'));
}

// macOS: the foreground is reported per app (pid), so "own" = Tuck is the active app and its focused window
// is not the tutorial
function isOwnAppMac(fg) {
  if (fg.hwnd !== String(process.pid)) return false;
  const f = BrowserWindow.getFocusedWindow();
  return !(f && !f.isDestroyed() && f.webContents.getURL().endsWith('onboarding.html'));
}

function placeOverlay() {
  const cur = screen.getCursorScreenPoint();
  const { bounds } = screen.getDisplayNearestPoint(cur);
  win.setBounds(bounds);
  // mixed DPI: moving across displays can apply the old display's scale; a second setBounds fixes it
  const b = win.getBounds();
  if (b.x !== bounds.x || b.y !== bounds.y || b.width !== bounds.width || b.height !== bounds.height) win.setBounds(bounds);
  return { x: cur.x - bounds.x, y: cur.y - bounds.y };
}

function preview(text) {
  const chars = [...text.replace(/\r\n|\r|\n/g, ' ').trim()];
  return chars.length > config.CAPSULE_CHARS ? chars.slice(0, config.CAPSULE_CHARS).join('') + '…' : chars.join('');
}

function hideOverlay() {
  clearTimeout(hideTimer);
  win.setIgnoreMouseEvents(true, { forward: true });
  win.hide();
}

function balloon(content) {
  if (IS_MAC) { // displayBalloon is Windows-only
    try { if (Notification.isSupported()) new Notification({ title: NAME, body: content }).show(); } catch (e) { logger.warn('notify', e.message); }
    return;
  }
  if (tray) tray.displayBalloon({ title: NAME, content });
}

function save(text, thought, fg, date, mode, source) {
  try {
    store.append(formatEntry({ text, thought, appName: fg && fg.processName, date, source }));
    deduper.markSaved(text, Date.now());
  } catch (e) {
    logger.error('save', e);
    balloon('Could not write notes: ' + e.message);
    return false;
  }
  safe('onboarding', () => feature.onboarding.notifyCapture(mode))();
  return true;
}

// ---------- triggers ----------
async function onTrigger(mode) {
  lastTrigger = { at: Date.now(), mode };
  if (paused || longSession) return;
  // don't block capture on the PowerShell cold start: wait at most 500ms, else omit the source app
  // (macOS: lsappinfo + a best-effort osascript window title capped at 600ms, so allow a bit more)
  const fgP = Promise.race([plat.getForeground(), sleep(IS_MAC ? 1200 : 500).then(() => null)]);
  const [fg] = await Promise.all([fgP, sleep(config.CLIPBOARD_DELAY_MS)]);
  if (paused || longSession) return;
  if (!fg) {
    // helper cold start / restarted after being killed / no answer: exclusion can't be checked (and a long
    // press could neither take focus nor give it back), so fail closed
    logger.info('capture', 'skipped: foreground unknown');
    balloon('Not ready yet, nothing was saved. Try again in a moment.');
    return;
  }
  // Tuck's own notebook/settings: copying from a card must not re-append it (the tutorial stays allowed)
  if (IS_MAC ? isOwnAppMac(fg) : isOwnWindow(fg.hwnd)) { logger.info('capture', 'skipped: own window'); return; }
  if (isExcluded(fg, { apps: settings.get('excludeApps'), titles: settings.get('excludeTitles') })) {
    logger.info('capture', 'skipped: excluded');
    return;
  }
  // the clipboard may come from another app (copied in a password manager, tapped elsewhere): honour its private marks
  const priv = await plat.clipboardPrivate();
  if (paused || longSession) return;
  if (priv !== false) { logger.info('capture', priv ? 'skipped: private clipboard' : 'skipped: clipboard check failed'); return; }
  const plain = clipboard.readText();
  if (!plain || !plain.trim() || deduper.isDuplicate(plain, Date.now())) return;
  // lists copied from a page keep their bullets and numbers (the plain text drops them)
  const text = (settings.get('keepLists') && listFormat.read(clipboard, plain)) || plain;
  // the page link a browser put next to the text (same clipboard content); never logged
  const source = settings.get('saveSourceLink') ? sourceUrl.read(clipboard) : null;

  const date = new Date();
  const id = ++seq;

  const pos = placeOverlay();
  const payload = { id, preview: preview(text), x: pos.x, y: pos.y, mode };

  if (mode === 'double') {
    if (!save(text, '', fg, date, 'double', source)) return;
    doubleId = id;
    win.showInactive();
    win.webContents.send('capture', payload);
    clearTimeout(hideTimer);
    const t = timings();
    hideTimer = setTimeout(() => { if (doubleId === id && !longSession) hideOverlay(); }, t.FLY_MS + t.PULSE_MS + t.SAVED_HOLD_MS + 1000);
    return;
  }

  // long
  clearTimeout(hideTimer);
  const s = longSession = { id, text, source, fg, date, armed: false };
  win.showInactive();
  win.focus();
  if (IS_MAC) {
    // The overlay is a non-activating NSPanel: it may become the key window (so the typing reaches it) while
    // the app the text was copied from stays the active app, Spotlight-style. Electron's focus() on a panel
    // only does makeKeyAndOrderFront on macOS 14+; older macOS may still activate Tuck, which endLong undoes.
    // isFocused() is NSWindow.isKeyWindow here, which is exactly "receives the keystrokes".
    if (!win.isFocused()) {
      endLong(true);
      balloon('Could not take input focus, nothing was saved.');
      return;
    }
  } else {
    // isFocused() can be true while the OS foreground did not change (seen in E2E), so trust only win32,
    // which reports true only when GetForegroundWindow() is really the overlay
    const ok = await plat.focusWindow(overlayHwnd());
    if (longSession !== s) return;
    if (!ok) {
      endLong(false);
      balloon('Could not take input focus, nothing was saved.');
      return;
    }
  }
  win.setIgnoreMouseEvents(false); // only now: never block clicks while unfocused
  s.armed = true;
  win.webContents.send('capture', payload);
}

// Refocus the original window BEFORE hiding: hiding first lets the OS activate the next window in z-order (seen: explorer)
function endLong(refocus = true) {
  const s = longSession;
  longSession = null;
  win.setIgnoreMouseEvents(true, { forward: true });
  const mySeq = seq;
  if (IS_MAC) {
    // ordering the panel out hands key status back to the previous app's window (it normally stayed active)
    hideOverlay();
    if (refocus && s && s.fg) giveBackMac(s.fg, mySeq);
    return;
  }
  const back = refocus && s && s.fg ? plat.focusWindow(s.fg.hwnd) : Promise.resolve();
  back.then(async () => {
    if (seq !== mySeq) return;
    hideOverlay();
    if (!refocus || !s || !s.fg) return;
    // the OS sometimes reassigns focus right after (or the overlay keeps it): recheck and retry a few times
    for (let i = 0; i < 3; i++) {
      await sleep(120);
      if (seq !== mySeq || longSession) return;
      const now = await plat.getForeground();
      if (!now || now.hwnd === s.fg.hwnd) return;
      await plat.focusWindow(s.fg.hwnd);
    }
  });
}

// macOS: only if Tuck did become the active app (older macOS / focus() fallback), reactivate the source app
async function giveBackMac(fg, mySeq) {
  const me = String(process.pid);
  if (fg.hwnd === me) return; // copied from Tuck itself (tutorial): nothing to give back
  await sleep(60);
  if (seq !== mySeq || longSession) return;
  if ((await plat.frontPid()) !== me) return;
  if (seq !== mySeq || longSession) return;
  if (!(await plat.focusWindow(fg.hwnd))) app.hide(); // hiding Tuck lets macOS activate the next app
}

const fromOverlay = (e) => win && e.sender === win.webContents;

ipcMain.on('anim-done', (e, id) => {
  if (fromOverlay(e) && id === doubleId && !longSession) hideOverlay();
});
ipcMain.on('submit', (e, id, thought) => {
  if (!fromOverlay(e) || !longSession || longSession.id !== id) return;
  const s = longSession;
  save(s.text, typeof thought === 'string' ? thought : '', s.fg, s.date, 'long', s.source);
  endLong();
});
ipcMain.on('cancel', (e, id) => {
  if (fromOverlay(e) && longSession && longSession.id === id) endLong();
});

// ---------- global keys (only Ctrl / C timing - Cmd / C on macOS; no key is ever logged or stored) ----------
const KEY_LABEL = IS_MAC ? '\u2318C' : 'Ctrl+C';

// Called at start and, on macOS, again when Accessibility is granted. Listeners are registered once.
function startHook() {
  const hadError = hookError;
  try {
    const { uIOhook, UiohookKey } = require('uiohook-napi');
    if (!hookRegistered) {
      // keyOf / modifier groups per platform: on macOS Command is the trigger and Control counts as "other"
      const { keyOf, mods: MODS, flags } = keyMap(process.platform, UiohookKey);
      // uiohook's e.ctrlKey etc. read false on the first modifier press after start (mask not initialised),
      // so track modifiers ourselves too. Latest keydown (incl. auto-repeat) wins; 2s without repeat = released,
      // so a missed keyup can't leave a modifier stuck "down".
      const modAt = { ctrl: 0, shift: 0, alt: 0, meta: 0 };
      const feed = (type) => (e) => {
        const now = Date.now();
        for (const m in MODS) if (MODS[m].includes(e.keycode)) modAt[m] = type === 'keydown' ? now : 0;
        const held = (m) => !!e[flags[m]] || now - modAt[m] < 2000;
        const r = detector.handle({ type, key: keyOf(e.keycode), time: now,
          ctrl: held('ctrl'), shift: held('shift'), alt: held('alt'), meta: held('meta') });
        if (r) onTrigger(r);
      };
      uIOhook.on('keydown', feed('keydown'));
      uIOhook.on('keyup', feed('keyup'));
      hookRegistered = true;
    }
    // macOS: while untrusted, start() fails AND libuiohook pops the system Accessibility prompt on every call,
    // so don't start until granted (permissions.onChange calls us again)
    if (IS_MAC && !permissions.isTrusted()) {
      hookError = AX_NEEDED;
      logger.info('hook', 'waiting for accessibility permission');
      updateTray();
      return;
    }
    // macOS re-start after a grant: a tap created before the grant may receive no events, so recreate it
    if (hookLoaded) { try { uIOhook.stop(); } catch {} hookLoaded = false; }
    uIOhook.start();
    hookLoaded = true;
    hookError = null;
    if (hadError) updateTray();
    if (!hookTicker) hookTicker = setInterval(() => { const r = detector.tick(Date.now()); if (r) onTrigger(r); }, 30);
  } catch (e) {
    hookError = IS_MAC && e.code === 'UIOHOOK_ERROR_AXAPI_DISABLED' ? AX_NEEDED : e.message;
    logger.error('hook', e);
    updateTray();
    if (hookError !== AX_NEEDED) {
      dialog.showMessageBox({ type: 'error', title: NAME, message: `Global key hook unavailable. ${KEY_LABEL} capture will not work.`, detail: e.message });
    }
  }
}

// ---------- tray ----------
function createTray() {
  tray = new Tray(createTrayIcon(paused));
  tray.on('double-click', () => notebook.open());
  updateTray();
}

// unpackaged (npm start): the Run entry must pass the app dir, or login opens Electron's default app
const loginOpts = () => (app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] });

// turned off in Windows Settings > Apps > Startup: only the user can turn it back on there
function storeLoginItem() {
  if (storeLogin === 'blocked') return { label: 'Start at login (off in Windows Settings)…', click: () => shell.openExternal('ms-settings:startupapps') };
  return { label: 'Start at login', type: 'checkbox', checked: storeLogin === 'on', enabled: storeLogin !== null,
    click: (item) => { storeLogin = null; updateTray(); startupTask.set(item.checked).then((s) => { storeLogin = s; updateTray(); }); } };
}

function updateTray() {
  if (!tray) return;
  tray.setImage(createTrayIcon(paused || !!hookError));
  const needsAx = IS_MAC && hookError === AX_NEEDED;
  tray.setToolTip(needsAx ? NAME + ' (Accessibility permission needed)' : hookError ? NAME + ' (key hook unavailable)' : paused ? NAME + ' (paused)' : NAME);
  tray.setContextMenu(Menu.buildFromTemplate([
    ...(needsAx ? [
      { label: 'Grant Accessibility permission\u2026', click: safe('permissions', () => { permissions.request(); permissions.openSettings(); }) },
      { type: 'separator' },
    ] : []),
    { label: paused ? 'Resume capture' : 'Pause capture', click: () => { paused = !paused; updateTray(); } },
    { label: 'Open notebook', click: () => notebook.open() },
    ...(obsidianVault() ? [{ label: 'Open in Obsidian', click: safe('obsidian', openInObsidian) }] : []),
    { label: 'Settings…', click: safe('settings', () => feature.settingsWindow.open()) },
    { type: 'separator' },
    { label: 'Show tutorial', click: safe('onboarding', () => feature.onboarding.open()) },
    ...(IS_STORE ? [] : [{ label: 'Check for updates…', click: safe('updater', () => feature.updater.checkNow()) }]),
    { label: 'Report a problem…', click: safe('feedback', () => feature.feedback.openReport()) },
    { label: 'Open log', click: safe('log', openLog) },
    { type: 'separator' },
    IS_STORE ? storeLoginItem() : { label: 'Start at login', type: 'checkbox', checked: app.getLoginItemSettings(loginOpts()).openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, ...loginOpts() }) },
    { label: 'Quit', click: () => app.quit() },
  ]));
}

function openLog() {
  if (!fs.existsSync(logger.file)) logger.info('app', 'log opened');
  shell.openPath(logger.file).then((err) => { if (err) logger.warn('log', 'open failed: ' + err); });
}
