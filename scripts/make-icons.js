'use strict';
// Rasterize build/icon.svg -> build/icon.png (512) + build/icon.ico (16..256, PNG-compressed entries).
// Run under Electron: `npm run icons` (= electron scripts/make-icons.js). Optional: `--png-dir <dir>` also dumps each size.
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const BUILD = path.join(__dirname, '..', 'build');
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

// ICO = 6-byte header + 16-byte entry per image + PNG blobs (Vista+ reads PNG entries)
function packIco(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e);
    head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt8(0, e + 2);       // palette colors
    head.writeUInt8(0, e + 3);       // reserved
    head.writeUInt16LE(1, e + 4);    // planes
    head.writeUInt16LE(32, e + 6);   // bpp
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
}

async function main() {
  const svg = fs.readFileSync(path.join(BUILD, 'icon.svg'));
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  await w.loadURL('data:text/html,<!doctype html><title>icons</title>');
  // drawImage of an SVG rasterizes at the destination size, so every size is drawn from the vector
  const urls = await w.webContents.executeJavaScript(`(async () => {
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,${svg.toString('base64')}';
    await img.decode();
    return ${JSON.stringify([...ICO_SIZES, 512])}.map((n) => {
      const c = document.createElement('canvas');
      c.width = c.height = n;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, n, n);
      return c.toDataURL('image/png');
    });
  })()`);
  w.destroy();
  const pngs = urls.map((u, i) => ({ size: [...ICO_SIZES, 512][i], data: Buffer.from(u.split(',')[1], 'base64') }));
  fs.writeFileSync(path.join(BUILD, 'icon.png'), pngs.pop().data);
  fs.writeFileSync(path.join(BUILD, 'icon.ico'), packIco(pngs));
  const k = process.argv.indexOf('--png-dir');
  if (k > 0 && process.argv[k + 1]) {
    fs.mkdirSync(process.argv[k + 1], { recursive: true });
    for (const p of pngs) fs.writeFileSync(path.join(process.argv[k + 1], `icon-${p.size}.png`), p.data);
  }
  console.log('icons: build/icon.png (512), build/icon.ico (' + ICO_SIZES.join(',') + ')');
}

app.whenReady().then(main).then(() => app.quit(), (e) => { console.error(e); app.exit(1); });
