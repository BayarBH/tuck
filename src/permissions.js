'use strict';
// macOS Accessibility trust (needed by the global key hook). Other platforms: always trusted, no-ops.
// createPermissions({ logger }) -> { isTrusted(), request(), openSettings(), onChange(cb) -> unsubscribe }
// onChange(cb) fires cb(true) once when trust is granted (polled every 2 s while untrusted).

// the only URL this module ever opens: a local OS deep link to System Settings > Privacy > Accessibility
const ACCESSIBILITY_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';
const POLL_MS = 2000;

function createPermissions({ logger, platform = process.platform, systemPreferences, shell, pollMs = POLL_MS } = {}) {
  if (platform !== 'darwin') {
    return { isTrusted: () => true, request: () => {}, openSettings: () => {}, onChange: () => () => {} };
  }
  const electron = (systemPreferences && shell) ? null : require('electron');
  const sp = systemPreferences || electron.systemPreferences;
  const sh = shell || electron.shell;
  const log = (lvl, m) => { if (logger) logger[lvl]('permissions', m); };
  const listeners = [];
  let timer = null;

  const isTrusted = () => { try { return !!sp.isTrustedAccessibilityClient(false); } catch (e) { log('error', e); return false; } };

  function poll() {
    if (timer || isTrusted()) return;
    timer = setInterval(() => {
      if (!isTrusted()) return;
      clearInterval(timer); timer = null;
      log('info', 'accessibility granted');
      for (const cb of [...listeners]) { try { cb(true); } catch (e) { log('error', e); } }
    }, pollMs);
    if (timer.unref) timer.unref();
  }

  // the system prompt ("Tuck would like to control this computer...") shows only while untrusted
  function request() {
    try { sp.isTrustedAccessibilityClient(true); } catch (e) { log('error', e); }
    poll();
  }

  function openSettings() {
    Promise.resolve().then(() => sh.openExternal(ACCESSIBILITY_URL)).catch((e) => log('warn', 'open settings failed: ' + e.message));
    poll();
  }

  poll();
  return {
    isTrusted, request, openSettings,
    onChange: (cb) => { listeners.push(cb); poll(); return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); }; },
  };
}

module.exports = { createPermissions, ACCESSIBILITY_URL };
