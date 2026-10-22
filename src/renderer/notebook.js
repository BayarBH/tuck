'use strict';
const api = window.notebook;
const $ = (id) => document.getElementById(id);

let all = [];
let review = null;              // { today, pick, onThisDay, week } computed in main (review.js)
let known = null;               // entry keys seen so far (to flash new / edited arrivals)
let filter = { kind: 'all', value: null };
let query = '';
let shown = [];
let editing = null;             // key of the card being edited (reloads wait until it closes)
let pendingLoad = false;
let focusKey = null;            // card to refocus after a re-render
const undos = [];               // undo tokens, newest last (Ctrl+Z)
const selected = new Set();     // keys of selected cards (multi-select delete); always a subset of `shown`
let anchor = null;              // last clicked card, start of a Shift+click range

const APP_NAMES = {
  chrome: 'Chrome', msedge: 'Edge', firefox: 'Firefox', claude: 'Claude', code: 'VS Code',
  windowsterminal: 'Terminal', powershell: 'PowerShell', explorer: 'Explorer', wechat: 'WeChat',
  weixin: 'WeChat', winword: 'Word', notion: 'Notion', obsidian: 'Obsidian', acrobat: 'Acrobat',
};
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'link'; }
}
function appLabel(app) {
  const base = app.replace(/\.exe$/i, '');
  return APP_NAMES[base.toLowerCase()] || (base.charAt(0).toUpperCase() + base.slice(1));
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function btn(cls, text, onClick, title) {
  const b = el('button', cls, text);
  b.type = 'button';
  if (title) b.title = title;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

// ---------- dates ----------
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toDate = (s) => new Date(s + 'T00:00:00');
function shortDate(date, withYear) {
  const d = toDate(date);
  if (isNaN(d)) return date || 'Undated';
  const opts = { month: 'short', day: 'numeric' };
  if (withYear || d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}
function dayLabel(date) {
  const now = new Date();
  if (date === ymd(now)) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (date === ymd(y)) return 'Yesterday';
  const d = toDate(date);
  if (isNaN(d)) return date || 'Undated';
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}
function agoLabel(date) {
  const days = Math.round((toDate(ymd(new Date())) - toDate(date)) / 864e5);
  if (!(days > 0)) return '';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const y = Math.round(days / 365);
  return y === 1 ? 'a year ago' : `${y} years ago`;
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
    const tag = m[0];
    parent.append(btn('tag', tag, () => setFilter('tag', tag)));
    i = m.index + tag.length;
  }
  if (i < text.length) appendHighlighted(parent, text.slice(i));
}

// ---------- filtering ----------
function matches(e) {
  if (filter.kind === 'tag' && !e.tags.includes(filter.value)) return false;
  if (filter.kind === 'app' && e.app !== filter.value) return false;
  if (filter.kind === 'week' && review && !(e.date >= review.week.start && e.date <= review.week.end)) return false;
  if (query) {
    const q = query.toLowerCase();
    if (![e.quote, e.thought, e.app, e.source || ''].some((s) => s.toLowerCase().includes(q))) return false;
  }
  return true;
}
function setFilter(kind, value) {
  filter = filter.kind === kind && filter.value === value && kind !== 'all' ? { kind: 'all', value: null } : { kind, value };
  render();
  $('main').scrollTop = 0;
}
function viewTitle() {
  if (filter.kind === 'tag') return filter.value;
  if (filter.kind === 'app') return appLabel(filter.value);
  if (filter.kind === 'week') return 'This week';
  return 'All notes';
}

// ---------- sidebar ----------
function countBy(list, pick) {
  const m = new Map();
  for (const e of list) for (const k of pick(e)) m.set(k, (m.get(k) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
function filterButton(label, n, on, onClick, title) {
  const b = btn('filter' + (on ? ' on' : ''), null, onClick, title);
  b.append(el('span', 'name', label), el('span', 'n', String(n)));
  return b;
}
function renderSide() {
  $('count').textContent = all.length === 1 ? '1 note' : `${all.length} notes`;
  $('all').classList.toggle('on', filter.kind === 'all');
  $('all').querySelector('.n').textContent = String(all.length);
  $('week').classList.toggle('on', filter.kind === 'week');
  $('week').querySelector('.n').textContent = review ? String(review.week.count) : '';

  const tags = countBy(all, (e) => e.tags);
  $('tags').replaceChildren(...(tags.length
    ? tags.map(([t, n]) => filterButton(t, n, filter.kind === 'tag' && filter.value === t, () => setFilter('tag', t)))
    : [el('p', 'none', 'Add #tags in your thoughts')]));

  const apps = countBy(all, (e) => (e.app ? [e.app] : []));
  $('appsHead').hidden = !apps.length;
  $('apps').replaceChildren(...apps.map(([a, n]) =>
    filterButton(appLabel(a), n, filter.kind === 'app' && filter.value === a, () => setFilter('app', a), a)));
}

// ---------- cards ----------
function card(e, fresh) {
  const c = el('article', 'card' + (fresh ? ' fresh' : '') + (selected.has(e.key) ? ' selected' : ''));
  c.dataset.key = e.key;
  c.setAttribute('aria-selected', String(selected.has(e.key)));
  c.tabIndex = 0;

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
  meta.append(el('span', 'snap-date', shortDate(e.date, true) + ','), el('time', '', e.time));
  if (e.app) {
    meta.append(el('span', '', '·'));
    meta.append(btn('app-link', appLabel(e.app), () => setFilter('app', e.app), 'Show notes from ' + e.app));
  }
  if (e.source) {
    meta.append(el('span', '', '·'));
    meta.append(btn('app-link source-link', hostOf(e.source), () => api.openLink(e.source), 'Open ' + e.source));
  }
  meta.append(el('span', 'snap-brand', 'Tuck'));
  const acts = el('div', 'actions');
  const copy = btn('pill', 'Copy', () => {
    api.copy(e.quote);
    copy.textContent = 'Copied';
    copy.classList.add('done');
    setTimeout(() => { copy.textContent = 'Copy'; copy.classList.remove('done'); }, 1200);
  }, 'Copy the quote');
  const more = btn('pill icon', '⋯', (ev) => openCardMenu(e, more, ev), 'More');
  more.setAttribute('aria-haspopup', 'menu');
  acts.append(btn('pill', 'Edit', () => startEdit(e), 'Edit (E)'), copy, more);
  meta.append(acts);
  c.append(meta);
  return c;
}

// add "Show more" only where the clamp actually cuts text (needs layout, so after insertion)
function addMoreLinks() {
  for (const q of document.querySelectorAll('.quote.clamp')) {
    if (q.scrollHeight <= q.clientHeight + 2 || q.nextElementSibling?.classList.contains('more')) continue;
    const b = btn('more', 'Show more', () => {
      const open = q.classList.toggle('clamp');
      b.textContent = open ? 'Show more' : 'Show less';
    });
    q.after(b);
  }
}

const cardEl = (key) => document.querySelector(`.card[data-key="${CSS.escape(key)}"]`);
function jumpTo(key) {
  const c = cardEl(key);
  if (!c) return;
  c.scrollIntoView({ block: 'center', behavior: 'smooth' });
  c.classList.remove('fresh');
  void c.offsetWidth;
  c.classList.add('fresh');
  c.focus({ preventScroll: true });
}

// ---------- review: Today panel and This week summary ----------
function todayPanel() {
  const { pick, onThisDay } = review;
  const box = el('section', 'today');
  const head = el('div', 'today-head');
  head.append(el('span', 'label', "Today's pick"), el('span', 'from', `${shortDate(pick.date)} · ${agoLabel(pick.date)}`));
  box.append(head);
  const q = el('blockquote', 'quote clamp short');
  q.textContent = pick.quote;
  box.append(q);
  if (pick.thought) { const t = el('p', 'today-thought'); appendThought(t, pick.thought); box.append(t); }
  const foot = el('div', 'today-foot');
  if (pick.app) foot.append(el('span', '', appLabel(pick.app)));
  foot.append(btn('link', 'Show in notes', () => jumpTo(pick.key)));
  box.append(foot);

  if (onThisDay.length) {
    box.append(el('div', 'label otd-label', 'On this day'));
    for (const e of onThisDay) {
      const row = btn('otd', null, () => jumpTo(e.key), shortDate(e.date, true));
      row.append(el('span', 'ago', e.ago), el('span', 'snip', e.quote.replace(/\s+/g, ' ')));
      box.append(row);
    }
  }
  return box;
}

function weekPanel() {
  const w = review.week;
  const box = el('section', 'week');
  const stats = el('div', 'stats');
  const stat = (n, label) => { const s = el('div', 'stat'); s.append(el('b', '', String(n)), el('span', '', label)); return s; };
  stats.append(stat(w.count, w.count === 1 ? 'note' : 'notes'), stat(w.withThought, 'with thoughts'), stat(`${w.activeDays}/7`, 'active days'));
  box.append(stats);

  const max = Math.max(1, ...w.days.map((d) => d.n));
  const bars = el('div', 'bars');
  const today = ymd(new Date());
  for (const d of w.days) {
    const col = el('div', 'bar' + (d.date === today ? ' now' : '') + (d.date > today ? ' later' : ''));
    col.title = `${dayLabel(d.date)}: ${d.n}`;
    const fill = el('i');
    fill.style.height = `${Math.round((d.n / max) * 100)}%`;
    col.append(el('span', 'bn', d.n ? String(d.n) : ''), el('div', 'track'), el('span', 'bd', toDate(d.date).toLocaleDateString('en-US', { weekday: 'narrow' })));
    col.querySelector('.track').append(fill);
    bars.append(col);
  }
  box.append(bars);

  const group = (label, items, mk) => {
    if (!items.length) return;
    const g = el('div', 'chips');
    g.append(el('span', 'label', label));
    for (const it of items) g.append(mk(it));
    box.append(g);
  };
  group('Top tags', w.tags, ([t, n]) => { const b = btn('chip', t, () => setFilter('tag', t)); b.append(el('em', '', String(n))); return b; });
  group('Top sources', w.apps, ([a, n]) => { const b = btn('chip', appLabel(a), () => setFilter('app', a), a); b.append(el('em', '', String(n))); return b; });
  return box;
}

// ---------- render ----------
function render() {
  const keep = focusKey || document.activeElement?.closest?.('.card')?.dataset.key;
  renderSide();
  shown = all.filter(matches);
  // never delete what is not on screen: a filter or a reload drops hidden keys from the selection
  const visible = new Set(shown.map((e) => e.key));
  for (const k of selected) if (!visible.has(k)) selected.delete(k);
  renderSelection();

  $('title').textContent = viewTitle();
  const filtered = query || filter.kind !== 'all';
  $('sub').textContent = filter.kind === 'week' && review && !query
    ? `${shortDate(review.week.start)} – ${shortDate(review.week.end)}`
    : filtered ? `${shown.length} of ${all.length}${query ? ` matching “${query}”` : ''}`
      : (all.length ? `${all.length} tucked away` : '');
  $('clear').hidden = !filtered;
  $('exportBtn').disabled = !shown.length;
  if (!shown.length) { $('exportMenu').hidden = true; $('exportBtn').setAttribute('aria-expanded', 'false'); }

  const frag = document.createDocumentFragment();
  if (review && !query && filter.kind === 'all' && review.pick) frag.append(todayPanel());
  if (review && filter.kind === 'week' && all.length) frag.append(weekPanel());
  let day = null;
  for (const e of shown) {
    if (e.date !== day) { day = e.date; frag.append(el('div', 'day', dayLabel(day))); }
    frag.append(card(e, known && !known.has(e.key)));
  }
  $('list').replaceChildren(frag);
  addMoreLinks();

  const empty = !shown.length;
  $('empty').hidden = !empty;
  if (empty) {
    $('emptyTitle').textContent = !all.length ? 'Nothing tucked away yet'
      : filter.kind === 'week' && !query ? 'Nothing tucked away this week' : 'No notes match';
    $('emptyHint').textContent = !all.length
      ? `Select text anywhere, then double-tap ${PLATFORM.combo('C')}. Hold ${PLATFORM.combo('C')} to add a thought.`
      : filter.kind === 'week' && !query ? `Double-tap ${PLATFORM.combo('C')} on something worth keeping.` : 'Try another word, or clear the filter.';
  }
  focusKey = null;
  const c = keep && cardEl(keep);
  if (c) c.focus({ preventScroll: true });
}

async function load() {
  if (editing) { pendingLoad = true; return; }
  const r = await api.get();
  if (!r) return;
  if (editing) { pendingLoad = true; return; }
  all = r.entries;
  review = r.review || null;
  $('openObsidian').hidden = !r.vault;
  $('openObsidian').title = r.vault ? 'Vault: ' + r.vault : '';
  render();
  known = new Set(all.map((e) => e.key));
  if (r.error) toast('Could not read the notes file: ' + r.error);
}

// ---------- toast + undo ----------
let toastTimer = null;
function toast(msg, token) {
  $('toastMsg').textContent = msg;
  $('toastUndo').hidden = !token;
  $('toastUndo').onclick = token ? () => undo(token) : null;
  $('toast').hidden = false;
  $('toast').classList.remove('out');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, token ? 8000 : 4000);
}
function hideToast() {
  $('toast').classList.add('out');
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 200);
}
function problem(r) {
  if (r && r.error === 'changed') { toast('That note changed in the file meanwhile. Reloaded, please try again.'); load(); }
  else if (r && r.error === 'invalid') toast('A note needs some quoted text.');
  else if (r && r.error === 'expired') toast('Nothing to undo.');
  else if (r && r.error === 'unparsable') toast('This note has hand-edited lines Tuck cannot read. Edit it in the notes file instead.');
  else toast('Could not save: ' + ((r && r.message) || 'unknown error'));
}
async function undo(token) {
  const i = undos.indexOf(token);
  if (i >= 0) undos.splice(i, 1);
  const r = await api.undo(token);
  if (r && r.ok) { toast('Undone.'); load(); } else problem(r);
}

// ---------- edit / delete ----------
function grow(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; }
function startEdit(e) {
  if (editing) { const c = cardEl(editing); if (c) c.querySelector('textarea')?.focus(); return; }
  const c = cardEl(e.key);
  if (!c) return;
  editing = e.key;
  closeMenus();
  c.classList.add('editing');
  const q = el('textarea', 'edit-quote');
  q.value = e.quote;
  q.setAttribute('aria-label', 'Quote');
  const t = el('textarea', 'edit-thought');
  t.value = e.thought;
  t.placeholder = 'Add a thought… (#tags ok)';
  t.setAttribute('aria-label', 'My thought');
  const tl = el('div', 'thought');
  tl.append(el('span', 'label', 'My thought'), t);
  const foot = el('footer', 'meta');
  foot.append(el('span', 'hint', `${PLATFORM.combo('Enter')} save · Esc cancel`));
  const acts = el('div', 'actions show');
  const save = btn('pill primary', 'Save', () => commitEdit(e, q.value, t.value));
  acts.append(btn('pill', 'Cancel', () => endEdit(e.key)), save);
  foot.append(acts);
  c.replaceChildren(q, tl, foot);
  for (const x of [q, t]) {
    x.rows = 1;
    x.spellcheck = false;
    x.addEventListener('input', () => grow(x));
    x.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && PLATFORM.mod(ev)) { ev.preventDefault(); save.click(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); endEdit(e.key); }
    });
  }
  requestAnimationFrame(() => { grow(q); grow(t); t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
}
function endEdit(key) {
  editing = null;
  focusKey = key;
  if (pendingLoad) { pendingLoad = false; load(); } else render();
}
async function commitEdit(e, quote, thought) {
  quote = quote.replace(/\s+$/, '');
  thought = thought.trim();
  if (quote === e.quote && thought === e.thought) { endEdit(e.key); return; }
  if (!quote.trim()) { toast('A note needs some quoted text.'); return; }
  const r = await api.update(e.key, { quote, thought });
  editing = null;
  pendingLoad = false;
  if (!r || !r.ok) { problem(r); if (!r || r.error !== 'changed') render(); return; }
  undos.push(r.undo);
  focusKey = r.key;
  toast('Note updated.', r.undo);
  load();
}
async function removeEntry(e) {
  closeMenus();
  const c = cardEl(e.key);
  const next = c && [...document.querySelectorAll('.card')].find((x, i, arr) => arr[i - 1] === c);
  const r = await api.remove(e.key);
  if (!r || !r.ok) { problem(r); return; }
  undos.push(r.undo);
  focusKey = next ? next.dataset.key : null;
  toast('Note deleted.', r.undo);
  load();
}

// ---------- multi-select ----------
// Ctrl/⌘+click toggles, Shift+click adds a range, Ctrl/⌘+A selects all shown; while anything is
// selected a plain click toggles too. Delete removes the selection in one step (one undo).
function renderSelection() {
  const n = selected.size;
  document.body.classList.toggle('selecting', n > 0);
  $('selBar').hidden = !n;
  $('selCount').textContent = n === 1 ? '1 selected' : `${n} selected`;
  $('selAll').hidden = n >= shown.length;
  for (const c of document.querySelectorAll('.card')) {
    const on = selected.has(c.dataset.key);
    c.classList.toggle('selected', on);
    c.setAttribute('aria-selected', String(on));
  }
}
function toggle(key) {
  if (!selected.delete(key)) selected.add(key);
  anchor = key;
  renderSelection();
}
function selectRange(key) {
  const keys = shown.map((e) => e.key);
  const a = keys.indexOf(anchor), b = keys.indexOf(key);
  if (a < 0) { toggle(key); return; }
  for (const k of keys.slice(Math.min(a, b), Math.max(a, b) + 1)) selected.add(k);
  renderSelection();
}
function selectAll() { for (const e of shown) selected.add(e.key); renderSelection(); }
function clearSelection() { selected.clear(); anchor = null; renderSelection(); }

async function removeSelected() {
  const keys = shown.map((e) => e.key).filter((k) => selected.has(k));
  if (!keys.length) return;
  closeMenus();
  const cards = [...document.querySelectorAll('.card')];
  const next = cards.slice(cards.findIndex((c) => c.dataset.key === keys[keys.length - 1]) + 1).find((c) => !selected.has(c.dataset.key));
  const r = await api.remove(keys);
  if (!r || !r.ok) { problem(r); return; }
  clearSelection();
  undos.push(r.undo);
  focusKey = next ? next.dataset.key : null;
  toast(keys.length === 1 ? 'Note deleted.' : `${keys.length} notes deleted.`, r.undo);
  load();
}

const skipClick = (t) => t.closest('button, a, textarea, input, .menu');
$('list').addEventListener('mousedown', (ev) => {
  // Shift+click extends the selection, not a text selection
  if (ev.shiftKey && ev.target.closest('.card') && !skipClick(ev.target)) ev.preventDefault();
});
$('list').addEventListener('click', (ev) => {
  const c = ev.target.closest('.card');
  if (!c || editing || skipClick(ev.target)) return;
  if (ev.shiftKey && (selected.size || anchor)) selectRange(c.dataset.key);
  else if (PLATFORM.mod(ev) || (selected.size && !String(getSelection()))) toggle(c.dataset.key);
});
$('selAll').addEventListener('click', selectAll);
$('selDelete').addEventListener('click', removeSelected);
$('selCancel').addEventListener('click', clearSelection);

// ---------- card image ----------
const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
async function snapCard(e, action) {
  closeMenus();
  const c = cardEl(e.key);
  if (!c) return;
  document.body.classList.add('capturing');
  c.classList.add('snap');
  c.querySelector('.quote')?.classList.remove('clamp');
  // ponytail: captures what fits in the window; a card taller than the viewport is cut off (offscreen render if it matters)
  c.scrollIntoView({ block: 'center', behavior: 'instant' });
  await frame();
  const r = c.getBoundingClientRect(), pad = 18;
  const x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad);
  const rect = { x, y, width: Math.min(innerWidth, r.right + pad) - x, height: Math.min(innerHeight, r.bottom + pad) - y };
  let res;
  try { res = await api.capture(rect, action); } finally {
    document.body.classList.remove('capturing');
    c.classList.remove('snap');
    render();
  }
  if (res && res.ok) toast(action === 'copy' ? 'Image copied to the clipboard.' : 'Image saved.');
  else if (!res || !res.canceled) toast('Could not capture the image.');
}

// ---------- menus ----------
let menuEntry = null;
function closeMenus() {
  $('cardMenu').hidden = true;
  $('exportMenu').hidden = true;
  $('exportBtn').setAttribute('aria-expanded', 'false');
  document.querySelector('.card.menu-open')?.classList.remove('menu-open');
  menuEntry = null;
}
function openCardMenu(e, anchor, ev) {
  ev.stopPropagation();
  const m = $('cardMenu');
  if (!m.hidden && menuEntry === e) { closeMenus(); return; }
  closeMenus();
  menuEntry = e;
  anchor.closest('.card')?.classList.add('menu-open');
  m.hidden = false;
  const a = anchor.getBoundingClientRect();
  const top = a.bottom + 6 + m.offsetHeight > innerHeight ? a.top - 6 - m.offsetHeight : a.bottom + 6;
  m.style.top = `${Math.max(8, top)}px`;
  m.style.left = `${Math.max(8, a.right - m.offsetWidth)}px`;
  m.querySelector('button').focus({ preventScroll: true });
}
$('cardMenu').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  const e = menuEntry;
  if (!b || !e) return;
  if (b.dataset.act === 'delete') removeEntry(e);
  else if (b.dataset.act === 'select') { closeMenus(); toggle(e.key); }
  else snapCard(e, b.dataset.act === 'copy-image' ? 'copy' : 'save');
});
$('exportBtn').addEventListener('click', (ev) => {
  ev.stopPropagation();
  const open = $('exportMenu').hidden;
  closeMenus();
  $('exportMenu').hidden = !open;
  $('exportBtn').setAttribute('aria-expanded', String(open));
});
$('exportMenu').addEventListener('click', async (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  closeMenus();
  const title = viewTitle() + (query ? ` “${query}”` : '');
  const r = b.dataset.export === 'md'
    ? await api.exportMarkdown(title, shown.map((e) => e.key))
    : await api.exportPdf(title);
  if (r && r.ok) toast(`Exported to ${r.file.split(/[\\/]/).pop()}`);
  else if (!r || !r.canceled) toast('Export failed: ' + ((r && r.message) || 'unknown error'));
});
document.addEventListener('click', (ev) => { if (!ev.target.closest('.menu')) closeMenus(); });
$('main').addEventListener('scroll', () => { if (!$('cardMenu').hidden) closeMenus(); });

// ---------- wiring ----------
let typing = null;
$('q').addEventListener('input', () => {
  clearTimeout(typing);
  typing = setTimeout(() => { query = $('q').value.trim(); render(); }, 80);
});
$('all').addEventListener('click', () => setFilter('all', null));
$('week').addEventListener('click', () => setFilter('week', null));
$('clear').addEventListener('click', () => {
  filter = { kind: 'all', value: null };
  query = ''; $('q').value = '';
  render();
});
$('openObsidian').addEventListener('click', () => api.openObsidian());

// Macs have no Delete key on laptops: ⌘⌫ deletes, like in Finder
const isDel = (e) => e.key === 'Delete' || (PLATFORM.isMac && e.metaKey && e.key === 'Backspace');
const entryOf = (c) => c && all.find((x) => x.key === c.dataset.key);
function targetCard() {
  return document.activeElement?.closest?.('.card') || document.querySelector('.card:hover');
}
document.addEventListener('keydown', (e) => {
  const inField = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName);
  const k = e.key.toLowerCase();
  if ((PLATFORM.mod(e) && k === 'f') || (e.key === '/' && !inField)) {
    e.preventDefault();
    $('q').focus();
    $('q').select();
  } else if (e.key === 'Escape') {
    if (!$('cardMenu').hidden || !$('exportMenu').hidden) { closeMenus(); return; }
    if (selected.size && !inField) { clearSelection(); return; }
    if ($('q').value) { $('q').value = ''; query = ''; render(); }
    else if (filter.kind !== 'all') setFilter('all', null);
    $('q').blur();
  } else if (inField || editing) {
    // typing: leave the keys alone
  } else if (e.repeat && (isDel(e) || (PLATFORM.mod(e) && k === 'z'))) {
    e.preventDefault(); // held key: one delete / one undo per press
  } else if (PLATFORM.mod(e) && k === 'z') {
    e.preventDefault();
    if (undos.length) undo(undos[undos.length - 1]); else toast('Nothing to undo.');
  } else if (PLATFORM.mod(e) && k === 'a') {
    e.preventDefault();
    selectAll();
  } else if (e.key === ' ' && document.activeElement?.classList.contains('card')) {
    e.preventDefault();
    toggle(document.activeElement.dataset.key);
  } else if (k === 'e' && !PLATFORM.mod(e) && !e.altKey) {
    const en = entryOf(targetCard());
    if (en) { e.preventDefault(); startEdit(en); }
  } else if (isDel(e)) {
    if (selected.size) { e.preventDefault(); removeSelected(); return; }
    const en = entryOf(targetCard());
    if (en) { e.preventDefault(); removeEntry(en); }
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || k === 'j' || k === 'k') {
    const cards = [...document.querySelectorAll('.card')];
    if (!cards.length) return;
    e.preventDefault();
    const i = cards.indexOf(document.activeElement);
    const down = e.key === 'ArrowDown' || k === 'j';
    const n = cards[i < 0 ? 0 : Math.min(cards.length - 1, Math.max(0, i + (down ? 1 : -1)))];
    n.focus({ preventScroll: true });
    n.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
});
window.addEventListener('resize', () => addMoreLinks());
// the Today panel depends on the date: refresh when coming back on another day
window.addEventListener('focus', () => { if (review && review.today !== ymd(new Date())) load(); });

api.onChange(load);
load();
