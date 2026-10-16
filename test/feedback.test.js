'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { summary, issueUrl } = require('../src/feedback');

test('summary drops path rows and path-bearing errors', () => {
  const rows = [
    { label: 'Tuck', value: '0.1.0 (installed)' },
    { label: 'Notes file', value: 'C:\Users\alice\Documents\Tuck\tuck.md' },
    { label: 'Notes folder writable', value: "no: EPERM: operation not permitted, open C:/Users/alice/x" },
    { label: 'Log file', value: 'C:\Users\alice\AppData\Roaming\Tuck\logs\tuck.log' },
  ];
  const s = summary(rows, 2);
  assert.ok(!/alice/.test(s));
  assert.match(s, /Tuck: 0\.1\.0/);
  assert.match(s, /Notes folder writable: no$/m);
  assert.match(s, /Local crash dumps: 2/);
  assert.match(summary([{ label: 'Notes folder writable', value: 'no: EACCES' }], 0), /no: EACCES/);
  const hook = summary([{ label: 'Key hook', value: 'failed: \\\\?\\C:\\Users\\alice\\AppData\\Local\\Programs\\Tuck\\resources\\uiohook.node is not a valid Win32 application. (also C:/Users/alice/x.node, \\\\server\\share\\bob)' }], 0);
  assert.ok(!/alice|bob/.test(hook), hook);
  assert.match(hook, /^Key hook: failed: <path> is not a valid Win32 application/);
});

test('issueUrl targets the repo and carries the summary', () => {
  const u = new URL(issueUrl('Tuck: 0.1.0'));
  assert.strictEqual(u.origin + u.pathname, 'https://github.com/BayarBH/tuck/issues/new');
  assert.match(u.searchParams.get('body'), /Tuck: 0\.1\.0/);
});
