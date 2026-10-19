'use strict';
// Rasterize build/icon.svg -> build/icon.png (512), build/icon-1024.png, build/icon.ico (16..256) and
// build/icon.icns (macOS, 16..1024, on Apple's icon grid), all with PNG-compressed entries.
// Run under Electron: `npm run icons` (= electron scripts/make-icons.js). Optional: `--png-dir <dir>` also dumps each size.
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const BUILD = path.join(__dirname, '..', 'build');
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
// ICNS entry type -> pixel size (PNG payloads, macOS 10.7+); @2x types reuse the larger raster
const ICNS_TYPES = [['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024],
  ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512]];
const SIZES = [...new Set([...ICO_SIZES, 512, 1024])];
const MAC_SIZES = [...new Set(ICNS_TYPES.map(([, n]) => n))];
// macOS icon grid: the rounded square is 824 of 1024 px, centered, with a soft drop shadow.
// icon.svg's square is 480 of 512 px, so the mac rasters draw the SVG at 824/1024 * 512/480 of the canvas.
const MAC_SCALE = (824 / 1024) * (512 / 480);

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

// ICNS = 'icns' + total length (BE) + entries of (4-char type, length incl. 8-byte header, data)
function packIcns(bySize) {
  const entries = ICNS_TYPES.map(([type, size]) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii');
    head.writeUInt32BE(8 + bySize[size].length, 4);
    return Buffer.concat([head, bySize[size]]);
  });
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(8 + entries.reduce((n, e) => n + e.length, 0), 4);
  return Buffer.concat([head, ...entries]);
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
    const draw = (n, mac) => {
      const c = document.createElement('canvas');
      c.width = c.height = n;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      if (mac) {
        const d = n * ${MAC_SCALE};
        g.shadowColor = 'rgba(0,0,0,0.3)';
        g.shadowBlur = n * 10 / 1024;
        g.shadowOffsetY = n * 10 / 1024;
        g.drawImage(img, (n - d) / 2, (n - d) / 2, d, d);
      } else g.drawImage(img, 0, 0, n, n);
      return c.toDataURL('image/png');
    };
    return [${JSON.stringify(SIZES)}.map((n) => draw(n, false)), ${JSON.stringify(MAC_SIZES)}.map((n) => draw(n, true))];
  })()`);
  w.destroy();
  const png = (u) => Buffer.from(u.split(',')[1], 'base64');
  const bySize = {};
  const macBySize = {};
  urls[0].forEach((u, i) => { bySize[SIZES[i]] = png(u); });
  urls[1].forEach((u, i) => { macBySize[MAC_SIZES[i]] = png(u); });
  const pngs = ICO_SIZES.map((size) => ({ size, data: bySize[size] }));
  fs.writeFileSync(path.join(BUILD, 'icon.png'), bySize[512]);
  fs.writeFileSync(path.join(BUILD, 'icon-1024.png'), bySize[1024]);
  fs.writeFileSync(path.join(BUILD, 'icon.ico'), packIco(pngs));
  fs.writeFileSync(path.join(BUILD, 'icon.icns'), packIcns(macBySize));
  const k = process.argv.indexOf('--png-dir');
  if (k > 0 && process.argv[k + 1]) {
    fs.mkdirSync(process.argv[k + 1], { recursive: true });
    for (const p of pngs) fs.writeFileSync(path.join(process.argv[k + 1], `icon-${p.size}.png`), p.data);
  }
  if (k > 0 && process.argv[k + 1]) fs.writeFileSync(path.join(process.argv[k + 1], 'icon-mac-1024.png'), macBySize[1024]);
  console.log('icons: build/icon.png (512), build/icon-1024.png, build/icon.ico (' + ICO_SIZES.join(',') + '), build/icon.icns');
}

app.whenReady().then(main).then(() => app.quit(), (e) => { console.error(e); app.exit(1); });
