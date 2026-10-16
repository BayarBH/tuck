'use strict';
// Pure: should a capture from this foreground window be skipped?
// apps: exact process names, case-insensitive, ".exe" optional on either side.
// titles: case-insensitive substrings of the window title.
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\.exe$/, '');

function isExcluded(fg, { apps = [], titles = [] } = {}) {
  if (!fg) return false;
  const name = norm(fg.processName);
  if (name && apps.some((a) => norm(a) && norm(a) === name)) return true;
  const title = String(fg.title || '').toLowerCase();
  return !!title && titles.some((t) => { const s = String(t || '').trim().toLowerCase(); return s && title.includes(s); });
}

module.exports = { isExcluded };
