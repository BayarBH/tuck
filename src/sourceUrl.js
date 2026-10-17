'use strict';
// The page a copy came from. Browsers put it on the clipboard next to the text:
// Windows: the "HTML Format" (CF_HTML) header line "SourceURL:" (Chromium browsers and Firefox);
// macOS: the "org.chromium.source-url" type (Chromium browsers only; Safari and Firefox add nothing).
// Only http(s) links are kept, without user:password@. Nothing here touches the network.
const MAX = 2048;

function clean(raw) {
  if (typeof raw !== 'string') return null;
  let u;
  try { u = new URL(raw.replace(/\u0000/g, '').trim()); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.username = ''; u.password = '';
  return u.href.length <= MAX ? u.href : null;
}

// CF_HTML: "Version:0.9\r\nStartHTML:...\r\nSourceURL:https://...\r\n<html>..." (the header is ASCII)
function fromCfHtml(text) {
  if (typeof text !== 'string') return null;
  const markup = text.search(/</);
  const m = /^SourceURL:(.+)$/m.exec(text.slice(0, markup > 0 ? markup : 4096));
  return m ? clean(m[1]) : null;
}

// -> url string or null; never throws
function read(clipboard, platform = process.platform) {
  try {
    if (platform === 'darwin') return clean(clipboard.readBuffer('org.chromium.source-url').toString('utf8'));
    return fromCfHtml(clipboard.readBuffer('HTML Format').toString('utf8'));
  } catch { return null; }
}

module.exports = { clean, fromCfHtml, read };
