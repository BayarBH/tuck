'use strict';
// Four-step tutorial. Steps 2 and 3 wait for a real capture reported by main ('double' / 'long').
const $ = (id) => document.getElementById(id);
const api = window.onboarding;
const steps = [...document.querySelectorAll('.step')];
const dots = [...$('dots').children];
const WANT = { 1: 'double', 2: 'long' };
const PRACTICE = { 1: $('p2'), 2: $('p3') };
const WRONG = {
  1: 'That was a long press (saved too). For this step, tap C twice quickly while holding Ctrl.',
  2: 'That was a double-tap (saved too). Hold C down a moment longer to open the bar.',
};
let step = 0;

function show(i, animate = true) {
  step = i;
  steps.forEach((s, k) => { s.hidden = k !== i; s.classList.remove('enter'); });
  if (animate) { void steps[i].offsetWidth; steps[i].classList.add('enter'); }
  dots.forEach((d, k) => d.classList.toggle('on', k === i));
  $('count').textContent = `${i + 1} / ${steps.length}`;
  $('back').style.visibility = i === 0 ? 'hidden' : 'visible';
  $('next').textContent = i === steps.length - 1 ? 'Start tucking' : i in WANT ? 'Skip step' : 'Next';
  const sample = steps[i].querySelector('.sample');
  if (sample && !PRACTICE[i].classList.contains('ok')) select(sample);
}

// pre-select the sample so the user only has to press the keys
function select(el) {
  const r = document.createRange();
  r.selectNodeContents(el);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
  el.focus({ preventScroll: true });
}

function celebrate(p) {
  p.classList.remove('nudge');
  p.classList.add('ok');
  p.querySelector('.msg').textContent = 'Tucked! It is in your notebook now.';
  $('next').textContent = 'Next';
  const dot = p.querySelector('.dot');
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, d = 26 + (k % 3) * 10;
    const i = document.createElement('i');
    i.className = 'burst';
    i.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    i.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    if (k % 2) i.style.setProperty('--c', '#f2be50');
    dot.appendChild(i);
  }
}

api.onCaptured((mode) => {
  const s = step;
  if (!WANT[s]) return;
  const p = PRACTICE[s];
  if (mode !== WANT[s]) {
    p.classList.add('nudge');
    p.querySelector('.msg').textContent = WRONG[s];
    return;
  }
  if (p.classList.contains('ok')) return;
  celebrate(p);
  // long press: the overlay has focus right now; move on once it hands focus back (or after a while anyway)
  let gone = false;
  const go = () => { if (gone) return; gone = true; setTimeout(() => { if (step === s) show(s + 1); }, 1500); };
  if (document.hasFocus()) go();
  else { window.addEventListener('focus', go, { once: true }); setTimeout(go, 2500); }
});

$('next').addEventListener('click', () => (step < steps.length - 1 ? show(step + 1) : api.done()));
$('back').addEventListener('click', () => show(Math.max(0, step - 1)));
$('skip').addEventListener('click', () => api.done());
$('openNb').addEventListener('click', () => api.openNotebook());
document.querySelectorAll('.sample').forEach((el) => el.addEventListener('click', () => select(el)));

api.info().then((info) => {
  if (!info) return;
  $('notesPath').textContent = info.notesPath;
  $('holdS').textContent = (Math.round(info.longPressMs / 100) / 10).toString();
});
show(0, false);
