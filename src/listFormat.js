'use strict';
// Keep lists: browsers drop bullets and numbers from the plain text of a copied list, but the HTML on the
// clipboard still has <ul>/<ol>. When the copy contains list items, rebuild the text with Markdown list
// markers. Only used when its words match the plain text exactly; otherwise the plain text is saved as before.
const MAX_HTML = 2_000_000; // ponytail: whole-page copies above this keep the plain text

const BLOCK = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'table', 'tr', 'hr',
  'section', 'article', 'header', 'footer', 'aside', 'nav', 'main', 'figure', 'figcaption', 'dl', 'dt', 'dd', 'details', 'summary']);
const SKIP = new Set(['script', 'style', 'head', 'title', 'template', 'noscript']);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|[^<]+|</g;

function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(n); } catch { return m; }
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}

// html (a clipboard fragment) -> Markdown text with list markers, or null when there is no list item
function toMarkdown(html) {
  if (typeof html !== 'string' || html.length > MAX_HTML || !/<li[\s>]/i.test(html)) return null;
  const a = html.indexOf('<!--StartFragment-->');
  const b = html.indexOf('<!--EndFragment-->');
  if (a >= 0 && b > a) html = html.slice(a, b);

  const lines = [];
  const lists = [];   // { ordered, n, li: { base, marker, content, started } | null }
  let cur = '';
  let pre = 0;
  let skip = null;
  let blank = false;  // a blank line goes before the next text (between top-level blocks)
  let sawLi = false;

  const li = () => (lists.length ? lists[lists.length - 1].li : null);
  const push = (text) => {
    if (blank && lines.length) lines.push('');
    blank = false;
    const it = li();
    if (!it) { lines.push(text); return; }
    lines.push((it.started ? ' '.repeat(it.content) : ' '.repeat(it.base) + it.marker + ' ') + text);
    it.started = true;
  };
  const flush = () => {
    const t = pre ? cur.replace(/\s+$/, '') : cur.trim();
    if (t) push(t);
    cur = '';
  };
  const endBlock = () => { flush(); if (!lists.length) blank = true; };

  for (const m of html.matchAll(TOKEN)) {
    const [tok, close, rawName] = m;
    if (!rawName) {
      if (skip || tok.startsWith('<!--')) continue;
      const text = decode(tok);
      if (!pre) { cur += text.replace(/\s+/g, ' '); continue; }
      const parts = text.split(/\r?\n/);
      parts.forEach((p, i) => { if (i) flush(); cur += p; });
      continue;
    }
    const name = rawName.toLowerCase();
    if (skip) { if (close && name === skip) skip = null; continue; }
    if (!close && SKIP.has(name)) { skip = name; continue; }

    if (name === 'br') { flush(); continue; }
    if (name === 'td' || name === 'th') { cur += ' '; continue; }
    if (name === 'ul' || name === 'ol') {
      flush();
      if (close) { lists.pop(); if (!lists.length) blank = true; continue; }
      const parent = li();
      if (parent && !parent.started) push(''); // an item that holds only a nested list still gets its marker
      if (!lists.length && lines.length) blank = true;
      const start = /\bstart\s*=\s*["']?(\d+)/i.exec(m[3] || '');
      lists.push({ ordered: name === 'ol', n: start ? +start[1] - 1 : 0, li: null });
      continue;
    }
    if (name === 'li') {
      flush();
      const list = lists[lists.length - 1];
      if (!list) continue;
      if (close) { if (list.li && !list.li.started) push(''); list.li = null; continue; }
      sawLi = true;
      const parent = lists.length > 1 ? lists[lists.length - 2].li : null;
      const base = parent ? parent.content : 0;
      const marker = list.ordered ? `${++list.n}.` : '-';
      list.li = { base, marker, content: base + marker.length + 1, started: false };
      continue;
    }
    if (name === 'pre') { flush(); pre += close ? -1 : 1; if (pre < 0) pre = 0; if (close && !lists.length) blank = true; continue; }
    if (BLOCK.has(name)) { if (close) endBlock(); else flush(); }
  }
  flush();
  if (!sawLi) return null;
  return lines.map((l) => l.replace(/\s+$/, '')).join('\n').replace(/^\n+|\n+$/g, '') || null;
}

// same words in the same order, ignoring whitespace and the list markers we added
const squash = (s) => s.replace(/\s+/g, '');
function sameText(md, plain) {
  return squash(md.replace(/^[ \t]*(?:-|\d+\.)(?: |$)/gm, '')) === squash(plain);
}

// -> Markdown text, or null to keep the plain text; never throws
function read(clipboard, plain) {
  try {
    const md = toMarkdown(clipboard.readHTML());
    return md && md !== plain && sameText(md, plain) ? md : null;
  } catch { return null; }
}

module.exports = { toMarkdown, sameText, read };
