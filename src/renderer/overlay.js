'use strict';
// Overlay renderer: the capsule gets "sucked" into the bottom bar; long mode expands an input.
const $ = (id) => document.getElementById(id);
const bar = $('bar'), capsule = $('capsule'), input = $('input');
const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const api = window.zhailu;
const MAX_W = 560;

let cfg = { BAR_WIDTH: 360, BAR_HEIGHT: 44, BAR_BOTTOM: 48, BAR_MAX_LINES: 4 };
let session = null;   // { id, mode }
let swallowRepeat = false;
let gen = 0;          // bumps on every new capture / finish; stale async steps bail out
let running = [];
const measure = document.createElement('canvas').getContext('2d');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const xf = (x, y, s) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`;

function applyConfig(c) {
  cfg = Object.assign({}, cfg, c);
  root.style.setProperty('--bar-w', cfg.BAR_WIDTH + 'px');
  root.style.setProperty('--bar-h', cfg.BAR_HEIGHT + 'px');
  root.style.setProperty('--bar-bottom', cfg.BAR_BOTTOM + 'px');
  root.style.setProperty('--max-lines', String(cfg.BAR_MAX_LINES));
}

function play(el, frames, opts) {
  const a = el.animate(frames, opts);
  running.push(a);
  return a.finished.catch(() => {}); // cancel() rejects; gen check handles staleness
}

function stopAnims() {
  running.forEach((a) => a.cancel());
  running = [];
}

// Jump back to idle with no transition (a new capture interrupts the old animation)
function reset() {
  gen++;
  stopAnims();
  bar.classList.add('instant');
  bar.classList.remove('shown', 'saved', 'expanded');
  capsule.style.opacity = '0';
  input.value = '';
  autoGrow();
  void bar.offsetWidth;
  bar.classList.remove('instant');
  return gen;
}

function flyIn(preview, x, y) {
  capsule.textContent = preview || '…';
  const { width: w, height: h } = capsule.getBoundingClientRect();
  const W = window.innerWidth, H = window.innerHeight;
  // start: just above the cursor; end: bar center
  const sx = clamp(x - w / 2, 8, W - w - 8);
  const sy = clamp(y - h - 14, 8, H - h - 8);
  const ex = W / 2 - w / 2;
  const ey = H - cfg.BAR_BOTTOM - cfg.BAR_HEIGHT / 2 - h / 2;

  if (reduced.matches) {
    return play(capsule, [
      { transform: xf(sx, sy, 1), opacity: 1 },
      { transform: xf(sx, sy, 1), opacity: 0 },
    ], { duration: 160, easing: 'ease-out' });
  }

  // quadratic bezier: slight rise, then accelerate in; control point above the midpoint
  const cx = (sx + ex) / 2;
  const cy = Math.max(8, Math.min(sy, ey) - 50);
  const POP = 0.14, N = 18, frames = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let px = sx, py = sy, s, o;
    if (t <= POP) {
      const p = 1 - Math.pow(1 - t / POP, 3); // ease-out pop-in
      s = 0.9 + 0.1 * p;
      o = p;
      py = sy + 6 * (1 - p);
    } else {
      const u = Math.pow((t - POP) / (1 - POP), 2.2); // accelerate-in "suck"
      const k = 1 - u;
      px = k * k * sx + 2 * k * u * cx + u * u * ex;
      py = k * k * sy + 2 * k * u * cy + u * u * ey;
      s = 1 - 0.8 * u;
      o = 1 - Math.pow(u, 4);
    }
    frames.push({ transform: xf(px, py, s), opacity: o });
  }
  return play(capsule, frames, { duration: 260, easing: 'linear' });
}

function pulse() {
  if (reduced.matches) return Promise.resolve();
  const g = `rgba(${getComputedStyle(root).getPropertyValue('--glow').trim()}`;
  return play(bar, [
    { transform: 'scale(1)', boxShadow: `0 0 0 0 ${g}, 0)`, borderColor: 'rgba(255,255,255,.12)' },
    { transform: 'scale(1.07)', boxShadow: `0 0 26px 4px ${g}, .45)`, borderColor: `${g}, .6)`, offset: 0.35 },
    { transform: 'scale(1)', boxShadow: `0 0 0 0 ${g}, 0)`, borderColor: 'rgba(255,255,255,.12)' },
  ], { duration: 150, easing: 'ease-out' });
}

let inputFont = '';
function autoGrow() {
  const line = parseFloat(getComputedStyle(input).lineHeight) || 20;
  const max = line * cfg.BAR_MAX_LINES;
  input.style.height = 'auto';
  const sh = input.scrollHeight;
  input.style.height = Math.min(sh, max) + 'px';
  input.style.overflowY = sh > max + 1 ? 'auto' : 'hidden';

  if (!inputFont) inputFont = getComputedStyle(input).font;
  measure.font = inputFont;
  let longest = 0;
  for (const l of input.value.split('\n')) longest = Math.max(longest, measure.measureText(l).width);
  const maxW = Math.min(MAX_W, window.innerWidth - 32);
  const w = clamp(longest + 48, cfg.BAR_WIDTH, Math.max(cfg.BAR_WIDTH, maxW));
  root.style.setProperty('--bar-dyn', Math.round(w) + 'px');
}

function expand() {
  bar.classList.add('expanded');
  autoGrow();
  input.focus();
}

function finish(kind) {
  if (!session || session.mode !== 'long') return;
  const { id } = session;
  session = null;
  gen++;
  stopAnims();
  const thought = input.value;
  input.blur();
  bar.classList.remove('expanded', 'shown', 'saved');
  if (kind === 'submit') api.submit(id, thought);
  else api.cancel(id);
}

async function onCapture({ id, preview, x, y, mode }) {
  const g = reset();
  session = { id, mode };
  // long: focus early (textarea is transparent but focusable) so typing during the fly-in is kept.
  // The C key is usually still held; swallow its OS auto-repeat until a fresh keydown.
  if (mode === 'long') { swallowRepeat = true; input.focus(); }
  bar.classList.add('shown');

  await flyIn(preview, x, y);
  if (g !== gen) return;
  if (mode === 'double') bar.classList.add('saved');
  await pulse();
  if (g !== gen) return;

  if (mode === 'long') { expand(); return; }

  await sleep(reduced.matches ? 220 : 20);
  if (g !== gen) return;
  bar.classList.remove('shown', 'saved');
  await sleep(150);
  if (g !== gen) return;
  session = null;
  api.animDone(id);
}

input.addEventListener('input', autoGrow);
bar.addEventListener('transitionend', (e) => {
  if (e.target === bar && e.propertyName === 'width' && bar.classList.contains('expanded')) autoGrow();
});
input.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
  e.preventDefault();
  finish('submit');
});
window.addEventListener('keydown', (e) => {
  if (swallowRepeat) {
    if (e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    swallowRepeat = false;
  }
  if (e.key === 'Escape' && !e.isComposing) { e.preventDefault(); finish('cancel'); }
}, true); // capture phase: runs before the textarea's own handler

// a click outside the bar during long input cancels (the window is not click-through then)
window.addEventListener('mousedown', (e) => {
  if (session && session.mode === 'long' && !bar.contains(e.target)) finish('cancel');
});

applyConfig({});
if (api) {
  api.onConfig(applyConfig);
  api.onCapture(onCapture);
}
