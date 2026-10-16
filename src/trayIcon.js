'use strict';
// Tray icon: a pill with two punched-out "quote" dots. 32x32 BGRA (premultiplied alpha), scaleFactor 2.
const { nativeImage } = require('electron');

const S = 32;

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function createTrayIcon(paused) {
  const [r, g, b] = paused ? [140, 140, 140] : [79, 163, 255];
  const buf = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px = x + 0.5, py = y + 0.5;
      let a = clamp01(0.5 - (segDist(px, py, 10, 16, 22, 16) - 8)); // pill
      for (const cx of [12.5, 19.5]) a *= clamp01(Math.hypot(px - cx, py - 16) - 2.6 + 0.5); // punched dots
      const i = (y * S + x) * 4;
      buf[i] = Math.round(b * a); buf[i + 1] = Math.round(g * a); buf[i + 2] = Math.round(r * a); buf[i + 3] = Math.round(255 * a);
    }
  }
  return nativeImage.createFromBitmap(buf, { width: S, height: S, scaleFactor: 2 });
}

module.exports = { createTrayIcon };
