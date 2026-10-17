'use strict';
// macOS Accessibility trust (needed by the global key hook). Other platforms: always trusted, no-ops.
// Mac App Store build (process.mas): the sandbox can't get Accessibility, so the listen-only key tap of the
// tuck_mac addon needs Input Monitoring instead.
// createPermissions({ logger }) -> { name, isTrusted(), request(), openSettings(), onChange(cb) -> unsubscribe }
// name: 'Accessibility' | 'Input Monitoring', for user-facing text.
// onChange(cb) fires cb(true) once when trust is granted (polled every 2 s while untrusted).

// the only URLs this module ever opens: local OS deep links to System Settings > Privacy
const ACCESSIBILITY_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';
const INPUT_MONITORING_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent';
const POLL_MS = 2000;

function createPermissions({ logger, platform = process.platform, systemPreferences, shell, pollMs = POLL_MS, mas = !!process.mas, native } = {}) {
  if (platform !== 'darwin') {
    return { name: 'Accessibility', isTrusted: () => true, request: () => {}, openSettings: () => {}, onChange: () => () => {} };
  }
  const electron = ((systemPreferences || mas) && shell) ? null : require('electron');
  const sp = systemPreferences || (electron && electron.systemPreferences);
  const sh = shell || electron.shell;
  // lazy: a missing addon must not take the app down, isTrusted just reads false (and logs)
  const nat = () => native || require('./macHook').native();
  const log = (lvl, m) => { if (logger) logger[lvl]('permissions', m); };
  const listeners = [];
  let timer = null;

  const check = mas ? () => nat().listenAccess() : () => sp.isTrustedAccessibilityClient(false);
  let failed = false; // log a failing check once, not on every 2 s poll
  const isTrusted = () => { try { return !!check(); } catch (e) { if (!failed) log('error', e); failed = true; return false; } };

  function poll() {
    if (timer || isTrusted()) return;
    timer = setInterval(() => {
      if (!isTrusted()) return;
      clearInterval(timer); timer = null;
      log('info', (mas ? 'input monitoring' : 'accessibility') + ' granted');
      for (const cb of [...listeners]) { try { cb(true); } catch (e) { log('error', e); } }
    }, pollMs);
    if (timer.unref) timer.unref();
  }

  // the system prompt ("Tuck would like to control this computer..." / "...receive keystrokes...") shows only while untrusted
  function request() {
    try { if (mas) nat().requestListenAccess(); else sp.isTrustedAccessibilityClient(true); } catch (e) { log('error', e); }
    poll();
  }

  function openSettings() {
    Promise.resolve().then(() => sh.openExternal(mas ? INPUT_MONITORING_URL : ACCESSIBILITY_URL)).catch((e) => log('warn', 'open settings failed: ' + e.message));
    poll();
  }

  poll();
  return {
    name: mas ? 'Input Monitoring' : 'Accessibility', isTrusted, request, openSettings,
    onChange: (cb) => { listeners.push(cb); poll(); return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); }; },
  };
}

module.exports = { createPermissions, ACCESSIBILITY_URL, INPUT_MONITORING_URL };
