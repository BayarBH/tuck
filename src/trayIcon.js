'use strict';
// Tray icon: simplified Tuck mark - terracotta rounded square with a cream double quote.
// Windows: mid-tone fill reads on both dark and light taskbars; paused = gray. 32x32 BGRA (premultiplied), scaleFactor 2.
// macOS: monochrome template image instead (see templateBitmap).
const fs = require('fs');
const path = require('path');
const { nativeImage } = require('electron');

const S = 32;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const cover = (d) => clamp01(0.5 - d); // signed distance -> pixel coverage

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
  return { d: Math.hypot(px - ax - t * dx, py - ay - t * dy), t };
}

function roundBox(px, py, half, r) {
  const qx = Math.abs(px - S / 2) - half + r, qy = Math.abs(py - S / 2) - half + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// one "6"-shaped quote mark: round blob + tail tapering up-right
function quote(px, py, cx, cy) {
  const blob = Math.hypot(px - cx, py - cy) - 3.3;
  const s = segDist(px, py, cx - 2.2, cy - 0.8, cx + 2.4, cy - 7);
  return Math.min(blob, s.d - (1.6 - 0.8 * s.t));
}

// coverage of the rounded square (a) and of the quote marks (q) for pixel x,y of an n x n bitmap
// (the shapes are designed on the 32px grid; n = 32 samples it exactly as before)
function coverage(x, y, n) {
  const k = S / n, px = (x + 0.5) * k, py = (y + 0.5) * k;
  return {
    a: cover(roundBox(px, py, 15, 7) / k),
    q: cover(Math.min(quote(px, py, 11.5, 19.5), quote(px, py, 20.5, 19.5)) / k),
  };
}

// macOS menu bar: template image (black + alpha, the system tints it); the quotes are cut out of the square.
// paused = fainter. 16x16 @1x + 32x32 @2x.
function templateBitmap(n, paused) {
  const buf = Buffer.alloc(n * n * 4); // BGRA premultiplied: color stays 0 (black), only alpha varies
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const { a, q } = coverage(x, y, n);
      buf[(y * n + x) * 4 + 3] = Math.round(255 * a * (1 - q) * (paused ? 0.35 : 1));
    }
  }
  return buf;
}

function createTrayIcon(paused) {
  if (process.platform === 'darwin') {
    const img = nativeImage.createFromBitmap(templateBitmap(32, paused), { width: 32, height: 32, scaleFactor: 2 });
    img.addRepresentation({ scaleFactor: 1, width: 16, height: 16, buffer: templateBitmap(16, paused) });
    img.setTemplateImage(true);
    return img;
  }
  const [r, g, b] = paused ? [128, 128, 128] : [200, 100, 50];
  const [fr, fg, fb] = [255, 248, 239];
  const buf = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const { a, q } = coverage(x, y, S);
      const i = (y * S + x) * 4;
      const mix = (bg, fgc) => Math.round((bg * (1 - q) + fgc * q) * a);
      buf[i] = mix(b, fb); buf[i + 1] = mix(g, fg); buf[i + 2] = mix(r, fr); buf[i + 3] = Math.round(255 * a);
    }
  }
  return nativeImage.createFromBitmap(buf, { width: S, height: S, scaleFactor: 2 });
}

// Full-color window icon (dev). Packaged builds return undefined: Windows then uses the exe icon (build.win.icon).
let cached;
function appIcon() {
  if (cached === undefined) {
    const p = path.join(__dirname, '..', 'build', 'icon.png');
    cached = fs.existsSync(p) ? nativeImage.createFromPath(p) : null;
    if (cached && cached.isEmpty()) cached = null;
  }
  return cached || undefined;
}

module.exports = { createTrayIcon, appIcon };
