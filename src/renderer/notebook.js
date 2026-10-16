'use strict';
const api = window.notebook;
const $ = (id) => document.getElementById(id);

let all = [];
let known = null;               // entry keys seen so far (to flash new arrivals)
let filter = { kind: 'all', value: null };
let query = '';

const APP_NAMES = {
  chrome: 'Chrome', msedge: 'Edge', firefox: 'Firefox', claude: 'Claude', code: 'VS Code',
  windowsterminal: 'Terminal', powershell: 'PowerShell', explorer: 'Explorer', wechat: 'WeChat',
  weixin: 'WeChat', winword: 'Word', notion: 'Notion', obsidian: 'Obsidian', acrobat: 'Acrobat',
};
function appLabel(app) {
  const base = app.replace(/\.exe$/i, '');
  return APP_NAMES[base.toLowerCase()] || (base.charAt(0).toUpperCase() + base.slice(1));
}
const keyOf = (e) => `${e.date} ${e.time}|${e.quote}`;

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

// ---------- dates ----------
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function dayLabel(date) {
  const now = new Date();
  if (date === ymd(now)) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (date === ymd(y)) return 'Yesterday';
  const d = new Date(date + 'T00:00:00');
  if (isNaN(d)) return date || 'Undated';
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

// ---------- text with highlights and clickable tags ----------
function appendHighlighted(parent, text) {
  if (!query) { parent.append(text); return; }
  const lower = text.toLowerCase(), q = query.toLowerCase();
  let i = 0;
  for (let j = lower.indexOf(q); j !== -1; j = lower.indexOf(q, i)) {
    if (j > i) parent.append(text.slice(i, j));
    parent.append(el('mark', '', text.slice(j, j + q.length)));
    i = j + q.length;
  }
  if (i < text.length) parent.append(text.slice(i));
}
function appendThought(parent, text) {
  const re = /#[\p{L}\p{N}_]+/gu;
  let i = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > i) appendHighlighted(parent, text.slice(i, m.index));
    const b = el('button', 'tag', m[0]);
    b.type = 'button';
    b.addEventListener('click', () => setFilter('tag', m[0]));
    parent.append(b);
    i = m.index + m[0].length;
  }
  if (i < text.length) appendHighlighted(parent, text.slice(i));
}

// ---------- filtering ----------
function matches(e) {
  if (filter.kind === 'tag' && !e.tags.includes(filter.value)) return false;
  if (filter.kind === 'app' && e.app !== filter.value) return false;
  if (query) {
    const q = query.toLowerCase();
    if (![e.quote, e.thought, e.app].some((s) => s.toLowerCase().includes(q))) return false;
  }
  return true;
}
function setFilter(kind, value) {
  filter = filter.kind === kind && filter.value === value ? { kind: 'all', value: null } : { kind, value };
  render();
  $('main').scrollTop = 0;
}

// ---------- sidebar ----------
function countBy(list, pick) {
  const m = new Map();
  for (const e of list) for (const k of pick(e)) m.set(k, (m.get(k) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
function filterButton(label, n, on, onClick, title) {
  const b = el('button', 'filter' + (on ? ' on' : ''));
  b.type = 'button';
  if (title) b.title = title;
  b.append(el('span', 'name', label), el('span', 'n', String(n)));
  b.addEventListener('click', onClick);
  return b;
}
function renderSide() {
  $('count').textContent = all.length === 1 ? '1 note' : `${all.length} notes`;
  const allBtn = $('all');
  allBtn.classList.toggle('on', filter.kind === 'all');
  allBtn.querySelector('.n').textContent = String(all.length);

  const tags = countBy(all, (e) => e.tags);
  $('tags').replaceChildren(...(tags.length
    ? tags.map(([t, n]) => filterButton(t, n, filter.kind === 'tag' && filter.value === t, () => setFilter('tag', t)))
    : [el('p', 'none', 'Add #tags in your thoughts')]));

  const apps = countBy(all, (e) => (e.app ? [e.app] : []));
  $('appsHead').hidden = !apps.length;
  $('apps').replaceChildren(...apps.map(([a, n]) =>
    filterButton(appLabel(a), n, filter.kind === 'app' && filter.value === a, () => setFilter('app', a), a)));
}

// ---------- list ----------
function card(e, fresh) {
  const c = el('article', 'card' + (fresh ? ' fresh' : ''));

  const q = el('blockquote', 'quote clamp');
  appendHighlighted(q, e.quote);
  c.append(q);

  if (e.thought) {
    const t = el('div', 'thought');
    t.append(el('span', 'label', 'My thought'));
    const p = el('p');
    appendThought(p, e.thought);
    t.append(p);
    c.append(t);
  }

  const meta = el('footer', 'meta');
  meta.append(el('time', '', e.time));
  if (e.app) {
    meta.append(el('span', '', '·'));
    const a = el('button', 'app-link', appLabel(e.app));
    a.type = 'button';
    a.title = 'Show notes from ' + e.app;
    a.addEventListener('click', () => setFilter('app', e.app));
    meta.append(a);
  }
  const copy = el('button', 'copy', 'Copy');
  copy.type = 'button';
  copy.addEventListener('click', () => {
    api.copy(e.quote);
    copy.textContent = 'Copied';
    copy.classList.add('done');
    setTimeout(() => { copy.textContent = 'Copy'; copy.classList.remove('done'); }, 1200);
  });
  meta.append(copy);
  c.append(meta);
  return c;
}

// add "Show more" only where the clamp actually cuts text (needs layout, so after insertion)
function addMoreLinks() {
  for (const q of document.querySelectorAll('.quote.clamp')) {
    if (q.scrollHeight <= q.clientHeight + 2 || q.nextElementSibling?.classList.contains('more')) continue;
    const b = el('button', 'more', 'Show more');
    b.type = 'button';
    b.addEventListener('click', () => {
      const open = q.classList.toggle('clamp');
      b.textContent = open ? 'Show more' : 'Show less';
    });
    q.after(b);
  }
}

function render() {
  renderSide();
  const shown = all.filter(matches);

  const title = filter.kind === 'tag' ? filter.value : filter.kind === 'app' ? appLabel(filter.value) : 'All notes';
  $('title').textContent = title;
  $('sub').textContent = query || filter.kind !== 'all'
    ? `${shown.length} of ${all.length}${query ? ` matching “${query}”` : ''}`
    : (all.length ? `${all.length} tucked away` : '');
  $('clear').hidden = filter.kind === 'all' && !query;

  const frag = document.createDocumentFragment();
  let day = null;
  for (const e of shown) {
    if (e.date !== day) { day = e.date; frag.append(el('div', 'day', dayLabel(day))); }
    frag.append(card(e, known && !known.has(keyOf(e))));
  }
  $('list').replaceChildren(frag);
  addMoreLinks();

  const empty = !shown.length;
  $('empty').hidden = !empty;
  if (empty) {
    $('emptyTitle').textContent = all.length ? 'No notes match' : 'Nothing tucked away yet';
    $('emptyHint').textContent = all.length
      ? 'Try another word, or clear the filter.'
      : 'Select text anywhere, then double-tap Ctrl+C. Hold Ctrl+C to add a thought.';
  }
}

async function load() {
  const r = await api.get();
  if (!r) return;
  all = r.entries;
  $('openFile').title = r.file;
  render();
  known = new Set(all.map(keyOf));
}

// ---------- wiring ----------
let typing = null;
$('q').addEventListener('input', () => {
  clearTimeout(typing);
  typing = setTimeout(() => { query = $('q').value.trim(); render(); }, 80);
});
$('all').addEventListener('click', () => setFilter('all', null));
$('clear').addEventListener('click', () => {
  filter = { kind: 'all', value: null };
  query = ''; $('q').value = '';
  render();
});
$('openFile').addEventListener('click', () => api.openFile());
$('openFolder').addEventListener('click', () => api.openFolder());

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey && e.key.toLowerCase() === 'f') || (e.key === '/' && document.activeElement !== $('q'))) {
    e.preventDefault();
    $('q').focus();
    $('q').select();
  } else if (e.key === 'Escape') {
    if ($('q').value) { $('q').value = ''; query = ''; render(); }
    else if (filter.kind !== 'all') setFilter('all', null);
    $('q').blur();
  }
});
window.addEventListener('resize', () => addMoreLinks());

api.onChange(load);
load();
