'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { formatEntry, appendEntry } = require('./notesWriter');
const { parseNotes } = require('./notesReader');
const { writeFileAtomic } = require('./fsAtomic');

const KEEP_BACKUPS = 20;      // newest pre-edit backups
const KEEP_DAILY_DAYS = 30;   // "-daily" backups (first append of a day) are pruned separately
const MAX_UNDO = 50;
const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

// All reads/rewrites of the notes file. Every rewrite = backup of the current content + atomic write.
// Results never throw for expected conflicts: { ok:false, error:'changed'|'invalid'|'unparsable'|'expired' }.
// Unexpected IO errors do throw (callers log them).
function createNotesStore({ getPaths, backupDir, logger }) {
  const undos = new Map(); // token -> { kind, file, before, after, update: oldText/newText, remove: removed[] }
  const lastDailyBackup = new Map(); // notes file path -> day

  const filePath = () => { const { dir, file } = getPaths(); return path.resolve(dir, file); };

  function load() {
    const file = filePath();
    try { return { file, md: fs.readFileSync(file, 'utf8') }; } catch (e) {
      if (e.code === 'ENOENT') return { file, md: '' };
      throw e;
    }
  }

  function backup(md, now = new Date(), suffix = '') {
    if (!md) return;
    fs.mkdirSync(backupDir, { recursive: true });
    const base = `${getPaths().file}-${stamp(now)}${suffix}`;
    let name = base + '.md';
    for (let i = 2; fs.existsSync(path.join(backupDir, name)); i++) name = `${base}-${i}.md`;
    // written from memory (not copyFile) so mtime = backup time, which is what pruning sorts by
    fs.writeFileSync(path.join(backupDir, name), md, 'utf8');
    prune();
  }

  // two pools, so a burst of edits can never prune the day-start copies
  function prune() {
    const prefix = getPaths().file + '-';
    const isDaily = (n) => /-daily(-d+)?.md$/.test(n);
    const files = fs.readdirSync(backupDir)
      .filter((n) => n.startsWith(prefix) && n.endsWith('.md'))
      .map((n) => ({ n, t: fs.statSync(path.join(backupDir, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t || (a.n < b.n ? 1 : -1));
    const drop = [...files.filter((f) => !isDaily(f.n)).slice(KEEP_BACKUPS), ...files.filter((f) => isDaily(f.n)).slice(KEEP_DAILY_DAYS)];
    for (const f of drop) { try { fs.unlinkSync(path.join(backupDir, f.n)); } catch {} }
  }

  function rewrite(file, before, after) {
    backup(before);
    writeFileAtomic(file, after);
  }

  function remember(rec) {
    const token = crypto.randomBytes(8).toString('hex');
    undos.set(token, rec);
    while (undos.size > MAX_UNDO) undos.delete(undos.keys().next().value);
    return token;
  }

  function read() {
    const { file, md } = load();
    return { entries: parseNotes(md), file };
  }

  function append(entryString) {
    const { file, md } = load();
    const day = stamp(new Date()).slice(0, 8);
    if (md && lastDailyBackup.get(file) !== day) {
      try {
        // ponytail: "already has one today" is judged by file NAME, so two same-named files in different folders share it
        const prefix = `${getPaths().file}-${day}`;
        const has = fs.existsSync(backupDir) && fs.readdirSync(backupDir).some((n) => n.startsWith(prefix) && /-daily(-d+)?.md$/.test(n));
        if (!has) backup(md, new Date(), '-daily');
        lastDailyBackup.set(file, day);
      } catch (e) { if (logger) logger.warn('store', 'daily backup failed: ' + e.message); }
    }
    return appendEntry(entryString, getPaths());
  }

  function find(md, key) {
    return parseNotes(md).find((e) => e.key === key) || null;
  }

  function update(key, patch = {}) {
    const { file, md } = load();
    const e = find(md, key);
    if (!e) return { ok: false, error: 'changed' };
    const quote = patch.quote !== undefined ? patch.quote : e.quote;
    const thought = patch.thought !== undefined ? patch.thought : e.thought;
    if (typeof quote !== 'string' || typeof thought !== 'string' || !quote.trim()) return { ok: false, error: 'invalid' };
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.date), t = /^(\d{2}):(\d{2})$/.exec(e.time);
    // lines the parser did not understand would be dropped by a rewrite: refuse instead
    if (!m || !t || e.raw.skipped) return { ok: false, error: 'unparsable' };
    const date = new Date(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
    // only the modeled part [start, bodyEnd) is rewritten; text the user added after "---" stays
    const oldText = md.slice(e.raw.start, e.raw.bodyEnd);
    const newText = formatEntry({ text: quote, thought, appName: e.app, date, source: e.source });
    const after = md.slice(0, e.raw.start) + newText + md.slice(e.raw.bodyEnd);
    rewrite(file, md, after);
    const updated = parseNotes(after).find((x) => x.raw.start === e.raw.start);
    return { ok: true, undo: remember({ kind: 'update', file, before: md, after, oldText, newText }), key: updated && updated.key };
  }

  // key or [keys]: one rewrite, one backup, one undo token for all of them
  function remove(keys) {
    const { file, md } = load();
    const byKey = new Map(parseNotes(md).map((e) => [e.key, e]));
    const list = [...new Set([].concat(keys))].map((k) => byKey.get(k));
    if (!list.length || list.some((e) => !e)) return { ok: false, error: 'changed' };
    list.sort((a, b) => a.raw.start - b.raw.start);
    let after = '', at = 0;
    for (const e of list) { after += md.slice(at, e.raw.start); at = e.raw.bodyEnd; }
    after += md.slice(at);
    rewrite(file, md, after);
    const removed = list.map((e) => ({ oldText: md.slice(e.raw.start, e.raw.bodyEnd), date: e.date, time: e.time }));
    return { ok: true, count: list.length, undo: remember({ kind: 'remove', file, before: md, after, removed }) };
  }

  // re-insert a removed entry before the first later entry, else at the end
  function reinsert(md, { oldText, date, time }) {
    const when = date + ' ' + time;
    const later = parseNotes(md).filter((x) => x.date && `${x.date} ${x.time}` > when).sort((a, b) => a.raw.start - b.raw.start)[0];
    if (later) return md.slice(0, later.raw.start) + oldText + md.slice(later.raw.start);
    const head = md ? (md.endsWith('\n\n') ? md : md.endsWith('\n') ? md + '\n' : md + '\n\n') : '# Tuck\n\n';
    return head + oldText;
  }

  function undo(token) {
    const rec = undos.get(token);
    if (!rec) return { ok: false, error: 'expired' };
    const { file, md } = load();
    if (file !== rec.file) return { ok: false, error: 'changed' }; // notes folder changed since
    let restored;
    if (md === rec.after) {
      restored = rec.before;
    } else if (rec.kind === 'update') {
      // file changed since (e.g. a new capture was appended): swap the edited entry back if it is still there
      const i = md.indexOf(rec.newText);
      if (i < 0) return { ok: false, error: 'changed' };
      restored = md.slice(0, i) + rec.oldText + md.slice(i + rec.newText.length);
    } else {
      restored = rec.removed.reduce(reinsert, md);
    }
    rewrite(file, md, restored);
    undos.delete(token);
    return { ok: true };
  }

  return { read, append, update, remove, undo };
}

module.exports = { createNotesStore };
