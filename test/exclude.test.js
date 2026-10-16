'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isExcluded } = require('../src/exclude');
const { DEFAULTS } = require('../src/settings');

const lists = { apps: DEFAULTS.excludeApps, titles: DEFAULTS.excludeTitles };

test('password managers by process name, case and .exe insensitive', () => {
  assert.equal(isExcluded({ processName: 'KeePassXC.exe', title: 'db' }, lists), true);
  assert.equal(isExcluded({ processName: '1Password.exe', title: '' }, lists), true);
  assert.equal(isExcluded({ processName: 'bitwarden.exe', title: '' }, { apps: ['Bitwarden'], titles: [] }), true);
  assert.equal(isExcluded({ processName: 'chrome.exe', title: 'Some article' }, lists), false);
  assert.equal(isExcluded({ processName: 'keepassxc-cli.exe', title: '' }, lists), false); // exact name only
});

test('titles: case-insensitive substring, CJK too', () => {
  assert.equal(isExcluded({ processName: 'chrome.exe', title: 'Chase Online Banking - Google Chrome' }, lists), true);
  assert.equal(isExcluded({ processName: 'msedge.exe', title: '中国工商银行 网上银行' }, lists), true);
  assert.equal(isExcluded({ processName: 'chrome.exe', title: 'Sign In - GitHub' }, lists), true);
  assert.equal(isExcluded({ processName: 'chrome.exe', title: 'Change your PASSWORD' }, lists), true);
});

test('missing data and empty patterns never exclude', () => {
  assert.equal(isExcluded(null, lists), false);
  assert.equal(isExcluded({ processName: null, title: '' }, lists), false);
  assert.equal(isExcluded({ processName: 'x.exe', title: 'anything' }, { apps: [''], titles: ['', '  '] }), false);
  assert.equal(isExcluded({ processName: 'x.exe', title: 'a' }), false);
});
