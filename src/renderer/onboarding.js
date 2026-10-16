'use strict';
// Tutorial. Steps with data-want wait for a real capture reported by main ('double' / 'long').
// macOS adds a permission step (data-perm) that can only be passed once Accessibility is granted.
const $ = (id) => document.getElementById(id);
const api = window.onboarding;
if (!PLATFORM.isMac) document.querySelector('[data-perm]').remove();
const steps = [...document.querySelectorAll('.step')];
const dots = steps.map(() => $('dots').appendChild(document.createElement('i')));
const KEY = PLATFORM.isMac ? '⌘' : 'Ctrl';
const WRONG = {
  double: `That was a long press (saved too). For this step, tap C twice quickly while holding ${KEY}.`,
  long: 'That was a double-tap (saved too). Hold C down a moment longer to open the bar.',
};
const want = (i) => steps[i].dataset.want;
const isPerm = (i) => 'perm' in steps[i].dataset;
let step = 0;
let trusted = !PLATFORM.isMac;

function show(i, animate = true) {
  step = i;
  steps.forEach((s, k) => { s.hidden = k !== i; s.classList.remove('enter'); });
  if (animate) { void steps[i].offsetWidth; steps[i].classList.add('enter'); }
  dots.forEach((d, k) => d.classList.toggle('on', k === i));
  $('count').textContent = `${i + 1} / ${steps.length}`;
  $('back').style.visibility = i === 0 ? 'hidden' : 'visible';
  $('next').textContent = i === steps.length - 1 ? 'Start tucking' : want(i) ? 'Skip step' : 'Next';
  $('next').disabled = isPerm(i) && !trusted; // without access the practice steps cannot work
  const sample = steps[i].querySelector('.sample');
  if (sample && !sample.closest('.practice').classList.contains('ok')) select(sample);
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

function celebrate(p, msg) {
  p.classList.remove('nudge');
  p.classList.add('ok');
  p.querySelector('.msg').textContent = msg;
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
  if (!want(s)) return;
  const p = steps[s].querySelector('.practice');
  if (mode !== want(s)) {
    p.classList.add('nudge');
    p.querySelector('.msg').textContent = WRONG[want(s)];
    return;
  }
  if (p.classList.contains('ok')) return;
  celebrate(p, 'Tucked! It is in your notebook now.');
  // long press: the overlay has focus right now; move on once it hands focus back (or after a while anyway)
  let gone = false;
  const go = () => { if (gone) return; gone = true; setTimeout(() => { if (step === s) show(s + 1); }, 1500); };
  if (document.hasFocus()) go();
  else { window.addEventListener('focus', go, { once: true }); setTimeout(go, 2500); }
});

function setTrusted(ok) {
  if (!PLATFORM.isMac || !ok || trusted) return;
  trusted = true;
  celebrate($('pPerm'), 'Access granted. Tuck can notice ⌘C now.');
  if (isPerm(step)) show(step, false);
}
if (PLATFORM.isMac) {
  api.permission().then(setTrusted);
  api.onPermission(setTrusted);
  $('grant').addEventListener('click', () => api.grant());
}

$('next').addEventListener('click', () => (step < steps.length - 1 ? show(step + 1) : api.done()));
$('back').addEventListener('click', () => show(Math.max(0, step - 1)));
$('skip').addEventListener('click', () => api.done()); // the tutorial stays in the tray menu ("Show tutorial")
$('openNb').addEventListener('click', () => api.openNotebook());
document.querySelectorAll('.sample').forEach((el) => el.addEventListener('click', () => select(el)));

api.info().then((info) => {
  if (!info) return;
  $('notesPath').textContent = info.notesPath;
  $('holdS').textContent = (Math.round(info.longPressMs / 100) / 10).toString();
});
show(0, false);
