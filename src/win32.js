'use strict';
// Windows foreground/focus helpers: one persistent powershell.exe child + user32 P/Invoke (compiled once).
// The PowerShell source stays ASCII-only (machine code page is gb2312). Every API resolves null/false on failure, never throws.
const { spawn } = require('child_process');

const IS_WIN = process.platform === 'win32';
const TIMEOUT_MS = 800;
const STARTUP_TIMEOUT_MS = 8000; // first start + Add-Type compile is slow

const CS = [
  'using System; using System.Runtime.InteropServices;',
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
  '[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);',
  'public static string Fg() {',
  '  IntPtr h = GetForegroundWindow(); if (h == IntPtr.Zero) return "";',
  '  uint pid; GetWindowThreadProcessId(h, out pid); string name = "";',
  '  try { name = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName + ".exe"; } catch {}',
  '  return h.ToInt64().ToString() + "|" + name; }',
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
    console.error('[win32] spawn failed:', e.message);
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
  child.on('error', (e) => { console.error('[win32] powershell error:', e.message); dead(); });
  child.stdin.on('error', () => {});
  write('[Console]::OutputEncoding = [System.Text.Encoding]::UTF8');
  write('Add-Type -TypeDefinition ' + psQuote(CS));
  ready = run('"ok"', STARTUP_TIMEOUT_MS, true).then((r) => r === 'ok');
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
  const [hwnd, name] = r.split('|');
  if (!/^\d+$/.test(hwnd) || hwnd === '0') return null;
  return { hwnd, processName: name || null };
}

async function focusWindow(hwnd) {
  if (!/^\d+$/.test(String(hwnd || ''))) return false;
  return (await call(`[TuckW]::Focus(${hwnd})`)) === 'True';
}

function dispose() {
  if (!child) return;
  const c = child; child = null; ready = null;
  for (const r of pending.values()) r(null);
  pending.clear();
  try { c.stdin.end('exit\n'); } catch {}
  setTimeout(() => { try { c.kill(); } catch {} }, 300).unref();
}

module.exports = { getForeground, focusWindow, dispose };
