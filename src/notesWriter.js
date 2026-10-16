'use strict';
const fs = require('fs');
const path = require('path');

function extractTags(thought) {
  return [...new Set((String(thought || '').match(/#([\p{L}\p{N}_]+)/gu) || []))];
}

const pad = (n) => String(n).padStart(2, '0');
function formatTime(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatEntry({ text, thought, appName, date }) {
  const quote = String(text || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '')
    .split('\n').map((l) => (l ? '> ' + l : '>')).join('\n');
  const t = String(thought || '').trim();
  const tags = t ? extractTags(t) : [];
  let s = '### ' + formatTime(date || new Date()) + (appName ? ' · ' + appName : '') + '\n' + quote + '\n';
  if (t) s += '\n**My thought**: ' + t + '\n';
  if (tags.length) s += '**Tags**: ' + tags.join(' ') + '\n';
  return s + '\n---\n\n';
}

function appendEntry(entry, { dir, file }) {
  fs.mkdirSync(dir, { recursive: true });
  const p = path.resolve(dir, file);
  let size = 0;
  try { size = fs.statSync(p).size; } catch {}
  fs.appendFileSync(p, (size ? '' : '# Excerpts\n\n') + entry, 'utf8');
  return p;
}

function createDeduper(ms) {
  let last = null, at = -Infinity;
  return {
    isDuplicate: (text, now) => text === last && now - at < ms,
    markSaved(text, now) { last = text; at = now; },
  };
}

module.exports = { extractTags, formatTime, formatEntry, appendEntry, createDeduper };
