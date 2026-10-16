'use strict';
// Review helpers over parseNotes() entries. dateStr = local 'YYYY-MM-DD'. Pure except createReviewScheduler.

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
const dayNum = (s) => { const p = parse(s); return p ? Date.UTC(p.y, p.m - 1, p.d) / 864e5 : NaN; };
const when = (e) => `${e.date} ${e.time} ${e.key || ''}`;
const byWhen = (a, b) => (when(a) < when(b) ? -1 : when(a) > when(b) ? 1 : 0);

// FNV-1a: same date -> same pick, all day long
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

// One past note for the day. Prefers notes older than 3 days; never today's (or future) notes.
function dailyPick(entries, dateStr) {
  const today = dayNum(dateStr);
  if (Number.isNaN(today)) return null;
  const past = entries.filter((e) => dayNum(e.date) < today);
  const old = past.filter((e) => today - dayNum(e.date) > 3);
  const pool = (old.length ? old : past).slice().sort(byWhen);
  return pool.length ? pool[hash(dateStr) % pool.length] : null;
}

// Notes from the same day-of-month in earlier months / years, newest first, each with an `ago` label.
function onThisDay(entries, dateStr) {
  const t = parse(dateStr);
  if (!t) return [];
  const out = [];
  for (const e of entries) {
    const p = parse(e.date);
    if (!p || p.d !== t.d) continue;
    const months = (t.y * 12 + t.m) - (p.y * 12 + p.m);
    if (months <= 0) continue;
    const ago = months % 12 === 0
      ? (months === 12 ? '1 year ago' : `${months / 12} years ago`)
      : (months === 1 ? '1 month ago' : `${months} months ago`);
    out.push({ ...e, ago });
  }
  return out.sort((a, b) => byWhen(b, a));
}

function countBy(list, pick, top) {
  const m = new Map();
  for (const e of list) for (const k of pick(e)) m.set(k, (m.get(k) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, top);
}

// Calendar week (Monday..Sunday) containing `now`.
function weekly(entries, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const days = [];
  for (let i = 0; i < 7; i++) days.push({ date: ymd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)), n: 0 });
  const first = days[0].date, last = days[6].date;
  const list = entries.filter((e) => e.date >= first && e.date <= last);
  for (const e of list) days.find((d) => d.date === e.date).n++;
  return {
    start: first,
    end: last,
    entries: list,
    count: list.length,
    withThought: list.filter((e) => e.thought).length,
    activeDays: days.filter((d) => d.n).length,
    days,
    tags: countBy(list, (e) => e.tags, 8),
    apps: countBy(list, (e) => (e.app ? [e.app] : []), 5),
  };
}

const truncate = (s, n) => { const c = [...s.replace(/\s+/g, ' ').trim()]; return c.length > n ? c.slice(0, n - 1).join('') + '…' : c.join(''); };

// Optional daily notification with the day's pick. Local only: the text never leaves the machine.
// Checks once a minute and fires within an hour after dailyNotificationTime (covers sleep / late start).
// ponytail: "shown today" is in memory, so a restart inside that hour can show it again
function createReviewScheduler(ctx, deps = {}) {
  const Notification = deps.Notification || require('electron').Notification;
  let lastShown = '', current = null, timer = null;

  function tick(now = new Date()) {
    const s = ctx.settings;
    if (!s.get('dailyNotification') || !Notification.isSupported()) return;
    const today = ymd(now);
    if (lastShown === today) return;
    const [h, m] = s.get('dailyNotificationTime').split(':').map(Number);
    const mins = now.getHours() * 60 + now.getMinutes() - (h * 60 + m);
    if (mins < 0 || mins >= 60) return;
    lastShown = today;
    let pick;
    try { pick = dailyPick(ctx.store.read().entries, today); } catch (e) { ctx.logger.error('review', e); return; }
    if (!pick) return;
    current = new Notification({ title: "Tuck · Today's pick", body: truncate(pick.quote, 120), silent: true });
    current.on('click', () => ctx.openNotebook());
    current.show(); // kept in `current` so the click handler survives GC
  }

  return {
    tick,
    start() {
      clearInterval(timer);
      timer = setInterval(() => { try { tick(); } catch (e) { ctx.logger.error('review', e); } }, 60e3);
      timer.unref?.();
      tick();
    },
  };
}

module.exports = { dailyPick, onThisDay, weekly, createReviewScheduler, truncate, ymd };
