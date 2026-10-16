'use strict';
const crypto = require('crypto');
const { extractTags } = require('./notesWriter');

const sha1 = (s) => crypto.createHash('sha1').update(s, 'utf8').digest('hex');

// Parse the notes Markdown written by notesWriter.formatEntry. Returns entries newest first.
// Each entry carries a content key (sha1 of date|time|app|quote|thought, 12 hex; identical entries
// get "-2", "-3"... in file order) and raw {start, end}: char offsets of its span in the ORIGINAL md
// (from "### " up to the next "### " or EOF, so the trailing "---" separator is included).
// raw.bodyEnd: end of the part Tuck models (through the "---" line and the blank lines after it);
// md.slice(bodyEnd, end) is user text after the separator that edits must keep. raw.skipped: count of
// non-blank lines inside the body the parser did not understand (an edit would drop them).
function parseNotes(md) {
  const src = String(md || '');
  const starts = [];
  const re = /^### /gm;
  for (let m; (m = re.exec(src));) starts.push(m.index);
  const seen = new Map();
  const entries = starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : src.length;
    const sep = /^---[ \t]*(?:\r?\n|$)(?:[ \t]*\r?\n)*/m.exec(src.slice(start, end));
    const bodyEnd = sep ? start + sep.index + sep[0].length : end;
    const lines = src.slice(start + 4, sep ? start + sep.index : end).replace(/\r\n?/g, '\n').split('\n');
    const head = lines.shift().trim();
    const m = head.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?: · (.+))?$/);
    const quote = [], thought = [];
    let tags = null, mode = 'quote', skipped = 0;
    for (const l of lines) {
      if (mode === 'quote' && l.startsWith('>')) { quote.push(l.replace(/^> ?/, '')); continue; }
      if (mode !== 'done' && l.startsWith('**My thought**: ')) { mode = 'thought'; thought.push(l.slice(16)); continue; }
      if (mode !== 'done' && l.startsWith('**Tags**: ')) { tags = l.slice(10).split(/\s+/).filter(Boolean); mode = 'done'; continue; }
      if (mode === 'thought') thought.push(l);
      else if (l.trim()) skipped++;
    }
    const t = thought.join('\n').trim();
    const e = {
      id: index,
      date: m ? m[1] : '',
      time: m ? m[2] : '',
      app: m && m[3] ? m[3].trim() : (m ? '' : head),
      quote: quote.join('\n'),
      thought: t,
      tags: tags || extractTags(t),
    };
    let key = sha1([e.date, e.time, e.app, e.quote, e.thought].join('|')).slice(0, 12);
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    if (n > 1) key += '-' + n;
    e.key = key;
    e.raw = { start, end, bodyEnd, skipped };
    return e;
  });
  return entries.reverse();
}

module.exports = { parseNotes };
