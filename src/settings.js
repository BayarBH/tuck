'use strict';
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { writeFileAtomic } = require('./fsAtomic');

const DEFAULTS = Object.freeze({
  notesDir: config.NOTES_DIR,
  notesFile: config.NOTES_FILE,
  longPressMs: config.LONG_PRESS_MS,
  doubleGapMs: config.DOUBLE_GAP_MS,
  dedupeMs: config.DEDUPE_MS,
  animSpeed: 1,
  excludeApps: ['1password.exe', 'keepass.exe', 'keepassxc.exe', 'bitwarden.exe', 'dashlane.exe', 'lastpass.exe', 'enpass.exe', 'keeper.exe'],
  excludeTitles: ['bank', 'banking', '网上银行', '银行', 'password', '密码', 'sign in', 'login', '登录'],
  autoUpdate: false,
  onboardingDone: false,
  dailyNotification: false,
  dailyNotificationTime: '09:00',
});

const int = (lo, hi) => (v) => (Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);
const bool = (v) => (typeof v === 'boolean' ? v : undefined);
const strList = (lower) => (v) => (Array.isArray(v) && v.every((s) => typeof s === 'string')
  ? [...new Set(v.map((s) => (lower ? s.trim().toLowerCase() : s.trim())).filter(Boolean))] : undefined);

// each validator returns the normalized value, or undefined if invalid
const VALIDATE = {
  notesDir: (v) => (typeof v === 'string' && v.trim() && path.isAbsolute(v.trim()) ? v.trim() : undefined),
  notesFile: (v) => (typeof v === 'string' && /^[^\\/:*?"<>|]+\.md$/i.test(v.trim()) ? v.trim() : undefined),
  longPressMs: int(200, 3000),
  doubleGapMs: int(200, 3000),
  dedupeMs: int(0, 60000),
  animSpeed: (v) => (typeof v === 'number' && v >= 0.5 && v <= 2 ? v : undefined),
  excludeApps: strList(true),
  excludeTitles: strList(false),
  autoUpdate: bool,
  onboardingDone: bool,
  dailyNotification: bool,
  dailyNotificationTime: (v) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : undefined),
};

// Persisted JSON holds only keys that were explicitly set. TUCK_NOTES_DIR (tests) overrides notesDir
// at runtime and is never persisted by itself.
function createSettings({ file, logger }) {
  let stored = {};
  let unread = false; // file exists but could not be read (AV / sync lock): never write over it
  const listeners = [];
  const warn = (m) => (logger ? logger.warn('settings', m) : console.error('[tuck] settings: ' + m));

  // -> true when the file was read (or does not exist)
  function load() {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) {
      if (e.code === 'ENOENT') return true;
      warn('read failed: ' + (e.code || e.message));
      return false;
    }
    let raw;
    try { raw = JSON.parse(text); } catch {
      // corrupt file: keep it aside for inspection, start from defaults
      const bad = `${file}.${new Date().toISOString().replace(/[:.]/g, '-')}.bad`;
      try { fs.renameSync(file, bad); } catch {}
      warn('invalid JSON, kept aside as ' + path.basename(bad));
      return true;
    }
    stored = {};
    for (const k of Object.keys(VALIDATE)) {
      if (raw && raw[k] !== undefined) { const v = VALIDATE[k](raw[k]); if (v !== undefined) stored[k] = v; }
    }
    return true;
  }
  unread = !load();

  const all = () => {
    const a = { ...DEFAULTS, ...stored };
    if (process.env.TUCK_NOTES_DIR) a.notesDir = process.env.TUCK_NOTES_DIR;
    return JSON.parse(JSON.stringify(a)); // callers can't mutate our state
  };

  // Throws TypeError (nothing applied) if any key is unknown or invalid. Returns all().
  function set(patch) {
    const clean = {};
    const bad = [];
    for (const [k, v] of Object.entries(patch || {})) {
      const val = VALIDATE[k] ? VALIDATE[k](v) : undefined;
      if (val === undefined) bad.push(k); else clean[k] = val;
    }
    if (bad.length) throw new TypeError('Invalid settings: ' + bad.join(', '));
    if (unread) unread = !load(); // retry: the lock may be gone now
    const prev = all();
    const changed = Object.keys(clean).filter((k) => JSON.stringify(clean[k]) !== JSON.stringify(prev[k]));
    if (!changed.length) return prev;
    const next = { ...stored, ...clean };
    // still unreadable: refuse (not applied = nothing silently lost on restart), keep the user's file as it is
    if (unread) throw new Error('The settings file is locked by another program. Try again in a moment.');
    writeFileAtomic(file, JSON.stringify(next, null, 2) + '\n');
    stored = next;
    const now = all();
    for (const cb of listeners) { try { cb(now, changed); } catch (e) { console.error('[tuck] settings listener:', e); } }
    return now;
  }

  return {
    get: (key) => all()[key],
    all,
    set,
    onChange: (cb) => { listeners.push(cb); return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); }; },
  };
}

module.exports = { createSettings, DEFAULTS };
