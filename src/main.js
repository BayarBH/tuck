'use strict';
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Tray, Menu, ipcMain, clipboard, screen, shell, dialog, session } = require('electron');
const config = require('../config');
const { createKeyDetector } = require('./keyDetector');
const { formatEntry, appendEntry, createDeduper } = require('./notesWriter');
const win32 = require('./win32');
const { createTrayIcon } = require('./trayIcon');

const NOTES = { dir: config.NOTES_DIR, file: config.NOTES_FILE };
const NAME = 'Tuck';

let win = null;
let tray = null;
let paused = false;
let hookError = null;
let seq = 0;
let doubleId = 0;        // id of the current silent animation
let hideTimer = null;
let longSession = null;  // { id, text, fg, date, armed }
const deduper = createDeduper(config.DEDUPE_MS);
const detector = createKeyDetector({ longPressMs: config.LONG_PRESS_MS, doubleGapMs: config.DOUBLE_GAP_MS });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId('com.bayar.tuck');
  app.on('window-all-closed', () => {}); // lives in the tray, never quit here
  app.whenReady().then(init);
  app.on('will-quit', () => {
    try { require('uiohook-napi').uIOhook.stop(); } catch {}
    win32.dispose();
  });
}

function init() {
  // no network: only local files and devtools
  session.defaultSession.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !/^(file|devtools):/i.test(d.url) }));
  createOverlay();
  createTray();
  startHook();
  win32.getForeground(); // warm up the powershell child (first start ~2.4s)
}

// ---------- overlay window ----------
function createOverlay() {
  const { bounds } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    ...bounds,
    transparent: true, frame: false, alwaysOnTop: true, skipTaskbar: true,
    resizable: false, movable: false, hasShadow: false, focusable: true, show: false,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  // switching away during input (Alt+Tab / Win key) cancels, so a non-click-through overlay never sticks; no refocus
  win.on('blur', () => { if (longSession && longSession.armed) endLong(false); });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('did-finish-load', () => {
    const { BAR_WIDTH, BAR_HEIGHT, BAR_BOTTOM, BAR_MAX_LINES, FLY_MS, PULSE_MS, SAVED_HOLD_MS } = config;
    win.webContents.send('config', { BAR_WIDTH, BAR_HEIGHT, BAR_BOTTOM, BAR_MAX_LINES, FLY_MS, PULSE_MS, SAVED_HOLD_MS });
  });
  win.webContents.on('render-process-gone', () => {
    if (longSession) endLong();
    win.webContents.reload();
  });
  win.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
}

function overlayHwnd() {
  const b = win.getNativeWindowHandle();
  return (b.length >= 8 ? b.readBigUInt64LE(0) : BigInt(b.readUInt32LE(0))).toString();
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
  if (tray) tray.displayBalloon({ title: NAME, content });
}

function save(text, thought, fg, date) {
  try {
    appendEntry(formatEntry({ text, thought, appName: fg && fg.processName, date }), NOTES);
    deduper.markSaved(text, Date.now());
    return true;
  } catch (e) {
    console.error('[tuck] write failed:', e.message);
    balloon('Could not write notes: ' + e.message);
    return false;
  }
}

// ---------- triggers ----------
async function onTrigger(mode) {
  if (paused || longSession) return;
  // don't block capture on the PowerShell cold start: wait at most 500ms, else omit the source app
  const fgP = Promise.race([win32.getForeground(), sleep(500).then(() => null)]);
  const [fg] = await Promise.all([fgP, sleep(config.CLIPBOARD_DELAY_MS)]);
  if (paused || longSession) return;
  const text = clipboard.readText();
  if (!text || !text.trim() || deduper.isDuplicate(text, Date.now())) return;

  const date = new Date();
  const id = ++seq;

  if (mode === 'long' && !fg) {
    // win32 helper not ready (cold start) or failing: we could neither take focus nor give it back
    balloon('Not ready yet, nothing was saved. Try again in a moment.');
    return;
  }

  const pos = placeOverlay();
  const payload = { id, preview: preview(text), x: pos.x, y: pos.y, mode };

  if (mode === 'double') {
    if (!save(text, '', fg, date)) return;
    doubleId = id;
    win.showInactive();
    win.webContents.send('capture', payload);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (doubleId === id && !longSession) hideOverlay(); }, config.FLY_MS + config.PULSE_MS + config.SAVED_HOLD_MS + 1000);
    return;
  }

  // long
  clearTimeout(hideTimer);
  const s = longSession = { id, text, fg, date, armed: false };
  win.showInactive();
  win.focus();
  // isFocused() can be true while the OS foreground did not change (seen in E2E), so trust only win32,
  // which reports true only when GetForegroundWindow() is really the overlay
  const ok = await win32.focusWindow(overlayHwnd());
  if (longSession !== s) return;
  if (!ok) {
    endLong(false);
    balloon('Could not take input focus, nothing was saved.');
    return;
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
  const back = refocus && s && s.fg ? win32.focusWindow(s.fg.hwnd) : Promise.resolve();
  back.then(async () => {
    if (seq !== mySeq) return;
    hideOverlay();
    if (!refocus || !s || !s.fg) return;
    // the OS sometimes reassigns focus right after (or the overlay keeps it): recheck and retry a few times
    for (let i = 0; i < 3; i++) {
      await sleep(120);
      if (seq !== mySeq || longSession) return;
      const now = await win32.getForeground();
      if (!now || now.hwnd === s.fg.hwnd) return;
      await win32.focusWindow(s.fg.hwnd);
    }
  });
}

const fromOverlay = (e) => win && e.sender === win.webContents;

ipcMain.on('anim-done', (e, id) => {
  if (fromOverlay(e) && id === doubleId && !longSession) hideOverlay();
});
ipcMain.on('submit', (e, id, thought) => {
  if (!fromOverlay(e) || !longSession || longSession.id !== id) return;
  const s = longSession;
  save(s.text, typeof thought === 'string' ? thought : '', s.fg, s.date);
  endLong();
});
ipcMain.on('cancel', (e, id) => {
  if (fromOverlay(e) && longSession && longSession.id === id) endLong();
});

// ---------- global keys (only Ctrl / C timing; no key is ever logged or stored) ----------
function startHook() {
  try {
    const { uIOhook, UiohookKey } = require('uiohook-napi');
    const K = UiohookKey;
    const keyOf = (code) => code === K.C ? 'c' : (code === K.Ctrl || code === K.CtrlRight) ? 'ctrl' : 'other';
    // uiohook's e.ctrlKey etc. read false on the first modifier press after start (mask not initialised),
    // so track modifiers ourselves too. Latest keydown (incl. auto-repeat) wins; 2s without repeat = released,
    // so a missed keyup can't leave a modifier stuck "down".
    const MODS = { ctrl: [K.Ctrl, K.CtrlRight], shift: [K.Shift, K.ShiftRight], alt: [K.Alt, K.AltRight], meta: [K.Meta, K.MetaRight] };
    const modAt = { ctrl: 0, shift: 0, alt: 0, meta: 0 };
    const feed = (type) => (e) => {
      const now = Date.now();
      for (const m in MODS) if (MODS[m].includes(e.keycode)) modAt[m] = type === 'keydown' ? now : 0;
      const held = (m) => !!e[m + 'Key'] || now - modAt[m] < 2000;
      const r = detector.handle({ type, key: keyOf(e.keycode), time: now,
        ctrl: held('ctrl'), shift: held('shift'), alt: held('alt'), meta: held('meta') });
      if (r) onTrigger(r);
    };
    uIOhook.on('keydown', feed('keydown'));
    uIOhook.on('keyup', feed('keyup'));
    uIOhook.start();
    setInterval(() => { const r = detector.tick(Date.now()); if (r) onTrigger(r); }, 30);
  } catch (e) {
    hookError = e.message;
    console.error('[tuck] uiohook unavailable:', e.message);
    updateTray();
    dialog.showMessageBox({ type: 'error', title: NAME, message: 'Global key hook unavailable. Ctrl+C capture will not work.', detail: e.message });
  }
}

// ---------- tray ----------
function createTray() {
  tray = new Tray(createTrayIcon(paused));
  updateTray();
}

// unpackaged (npm start): the Run entry must pass the app dir, or login opens Electron's default app
const loginOpts = () => (app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] });

function updateTray() {
  if (!tray) return;
  tray.setImage(createTrayIcon(paused || !!hookError));
  tray.setToolTip(hookError ? NAME + ' (key hook unavailable)' : paused ? NAME + ' (paused)' : NAME);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: paused ? 'Resume capture' : 'Pause capture', click: () => { paused = !paused; updateTray(); } },
    { label: 'Open notes', click: () => {
      // appendEntry('') creates the file with its header if missing and returns the absolute path
      try { shell.openPath(appendEntry('', NOTES)); } catch (e) { console.error('[tuck] open failed:', e.message); }
    } },
    { label: 'Open folder', click: () => {
      try { fs.mkdirSync(NOTES.dir, { recursive: true }); shell.openPath(NOTES.dir); } catch (e) { console.error('[tuck] open dir failed:', e.message); }
    } },
    { label: 'Start at login', type: 'checkbox', checked: app.getLoginItemSettings(loginOpts()).openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, ...loginOpts() }) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
}
