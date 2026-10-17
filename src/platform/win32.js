'use strict';
// Windows foreground/focus helpers: one persistent powershell.exe child + user32 P/Invoke (compiled once).
// The PowerShell source stays ASCII-only (machine code page is gb2312). Every API resolves null/false on failure, never throws.
const { spawn } = require('child_process');

let logError = (msg) => console.error(msg);
function setLogger(fn) { logError = fn; }

const IS_WIN = process.platform === 'win32';
const TIMEOUT_MS = 800;
const STARTUP_TIMEOUT_MS = 8000; // first start + Add-Type compile is slow

const CS = [
  'using System; using System.Text; using System.Runtime.InteropServices;',
  'public static class TuckW {',
  '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);',
  '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);',
  '[DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);',
  '[DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);',
  '[DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();',
  '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);',
  '[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);',
  '[DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);',
  '[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);',
  '[DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);',
  '[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);',
  '[DllImport("user32.dll")] public static extern bool IsClipboardFormatAvailable(uint f);',
  '[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern uint RegisterClipboardFormat(string n);',
  '[DllImport("user32.dll")] public static extern bool OpenClipboard(IntPtr h);',
  '[DllImport("user32.dll")] public static extern bool CloseClipboard();',
  '[DllImport("user32.dll")] public static extern IntPtr GetClipboardData(uint f);',
  '[DllImport("kernel32.dll")] public static extern IntPtr GlobalLock(IntPtr h);',
  '[DllImport("kernel32.dll")] public static extern bool GlobalUnlock(IntPtr h);',
  // "1" when the clipboard owner (password managers) marked the data private: the standard
  // ExcludeClipboardContentFromMonitorProcessing format, or CanIncludeInClipboardHistory = 0 (unreadable = private)
  'public static string ClipPrivate() {',
  '  if (IsClipboardFormatAvailable(RegisterClipboardFormat("ExcludeClipboardContentFromMonitorProcessing"))) return "1";',
  '  uint ci = RegisterClipboardFormat("CanIncludeInClipboardHistory"); if (!IsClipboardFormatAvailable(ci)) return "0";',
  '  bool priv = true; if (OpenClipboard(IntPtr.Zero)) { try { IntPtr h = GetClipboardData(ci);',
  '    IntPtr p = h == IntPtr.Zero ? IntPtr.Zero : GlobalLock(h); if (p != IntPtr.Zero) { priv = Marshal.ReadInt32(p) == 0; GlobalUnlock(h); }',
  '  } finally { CloseClipboard(); } }',
  '  return priv ? "1" : "0"; }',
  // "hwnd|name|title"; the title (used only in memory, for the exclusion list) goes last since it may contain "|"
  'public static string Fg() {',
  '  IntPtr h = GetForegroundWindow(); if (h == IntPtr.Zero) return "";',
  '  uint pid; GetWindowThreadProcessId(h, out pid); string name = "";',
  '  try { name = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName + ".exe"; } catch {}',
  '  int n = GetWindowTextLength(h); StringBuilder sb = new StringBuilder(Math.Min(Math.Max(n, 0), 1024) + 1);',
  '  GetWindowText(h, sb, sb.Capacity); string t = sb.ToString().Replace((char)13, (char)32).Replace((char)10, (char)32);',
  '  return h.ToInt64().ToString() + "|" + name + "|" + t; }',
  'static bool Try(IntPtr h) {',
  '  IntPtr fg = GetForegroundWindow(); uint p; uint fgT = GetWindowThreadProcessId(fg, out p); uint me = GetCurrentThreadId();',
  '  bool att = fgT != 0 && fgT != me && AttachThreadInput(me, fgT, true);',
  '  BringWindowToTop(h); SetForegroundWindow(h);',
  '  if (att) AttachThreadInput(me, fgT, false);',
  '  return GetForegroundWindow() == h; }',
  'public static bool Focus(long v) {',
  '  IntPtr h = new IntPtr(v); if (!IsWindow(h)) return false;',
  '  if (IsIconic(h)) ShowWindow(h, 9);',
  '  if (GetForegroundWindow() == h || Try(h)) return true;',
  // ALT trick: a synthetic Alt down makes us the 'last input' process and lifts the foreground lock.
  // Focus is switched between down and up so the target never sees a full Alt tap (DefWindowProc enters menu mode only after seeing both).
  '  keybd_event(0x12, 0, 0, UIntPtr.Zero); bool ok = Try(h); keybd_event(0x12, 0, 2, UIntPtr.Zero);',
  '  return ok || GetForegroundWindow() == h; }',
  '}',
].join(' ');

let child = null;
let ready = null;      // Promise<boolean>
let buf = '';
let seq = 0;
const pending = new Map(); // id -> resolve(lineOrNull)

function psQuote(s) { return "'" + s.replace(/'/g, "''") + "'"; }

function start() {
  if (child) return ready;
  try {
    child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'], {
      windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch (e) {
    logError('spawn failed: ' + e.message);
    child = null; return Promise.resolve(false);
  }
  const me = child;
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1);
      const m = /^@@(\d+) ?(.*)$/.exec(line);
      if (m && pending.has(+m[1])) { pending.get(+m[1])(m[2]); pending.delete(+m[1]); }
    }
  });
  const dead = () => {
    if (child !== me) return;
    child = null; ready = null; buf = '';
    for (const r of pending.values()) r(null);
    pending.clear();
  };
  child.on('exit', dead);
  child.on('error', (e) => { logError('powershell error: ' + e.message); dead(); });
  child.stdin.on('error', () => {});
  write('[Console]::OutputEncoding = [System.Text.Encoding]::UTF8');
  write('Add-Type -TypeDefinition ' + psQuote(CS));
  // a slow start (busy machine right after login) must not leave a stuck "not ready" forever: drop this child so the next call retries
  ready = run('"ok"', STARTUP_TIMEOUT_MS, true).then((r) => {
    if (r === 'ok') return true;
    if (child === me) { logError('powershell helper did not start in time, will retry'); dead(); try { me.kill(); } catch {} }
    return false;
  });
  return ready;
}

function write(line) {
  try { child.stdin.write(line + '\n'); return true; } catch { return false; }
}

// send one PowerShell expression; the reply comes back as "@@id result"; timeout resolves null
function run(expr, timeout, raw) {
  return new Promise((resolve) => {
    if (!child) return resolve(null);
    const id = ++seq;
    const t = setTimeout(() => { pending.delete(id); resolve(null); }, timeout);
    pending.set(id, (v) => { clearTimeout(t); resolve(v); });
    // per-command try/catch so there is always exactly one reply line
    const line = raw
      ? `Write-Output ("@@${id} " + (${expr}))`
      : `try { Write-Output ("@@${id} " + (${expr})) } catch { Write-Output "@@${id} " }`;
    if (!write(line)) { pending.delete(id); clearTimeout(t); resolve(null); }
  });
}

async function call(expr) {
  if (!IS_WIN) return null;
  if (!(await start())) return null;
  return run(expr, TIMEOUT_MS);
}

async function getForeground() {
  const r = await call('[TuckW]::Fg()');
  if (!r) return null;
  const [hwnd, name = ''] = r.split('|', 2);
  if (!/^\d+$/.test(hwnd) || hwnd === '0') return null;
  const title = r.slice(hwnd.length + name.length + 2);
  return { hwnd, processName: name || null, title };
}

async function focusWindow(hwnd) {
  if (!/^\d+$/.test(String(hwnd || ''))) return false;
  return (await call(`[TuckW]::Focus(${hwnd})`)) === 'True';
}

// true = clipboard marked private by its owner, false = normal, null = could not check
async function clipboardPrivate() {
  const r = await call('[TuckW]::ClipPrivate()');
  return r === '1' ? true : r === '0' ? false : null;
}

function dispose() {
  if (!child) return;
  const c = child; child = null; ready = null;
  for (const r of pending.values()) r(null);
  pending.clear();
  try { c.stdin.end('exit\n'); } catch {}
  setTimeout(() => { try { c.kill(); } catch {} }, 300).unref();
}

module.exports = { getForeground, focusWindow, clipboardPrivate, dispose, setLogger };
