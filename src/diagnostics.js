'use strict';
// Diagnostics for the Settings window. No electron import (testable with node --test): callers pass app/screen.
// PRIVACY: rows hold versions, states, counts, paths and times only. Never note text, window titles or keys.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

// one-shot powershell (ASCII-only source). Resolves trimmed stdout, or null on any failure.
function ps(command, timeout = 8000) {
  if (process.platform !== 'win32') return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command],
      { windowsHide: true, timeout, encoding: 'utf8' },
      (err, out) => resolve(err ? null : String(out).trim()));
  });
}

// Process names of running apps that own a visible main window (names only, nothing else), as "name.exe".
async function listWindowedApps() {
  const out = await ps('Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | ForEach-Object { $_.ProcessName }');
  if (out == null) return null;
  const skip = new Set(['tuck.exe', 'electron.exe', 'applicationframehost.exe', 'textinputhost.exe']);
  return [...new Set(out.split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean).map((s) => s + '.exe'))]
    .filter((s) => !skip.has(s)).sort();
}

// true = Tuck runs elevated (powershell child inherits our token), false = normal, null = unknown
async function isElevated() {
  const out = await ps('([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)');
  return out === 'True' ? true : out === 'False' ? false : null;
}

// Really try to create (and remove) a probe file: fs.access W_OK means little on Windows.
function probeWritable(dir) {
  const probe = path.join(dir, `.tuck-write-test-${process.pid}-${Date.now()}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(probe, 'ok', { flag: 'wx' });
    fs.unlinkSync(probe); // only ever our own probe file
    return { ok: true };
  } catch (e) {
    try { fs.unlinkSync(probe); } catch {}
    return { ok: false, error: e.code || e.message };
  }
}

const pad = (n) => String(n).padStart(2, '0');
const localTime = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
function ago(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `${(s / 3600).toFixed(1)} h ago`;
}

// -> [{ label, value, state: 'ok'|'warn'|'bad'|'' }]
async function collect({ app, screen, settings, store, logger, status, now = Date.now(), elevated }) {
  const st = (status && status()) || {};
  const s = settings.all();
  const rows = [];
  const row = (label, value, state = '') => rows.push({ label, value: String(value), state });

  row('Tuck', `${app.getVersion()} (${app.isPackaged ? 'installed' : 'dev'})`);
  row('Electron / Chromium / Node', `${process.versions.electron} / ${process.versions.chrome} / ${process.versions.node}`);
  row('Windows', `${os.release()} ${process.arch}`);
  row('Key hook', st.hookError ? 'failed: ' + st.hookError : st.hookLoaded ? 'loaded' : 'not started', st.hookError ? 'bad' : st.hookLoaded ? 'ok' : 'warn');
  row('Capture', st.paused ? 'paused' : 'active', st.paused ? 'warn' : 'ok');
  const lt = st.lastTrigger;
  row('Last trigger', lt && lt.at ? `${localTime(lt.at)} (${lt.mode === 'long' ? 'long-press' : 'double-tap'}, ${ago(now - lt.at)})` : 'none since start');
  const el = elevated === undefined ? await isElevated() : elevated;
  row('Running as administrator', el == null ? 'unknown' : el ? 'yes' : 'no', el ? 'warn' : '');

  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay().id;
  const scales = new Set(displays.map((d) => d.scaleFactor));
  row('Displays', `${displays.length}${scales.size > 1 ? ' (mixed scaling)' : ''}`);
  displays.forEach((d, i) => row(`Display ${i + 1}${d.id === primary ? ' (primary)' : ''}`,
    `${d.size.width}x${d.size.height} at ${Math.round(d.scaleFactor * 100)}%, origin ${d.bounds.x},${d.bounds.y}`));

  const file = path.resolve(s.notesDir, s.notesFile);
  row('Notes file', file + (process.env.TUCK_NOTES_DIR ? ' (TUCK_NOTES_DIR override)' : ''));
  const w = probeWritable(s.notesDir);
  row('Notes folder writable', w.ok ? 'yes' : 'no: ' + w.error, w.ok ? 'ok' : 'bad');
  let size = null;
  try { size = fs.statSync(file).size; } catch {}
  let count = '';
  if (size != null) { try { count = `, ${store.read().entries.length} entries`; } catch (e) { count = ', unreadable: ' + (e.code || 'error'); } }
  row('Notes', size == null ? 'no file yet' : `${(size / 1024).toFixed(1)} KB${count}`);
  row('Exclusions', `${s.excludeApps.length} apps, ${s.excludeTitles.length} title keywords`);
  row('Auto-update', s.autoUpdate ? 'on' : 'off');
  row('Log file', logger.file);
  return rows;
}

const format = (rows) => ['Tuck diagnostics ' + new Date().toISOString(), ...rows.map((r) => `${r.label}: ${r.value}`)].join('\n');

module.exports = { collect, format, probeWritable, listWindowedApps, isElevated };
