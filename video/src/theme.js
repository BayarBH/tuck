// Tokens copied from the app (zhailuben/src/renderer/notebook.css + overlay.css)
export const C = {
  bg: '#f6f2ea',
  side: '#efe9de',
  card: '#fffdf8',
  ink: '#2b2722',
  ink2: '#5f574d',
  ink3: '#978d80',
  line: 'rgba(60, 45, 25, .10)',
  accent: '#b4532a',
  accent2: '#d98a4e',
  accentSoft: 'rgba(180, 83, 42, .10)',
  rule: '#d9a77f',
  mark: 'rgba(242, 190, 80, .45)',
  select: 'rgba(66, 133, 244, .26)',
  night: '#17161a',
  barBg: 'rgba(30, 30, 36, .84)',
};
export const UI = '"Segoe UI Variable Display", "Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif';
export const READ = 'Georgia, "Noto Serif SC", "Microsoft YaHei UI", serif';

export const FPS = 30;
// Beat grid measured from the music track: BPM and the first downbeat offset.
export const BPM = 103.2;
export const OFFSET = 6; // first beat at 0.209 s
export const B = (60 * FPS) / BPM;
export const beat = (n) => Math.round(OFFSET + n * B);
export const TOTAL_BEATS = 90;
