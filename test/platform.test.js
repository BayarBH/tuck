'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { keyMap } = require('../src/keys');
const { createKeyDetector } = require('../src/keyDetector');
const darwin = require('../src/platform/darwin');
const { parseFront, parseInfo } = darwin;
const { parseVisibleApps } = require('../src/diagnostics');
const { isExcluded } = require('../src/exclude');
const { defaultsFor, createSettings } = require('../src/settings');
const { createPermissions, ACCESSIBILITY_URL, INPUT_MONITORING_URL } = require('../src/permissions');

// the uiohook-napi UiohookKey values that matter here
const K = { C: 46, Ctrl: 29, CtrlRight: 3613, Shift: 42, ShiftRight: 54, Alt: 56, AltRight: 3640, Meta: 3675, MetaRight: 3676, V: 47 };

test('keys: Windows triggers on Ctrl, Meta is "other"', () => {
  const m = keyMap('win32', K);
  assert.equal(m.keyOf(K.C), 'c');
  assert.equal(m.keyOf(K.Ctrl), 'ctrl');
  assert.equal(m.keyOf(K.CtrlRight), 'ctrl');
  assert.equal(m.keyOf(K.Meta), 'other');
  assert.equal(m.keyOf(K.V), 'other');
  assert.deepEqual(m.mods.ctrl, [K.Ctrl, K.CtrlRight]);
  assert.deepEqual(m.mods.meta, [K.Meta, K.MetaRight]);
  assert.deepEqual(m.flags, { ctrl: 'ctrlKey', shift: 'shiftKey', alt: 'altKey', meta: 'metaKey' });
});

test('keys: macOS triggers on Command, physical Control is "other" (fed as meta)', () => {
  const m = keyMap('darwin', K);
  assert.equal(m.keyOf(K.Meta), 'ctrl');
  assert.equal(m.keyOf(K.MetaRight), 'ctrl');
  assert.equal(m.keyOf(K.Ctrl), 'other');
  assert.equal(m.keyOf(K.C), 'c');
  assert.deepEqual(m.mods.ctrl, [K.Meta, K.MetaRight]);
  assert.deepEqual(m.mods.meta, [K.Ctrl, K.CtrlRight]);
  assert.deepEqual(m.mods.shift, [K.Shift, K.ShiftRight]);
  assert.equal(m.flags.ctrl, 'metaKey');
  assert.equal(m.flags.meta, 'ctrlKey');

  // end to end through the unchanged detector, with uiohook-style events
  const feed = (det, type, code, e = {}) => {
    const held = (g) => !!e[m.flags[g]];
    return det.handle({ type, key: m.keyOf(code), time: e.t, ctrl: held('ctrl'), shift: held('shift'), alt: held('alt'), meta: held('meta') });
  };
  const tap = (det, t, e) => [feed(det, 'keydown', K.C, { ...e, t }), feed(det, 'keyup', K.C, { ...e, t: t + 60 })];
  const d = createKeyDetector({ longPressMs: 600, doubleGapMs: 1000 });
  feed(d, 'keydown', K.Meta, { metaKey: true, t: 0 });
  assert.deepEqual([...tap(d, 10, { metaKey: true }), ...tap(d, 200, { metaKey: true })], [null, null, null, 'double']);
  const d2 = createKeyDetector({ longPressMs: 600, doubleGapMs: 1000 });
  // Ctrl+Cmd+C is not a capture; plain Ctrl+C on a Mac is not either
  assert.deepEqual([...tap(d2, 10, { metaKey: true, ctrlKey: true }), ...tap(d2, 200, { metaKey: true, ctrlKey: true })], [null, null, null, null]);
  assert.deepEqual([...tap(d2, 1500, { ctrlKey: true }), ...tap(d2, 1700, { ctrlKey: true })], [null, null, null, null]);
});

test('lsappinfo: front ASN and info records', () => {
  assert.equal(parseFront('ASN:0x0-0x1b01b:\n'), 'ASN:0x0-0x1b01b:');
  assert.equal(parseFront('[ NULL ]'), null);
  assert.equal(parseFront(''), null);
  assert.deepEqual(parseInfo('"LSDisplayName"="Google Chrome"\n"pid"=1234\n"CFBundleIdentifier"="com.google.Chrome"\n'),
    { pid: '1234', name: 'Google Chrome', bundleID: 'com.google.Chrome' });
  assert.deepEqual(parseInfo('"CFBundleIdentifier"="com.agilebits.onepassword7", "LSDisplayName"="1Password 7", "pid"=88'),
    { pid: '88', name: '1Password 7', bundleID: 'com.agilebits.onepassword7' });
  // full `lsappinfo info` layout
  const full = [
    '"Keychain Access" ASN:0x0-0x5c05c: ',
    '    bundleID="com.apple.keychainaccess"',
    '    bundle path="/System/Applications/Utilities/Keychain Access.app"',
    '    pid = 4321 type="Foreground" flavor=3 Version="11.0" fileType="APPL" creator="????" Arch=ARM64 ',
    '    parentASN="launchservicesd" ASN:0x0-0xd00d: ',
  ].join('\n');
  assert.deepEqual(parseInfo(full), { pid: '4321', name: 'Keychain Access', bundleID: 'com.apple.keychainaccess' });
  assert.deepEqual(parseInfo('"LSDisplayName"="A \\"quoted\\" app"\n"pid"=7'), { pid: '7', name: 'A "quoted" app', bundleID: null });
  assert.equal(parseInfo('"LSDisplayName"="X"'), null); // no pid
  assert.equal(parseInfo('"pid"=0'), null);
  assert.equal(parseInfo(null), null);
});

test('lsappinfo visibleProcessList -> lowercased app names without Tuck', () => {
  assert.deepEqual(parseVisibleApps('ASN:0x0-0x1b01b:"Terminal" ASN:0x0-0x1001:"Finder" ASN:0x0-0x2002:"Tuck" ASN:0x0-0x3003:"Google Chrome"\n'),
    ['finder', 'google chrome', 'terminal']);
  assert.deepEqual(parseVisibleApps(''), []);
});

test('settings defaults per platform; mac names match the exclusion list', () => {
  const win = defaultsFor('win32'), mac = defaultsFor('darwin');
  assert.ok(win.excludeApps.includes('keepassxc.exe'));
  assert.ok(mac.excludeApps.includes('1Password 7') && mac.excludeApps.includes('Keychain Access'));
  assert.deepEqual(win.excludeTitles, mac.excludeTitles);
  const missing = require('path').join(require('os').tmpdir(), `tuck-none-${process.pid}`, 'settings.json');
  assert.deepEqual(createSettings({ file: missing, platform: 'darwin' }).get('excludeApps'), mac.excludeApps);
  assert.deepEqual(createSettings({ file: missing, platform: 'win32' }).get('excludeApps'), win.excludeApps);
  const lists = { apps: mac.excludeApps, titles: mac.excludeTitles };
  assert.equal(isExcluded({ processName: 'KeePassXC', title: 'db' }, lists), true);
  assert.equal(isExcluded({ processName: 'keychain access', title: null }, lists), true);
  assert.equal(isExcluded({ processName: '1Password 7', title: null }, lists), true);
  assert.equal(isExcluded({ processName: 'Google Chrome', title: null }, lists), false); // title unknown -> not excluded
  assert.equal(isExcluded({ processName: 'Google Chrome', title: 'Online Banking' }, lists), true);
  assert.equal(isExcluded({ processName: '1Password Helper', title: '' }, lists), false); // exact name only
});

test('permissions: non-mac always trusted; mac polls until granted', async () => {
  const w = createPermissions({ platform: 'win32' });
  assert.equal(w.isTrusted(), true);
  let trusted = false;
  const asked = [], opened = [];
  const sp = { isTrustedAccessibilityClient: (prompt) => { asked.push(prompt); return trusted; } };
  const p = createPermissions({ platform: 'darwin', systemPreferences: sp, shell: { openExternal: async (u) => opened.push(u) }, pollMs: 10 });
  assert.equal(p.isTrusted(), false);
  const fired = new Promise((resolve) => p.onChange(resolve));
  p.request();
  p.openSettings();
  assert.ok(asked.includes(true));
  trusted = true;
  // the poll timer is unref'd (it must not keep the app alive), so hold the event loop open
  // while waiting, or Node 20 exits before the poll fires
  const keepAlive = setTimeout(() => {}, 5000);
  assert.equal(await fired, true);
  clearTimeout(keepAlive);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(opened, [ACCESSIBILITY_URL]);
});

test('permissions: Mac App Store asks for Input Monitoring through the addon', async () => {
  assert.equal(createPermissions({ platform: 'win32', mas: true }).name, 'Accessibility');
  assert.equal(createPermissions({ platform: 'darwin', mas: false, systemPreferences: { isTrustedAccessibilityClient: () => true }, shell: {} }).name, 'Accessibility');
  let trusted = false, requested = 0;
  const opened = [];
  const native = { listenAccess: () => trusted, requestListenAccess: () => { requested++; return false; } };
  const p = createPermissions({ platform: 'darwin', mas: true, native, shell: { openExternal: async (u) => opened.push(u) }, pollMs: 10 });
  assert.equal(p.name, 'Input Monitoring');
  assert.equal(p.isTrusted(), false);
  const fired = new Promise((resolve) => p.onChange(resolve));
  p.request();
  p.openSettings();
  assert.equal(requested, 1);
  trusted = true;
  assert.equal(p.isTrusted(), true);
  const keepAlive = setTimeout(() => {}, 5000); // the poll timer is unref'd
  assert.equal(await fired, true);
  clearTimeout(keepAlive);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(opened, [INPUT_MONITORING_URL]);
  // a broken addon reads as "not trusted", never throws
  const broken = createPermissions({ platform: 'darwin', mas: true, native: { listenAccess: () => { throw new Error('x'); } }, shell: {}, pollMs: 100000 });
  assert.equal(broken.isTrusted(), false);
});

test('darwin: Mac App Store foreground/focus come from the addon only (no titles)', async () => {
  let front = { pid: 42, name: 'Safari', bundleID: 'com.apple.Safari' };
  const activated = [];
  darwin.setNative({ frontApp: () => front, activate: (pid) => { activated.push(pid); front = { pid, name: 'Notes', bundleID: 'x' }; return true; } });
  try {
    assert.deepEqual(await darwin.getForeground(), { hwnd: '42', processName: 'Safari', title: null });
    assert.equal(await darwin.frontPid(), '42');
    assert.equal(await darwin.focusWindow('77'), true);
    assert.deepEqual(activated, [77]);
    assert.equal(await darwin.focusWindow('0'), false);
    assert.equal(await darwin.focusWindow('abc'), false);
    assert.deepEqual(activated, [77]);
    front = null;
    assert.equal(await darwin.getForeground(), null);
    assert.equal(await darwin.frontPid(), null);
    // activation that does not take: polls, then gives up
    darwin.setNative({ frontApp: () => ({ pid: 1, name: 'Finder' }), activate: () => false });
    assert.equal(await darwin.focusWindow('77'), false);
    darwin.setNative({ frontApp: () => { throw new Error('boom'); } });
    darwin.setLogger(() => {});
    assert.equal(await darwin.getForeground(), null);
  } finally {
    darwin.setNative(null);
    darwin.setLogger((m) => console.error(m));
  }
});
