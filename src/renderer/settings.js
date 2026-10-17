'use strict';
const api = window.tuckSettings;
const $ = (id) => document.getElementById(id);
let s = null;          // current settings
let defaults = null;
let diagText = '';

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

async function save(patch) {
  const r = await api.set(patch);
  if (!r || !r.ok) { toast('Could not save: ' + ((r && r.error) || 'unknown error')); render(); return; }
  s = r.settings;
  render();
}

// ---------- sections ----------
const SECTIONS = ['capture', 'storage', 'privacy', 'diagnostics'];
function show(sec) {
  if (!SECTIONS.includes(sec)) sec = 'capture';
  for (const id of SECTIONS) $(id).hidden = id !== sec;
  document.querySelectorAll('[data-sec]').forEach((b) => b.classList.toggle('on', b.dataset.sec === sec));
  try { localStorage.setItem('section', sec); } catch {}
  $('main').scrollTop = 0;
  if (sec === 'diagnostics') loadDiag();
}
document.querySelectorAll('[data-sec]').forEach((b) => b.addEventListener('click', () => show(b.dataset.sec)));
let wanted = null; // section asked for by main (tray / TUCK_OPEN) before settings loaded
api.onSection((sec) => { wanted = sec; if (s) show(sec); });

// ---------- capture ----------
const FMT = {
  longPressMs: (v) => `${v} ms`,
  doubleGapMs: (v) => `${v} ms`,
  dedupeMs: (v) => (v === 0 ? 'Off' : `${(v / 1000).toFixed(1)} s`),
  animSpeed: (v) => `${Math.round(v * 100)}%`,
};
const timers = {};
for (const key of Object.keys(FMT)) {
  const input = $(key);
  const out = document.querySelector(`output[for=${key}]`);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = FMT[key](v);
    if (key === 'animSpeed') markSpeed(v);
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => save({ [key]: v }), 200); // live, but not one disk write per pixel
  });
}
function markSpeed(v) {
  document.querySelectorAll('#speedSeg button').forEach((b) => b.classList.toggle('on', Math.abs(Number(b.dataset.v) - v) < 0.01));
}
document.querySelectorAll('#speedSeg button').forEach((b) => b.addEventListener('click', () => save({ animSpeed: Number(b.dataset.v) })));

// ---------- storage ----------
$('changeFolder').addEventListener('click', async () => {
  const r = await api.pickFolder();
  if (r && r.ok) { s = r.settings; render(); toast('Notes folder changed'); }
});
$('openNotesFolder').addEventListener('click', () => api.openFolder('notes'));
async function loadVaults() {
  const r = await api.vaults();
  if (!r) return;
  $('vaultNow').hidden = !r.current;
  $('vaultNow').textContent = r.current ? `Your notes are in the Obsidian vault "${r.current}".` : '';
  $('vaultOpen').hidden = !r.current;
  const others = r.vaults.filter((v) => v.name !== r.current);
  $('vaultPick').hidden = !others.length;
  $('noVault').hidden = r.vaults.length > 0;
  $('vaultList').replaceChildren(...others.map((v) => { const o = new Option(v.name, v.path); o.title = v.path; return o; }));
}
$('useVault').addEventListener('click', async () => {
  const r = await api.useVault($('vaultList').value);
  if (r && r.ok) { s = r.settings; render(); toast('New notes now go to your Obsidian vault'); }
});
$('openObsidian').addEventListener('click', () => api.openObsidian());
$('openBackups').addEventListener('click', () => api.openFolder('backups'));

// ---------- privacy ----------
function chips(key) {
  const box = $(key);
  const list = s[key];
  box.replaceChildren(...(list.length ? list.map((v) => {
    const c = el('span', 'chip', v);
    const x = el('button', '', '×');
    x.type = 'button';
    x.title = 'Remove ' + v;
    x.setAttribute('aria-label', 'Remove ' + v);
    x.addEventListener('click', () => save({ [key]: s[key].filter((y) => y !== v) }));
    c.append(x);
    return c;
  }) : [el('p', 'none', 'Nothing here. Every app is captured.')]));
}
function addTo(key, raw) {
  let v = raw.trim();
  if (!v) return;
  if (key === 'excludeApps' && PLATFORM.isMac) {
    v = v.replace(/^.*\//, '').replace(/\.app$/i, ''); // macOS: the plain app name, e.g. "1Password"
  } else if (key === 'excludeApps') {
    v = v.toLowerCase().replace(/^.*[\\/]/, '');
    if (!v.endsWith('.exe')) v += '.exe';
  }
  if (!s[key].some((x) => x.toLowerCase() === v.toLowerCase())) save({ [key]: [...s[key], v] });
}
$('addAppForm').addEventListener('submit', (e) => { e.preventDefault(); addTo('excludeApps', $('addApp').value); $('addApp').value = ''; });
$('addTitleForm').addEventListener('submit', (e) => { e.preventDefault(); addTo('excludeTitles', $('addTitle').value); $('addTitle').value = ''; });
document.querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', () => save({ [b.dataset.reset]: defaults[b.dataset.reset] })));

const running = $('running');
let runningLoaded = false;
async function loadRunning() {
  if (runningLoaded) return;
  runningLoaded = true;
  running.options[0].textContent = 'Loading…';
  const names = await api.listApps();
  running.options[0].textContent = names ? 'Running apps…' : 'Could not list apps';
  for (const n of names || []) running.append(new Option(n, n));
}
running.addEventListener('focus', loadRunning);
running.addEventListener('pointerdown', loadRunning);
running.addEventListener('change', () => { if (running.value) addTo('excludeApps', running.value); running.value = ''; });

$('dailyNotification').addEventListener('change', (e) => save({ dailyNotification: e.target.checked }));
$('dailyNotificationTime').addEventListener('change', (e) => { if (e.target.value) save({ dailyNotificationTime: e.target.value }); });
// macOS only: Accessibility (Mac App Store: Input Monitoring) permission, needed to notice ⌘C
function showAx(trusted) {
  $('axState').textContent = trusted ? 'Granted' : 'Not granted';
  $('axState').className = 'ax-state ' + (trusted ? 'ok' : 'bad');
}
if (PLATFORM.isMac) {
  $('axGroup').hidden = false;
  $('addApp').placeholder = 'App name';
  $('axOpen').addEventListener('click', () => api.openPermissions());
  api.onPermissions(showAx);
  api.permissions().then(showAx);
}

$('autoUpdate').addEventListener('change', (e) => save({ autoUpdate: e.target.checked }));
$('saveSourceLink').addEventListener('change', (e) => save({ saveSourceLink: e.target.checked }));
$('keepLists').addEventListener('change', (e) => save({ keepLists: e.target.checked }));

// ---------- diagnostics ----------
async function loadDiag() {
  const r = await api.diagnostics();
  if (!r) return;
  diagText = r.text;
  $('diag').replaceChildren(...r.rows.flatMap((row) => [el('dt', '', row.label), el('dd', row.state, row.value)]));
}
$('refreshDiag').addEventListener('click', loadDiag);
$('copyDiag').addEventListener('click', async () => {
  if (!diagText) await loadDiag();
  api.copy(diagText);
  toast('Diagnostics copied');
});
$('openLog').addEventListener('click', () => api.openLog());

// ---------- render ----------
function render() {
  for (const key of Object.keys(FMT)) {
    const input = $(key);
    if (document.activeElement !== input) input.value = s[key];
    document.querySelector(`output[for=${key}]`).textContent = FMT[key](Number(input.value));
  }
  markSpeed(s.animSpeed);
  $('notesPath').textContent = s.notesDir.replace(/[\\/]+$/, '') + PLATFORM.sep + s.notesFile;
  chips('excludeApps');
  chips('excludeTitles');
  $('dailyNotification').checked = s.dailyNotification;
  $('dailyNotificationTime').value = s.dailyNotificationTime;
  $('dailyNotificationTime').disabled = !s.dailyNotification;
  $('autoUpdate').checked = s.autoUpdate;
  $('saveSourceLink').checked = s.saveSourceLink;
  $('keepLists').checked = s.keepLists;
  loadVaults();
}

api.onChange((all) => { s = all; render(); });

api.get().then((info) => {
  s = info.settings;
  defaults = info.defaults;
  $('ver').textContent = 'Tuck ' + info.version;
  $('backupPath').textContent = info.backupDir;
  $('override').hidden = !info.notesDirOverridden;
  $('autoUpdateRow').hidden = !!info.store;
  // Mac App Store: the key tap needs Input Monitoring instead of Accessibility
  $('axLabel').textContent = (info.permissionName || 'Accessibility') + ' access';
  // ... and never reads window titles, so title exclusions could not match there
  $('excludeTitlesRow').hidden = info.permissionName === 'Input Monitoring';
  render();
  let sec = 'capture';
  try { sec = localStorage.getItem('section') || sec; } catch {}
  show(wanted || sec);
});
