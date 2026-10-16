'use strict';
const { extractTags } = require('./notesWriter');

// Parse the notes Markdown written by notesWriter.formatEntry. Returns entries newest first.
function parseNotes(md) {
  const text = String(md || '').replace(/\r\n?/g, '\n');
  const parts = text.split(/^### /m).slice(1);
  const entries = parts.map((part, index) => {
    const lines = part.split('\n');
    const head = lines.shift().trim();
    const m = head.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?: · (.+))?$/);
    const quote = [], thought = [];
    let tags = null, mode = 'quote';
    for (const l of lines) {
      if (/^---\s*$/.test(l)) break;
      if (mode === 'quote' && l.startsWith('>')) { quote.push(l.replace(/^> ?/, '')); continue; }
      if (l.startsWith('**My thought**: ')) { mode = 'thought'; thought.push(l.slice(16)); continue; }
      if (l.startsWith('**Tags**: ')) { tags = l.slice(10).split(/\s+/).filter(Boolean); mode = 'done'; continue; }
      if (mode === 'thought') thought.push(l);
    }
    const t = thought.join('\n').trim();
    return {
      id: index,
      date: m ? m[1] : '',
      time: m ? m[2] : '',
      app: m && m[3] ? m[3].trim() : (m ? '' : head),
      quote: quote.join('\n'),
      thought: t,
      tags: tags || extractTags(t),
    };
  });
  return entries.reverse();
}

module.exports = { parseNotes };
