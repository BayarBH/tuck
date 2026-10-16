'use strict';
const fs = require('fs');
const path = require('path');
const { parseNotes } = require('./notesReader');

// Markdown of the given entries, copied verbatim from the notes file (file order = oldest first),
// so the export re-parses exactly like the original.
function buildMarkdown(md, keys, title) {
  const want = new Set(keys);
  const spans = parseNotes(md).filter((e) => want.has(e.key)).sort((a, b) => a.raw.start - b.raw.start)
    .map((e) => md.slice(e.raw.start, e.raw.end).replace(/\r\n?/g, '\n').trimEnd() + '\n\n');
  return `# Tuck${title ? ': ' + title : ''}\n\n` + spans.join('');
}

const pad = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const slug = (s) => String(s || 'notes').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'notes';

// Electron side. All functions resolve to { ok, file? } or { ok:false, canceled:true }.
function createExporter({ app, dialog, clipboard, logger }) {
  async function ask(win, title, ext, name) {
    const r = await dialog.showSaveDialog(win, {
      title,
      defaultPath: path.join(app.getPath('documents'), `Tuck-${slug(name)}-${today()}.${ext}`),
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    return r.canceled || !r.filePath ? null : r.filePath;
  }

  async function markdown(win, { md, keys, title }) {
    const file = await ask(win, 'Export Markdown', 'md', title);
    if (!file) return { ok: false, canceled: true };
    fs.writeFileSync(file, buildMarkdown(md, keys, title), 'utf8');
    logger.info('export', `markdown: ${keys.length} notes`);
    return { ok: true, file };
  }

  // The page's @media print stylesheet turns the current view into a clean, light document.
  async function pdf(win, { title }) {
    const file = await ask(win, 'Export PDF', 'pdf', title);
    if (!file) return { ok: false, canceled: true };
    // page margins are painted with the window background (paper beige / dark): print them white
    const bg = win.getBackgroundColor();
    win.setBackgroundColor('#ffffff');
    let data;
    try { data = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } }); } finally { win.setBackgroundColor(bg); }
    fs.writeFileSync(file, data);
    logger.info('export', 'pdf');
    return { ok: true, file };
  }

  // rect: CSS-pixel rect of the card inside the page; capturePage returns it at device scale.
  async function image(win, rect, action) {
    const r = {
      x: Math.max(0, Math.floor(rect.x)), y: Math.max(0, Math.floor(rect.y)),
      width: Math.ceil(rect.width), height: Math.ceil(rect.height),
    };
    const img = await win.webContents.capturePage(r);
    if (img.isEmpty()) return { ok: false, error: 'empty' };
    if (action === 'copy') { clipboard.writeImage(img); return { ok: true }; }
    const file = await ask(win, 'Save image', 'png', 'note');
    if (!file) return { ok: false, canceled: true };
    fs.writeFileSync(file, img.toPNG());
    return { ok: true, file };
  }

  return { markdown, pdf, image };
}

module.exports = { buildMarkdown, createExporter };
