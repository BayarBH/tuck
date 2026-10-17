'use strict';
// macOS foreground/focus helpers. Same API as win32.js; hwnd is the app's pid (as a string).
// Every child process goes through execFile with a timeout. Every API resolves null/false on failure, never throws.
// Mac App Store build (process.mas): the sandbox allows no lsappinfo / osascript / open, so the tuck_mac addon
// answers instead (NSWorkspace); window titles are never read there.
const { execFile } = require('child_process');

let logError = (msg) => console.error(msg);
function setLogger(fn) { logError = fn; }

let native = null; // MAS: the tuck_mac addon, loaded on first use; tests inject a fake with setNative
function setNative(n) { native = n; }
const useNative = () => !!(native || process.mas);
const addon = () => native || (native = require('../macHook').native());
// -> { pid: '123', name } | null; never throws
function nativeFront() {
  try {
    const a = addon().frontApp();
    return a && a.pid > 0 ? { pid: String(a.pid), name: a.name || null } : null;
  } catch (e) {
    logError('frontApp failed: ' + e.message);
    return null;
  }
}

const LSAPPINFO = '/usr/bin/lsappinfo';
const OSASCRIPT = '/usr/bin/osascript';
const OPEN = '/usr/bin/open';
const LS_TIMEOUT_MS = 250;
const AS_TIMEOUT_MS = 600; // window title / activate via System Events: never wait longer than this

// -> trimmed stdout, or null (error, timeout, non-zero exit). stderr is passed to onErr for the denied check.
function run(file, args, timeout, onErr) {
  return new Promise((resolve) => {
    try {
      execFile(file, args, { timeout, encoding: 'utf8', maxBuffer: 256 * 1024 }, (err, out, errOut) => {
        if (err) { if (onErr) onErr(String(errOut || '') + ' ' + (err.message || '')); return resolve(null); }
        resolve(String(out).trim());
      });
    } catch (e) {
      logError('execFile ' + file + ' failed: ' + e.message);
      resolve(null);
    }
  });
}

// `lsappinfo front` -> "ASN:0x0-0x1b01b:" (or "[ NULL ]" when nothing is in front)
function parseFront(out) {
  const m = /ASN:0x[0-9a-f]+-0x[0-9a-f]+:?/i.exec(String(out || ''));
  return m ? m[0] : null;
}

const unq = (s) => s.replace(/\\(.)/g, '$1');
// `lsappinfo info -only name -only pid -only bundleID <ASN>` prints "key"="value" pairs, one per line
// ("LSDisplayName"="Google Chrome" / "pid"=1234 / "CFBundleIdentifier"="com.google.Chrome"), sometimes on one
// line. Also accepts the full `lsappinfo info` layout ("Name" ASN:...: / bundleID="..." / pid = 1234).
function parseInfo(out) {
  const s = String(out || '');
  const q = (re) => { const m = re.exec(s); return m ? unq(m[1]) : null; };
  const name = q(/"(?:LSDisplayName|name|CFBundleName)"\s*=\s*"((?:[^"\\]|\\.)*)"/i) || q(/^\s*"((?:[^"\\]|\\.)*)"\s+ASN:/m);
  const pidM = /"pid"\s*=\s*(\d+)/i.exec(s) || /(?:^|\s)pid\s*=\s*(\d+)/im.exec(s);
  const bundleID = q(/"(?:CFBundleIdentifier|bundleID)"\s*=\s*"((?:[^"\\]|\\.)*)"/i) || q(/(?:^|\s)bundleID\s*=\s*"((?:[^"\\]|\\.)*)"/im);
  const pid = pidM ? pidM[1] : null;
  if (!pid || pid === '0') return null;
  return { pid, name: name || null, bundleID: bundleID || null };
}

async function frontInfo() {
  const asn = parseFront(await run(LSAPPINFO, ['front'], LS_TIMEOUT_MS));
  if (!asn) return null;
  const info = parseInfo(await run(LSAPPINFO, ['info', '-only', 'name', '-only', 'pid', '-only', 'bundleID', asn], LS_TIMEOUT_MS));
  if (info && info.name) return info;
  // older lsappinfo builds honour only one -only: fall back to the full record
  return parseInfo(await run(LSAPPINFO, ['info', asn], LS_TIMEOUT_MS)) || info;
}

// Automation consent for System Events (-1743 = errAEEventNotPermitted). Once denied, stop asking for the
// rest of this run: every capture would otherwise spawn a doomed osascript.
let automationDenied = false;
const noteDenied = (err) => {
  if (/-1743|not authori[sz]ed|not allowed to send/i.test(err)) {
    if (!automationDenied) logError('System Events automation not permitted; window titles unavailable');
    automationDenied = true;
  }
};
const sysEvents = (pid, what) => run(OSASCRIPT,
  ['-e', `tell application "System Events" to ${what.replace('$P', `(first process whose unix id is ${pid})`)}`],
  AS_TIMEOUT_MS, noteDenied);

const bundles = new Map(); // pid -> bundle id, remembered from getForeground for the focusWindow fallback

async function getForeground() {
  if (useNative()) { const a = nativeFront(); return a ? { hwnd: a.pid, processName: a.name, title: null } : null; }
  const info = await frontInfo();
  if (!info) return null;
  if (info.bundleID) { bundles.set(info.pid, info.bundleID); if (bundles.size > 64) bundles.delete(bundles.keys().next().value); }
  // best effort: the title is used only in memory, for the exclusion list; null when not permitted / no window
  let title = null;
  if (!automationDenied && info.pid !== String(process.pid)) {
    const t = await sysEvents(info.pid, 'get name of front window of $P');
    if (t != null) title = t.replace(/[\r\n]+/g, ' ');
  }
  return { hwnd: info.pid, processName: info.name, title };
}

const frontPid = async () => { const i = useNative() ? nativeFront() : await frontInfo(); return i ? i.pid : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function focusWindow(pid) {
  pid = String(pid || '');
  if (!/^\d+$/.test(pid) || pid === '0') return false;
  if (useNative()) {
    try { addon().activate(Number(pid)); } catch (e) { logError('activate failed: ' + e.message); }
    for (let i = 0; i < 4; i++) {
      if ((await frontPid()) === pid) return true;
      await sleep(80);
    }
    return false;
  }
  if (!automationDenied) {
    await sysEvents(pid, 'set frontmost of $P to true');
    if ((await frontPid()) === pid) return true;
  }
  const bundle = bundles.get(pid);
  if (!bundle) return (await frontPid()) === pid;
  // no consent needed: LaunchServices activates the running app with that bundle id
  await run(OPEN, ['-b', bundle], 1500);
  for (let i = 0; i < 4; i++) {
    if ((await frontPid()) === pid) return true;
    await sleep(80);
  }
  return false;
}

// nspasteboard.org markers set by 1Password, Bitwarden, KeePassXC, ... The marker data is often empty,
// so presence of the type counts, not its length.
const PRIVATE_TYPES = ['org.nspasteboard.ConcealedType', 'org.nspasteboard.TransientType', 'org.nspasteboard.AutoGeneratedType'];

// true = clipboard marked private by its owner, false = normal, null = could not check
async function clipboardPrivate() {
  try {
    const { clipboard } = require('electron');
    const formats = clipboard.availableFormats();
    return PRIVATE_TYPES.some((t) => formats.includes(t) || clipboard.has(t) || clipboard.readBuffer(t).length > 0);
  } catch (e) {
    logError('clipboard check failed: ' + e.message);
    return null;
  }
}

function dispose() {} // no persistent child on macOS

module.exports = { getForeground, focusWindow, clipboardPrivate, dispose, setLogger, setNative, frontPid, parseFront, parseInfo, PRIVATE_TYPES };
