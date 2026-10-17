'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { toMarkdown, read } = require('../src/listFormat');
const { formatEntry } = require('../src/notesWriter');
const { parseNotes } = require('../src/notesReader');

// what Chromium put on the clipboard for a copied list (Electron probe; styles shortened)
const S = ' style="color: rgb(0, 0, 0); font-family: &quot;Noto Sans SC&quot;;"';
const HTML = `<p${S}>Here are three ideas:</p><ol${S}><li>First<span> </span><b>bold</b><span> </span>point</li>`
  + `<li>Second<ul><li>nested a</li><li>nested b</li></ul></li></ol><p${S}>Done.</p><ul${S}><li>x &amp; y</li></ul>`;
const PLAIN = 'Here are three ideas:\r\n\r\nFirst bold point\r\nSecond\r\nnested a\r\nnested b\r\nDone.\r\n\r\nx & y';
const MD = 'Here are three ideas:\n\n1. First bold point\n2. Second\n   - nested a\n   - nested b\n\nDone.\n\n- x & y';
const cb = (html) => ({ readHTML: () => html });

test('keep lists: markers back from the HTML, only when the words match the plain text', () => {
  assert.equal(toMarkdown(HTML), MD);
  assert.equal(toMarkdown('Version:0.9\r\n<html><body><!--StartFragment-->' + HTML + '<!--EndFragment--></body></html>'), MD);
  assert.equal(read(cb(HTML), PLAIN), MD);
  assert.equal(toMarkdown('<ol start="9"><li>a</li><li>b<br>more</li></ol>'), '9. a\n10. b\n    more');
  assert.equal(toMarkdown('<ul><li><ul><li>deep</li></ul></li><li></li></ul>'), '-\n  - deep\n-');
  assert.equal(toMarkdown('<ul><li>a &lt;b&gt; &#x4e2d;&#25991;</li></ul><script>x()</script>'), '- a <b> 中文');
  assert.equal(toMarkdown('<p>no list here</p>'), null);
  assert.equal(read(cb('<p>no list</p>'), 'no list'), null);
  assert.equal(read(cb(HTML), 'something else'), null);                 // words differ: keep the plain text
  assert.equal(read(cb('<ul><li>a</li></ul>'), '* a'), null);          // plain text already has its own bullets
  assert.equal(read({ readHTML: () => { throw new Error('x'); } }, PLAIN), null);
});

test('keep lists: a list survives the notes file round trip', () => {
  const [e] = parseNotes(formatEntry({ text: MD, thought: '', appName: 'chrome.exe', date: new Date(2026, 9, 17, 21, 0) }));
  assert.equal(e.quote, MD);
});
