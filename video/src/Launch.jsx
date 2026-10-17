import React from 'react';
import { AbsoluteFill, Sequence, Audio, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, UI, READ, B, beat, TOTAL_BEATS } from './theme';
import { Kinetic, Keycap, Cursor, Mark, Article, Capsule, Bar, NoteCard, Notebook, clamp, ease } from './ui';

const lb = (n) => Math.round(n * B); // local beat -> frames inside a scene
const SCENES = { hook: [0, 8], gone: [8, 12], double: [12, 28], hold: [28, 44], book: [44, 60], privacy: [60, 68], mac: [68, 78], end: [78, TOTAL_BEATS] };

// scene wrapper: fade + slight zoom at the edges so cuts breathe
const Scene = ({ name, children, fadeIn = 6, fadeOut = 6 }) => {
  const [a, b] = SCENES[name];
  const from = beat(a), dur = beat(b) - beat(a);
  return (
    <Sequence from={from} durationInFrames={dur} name={name}>
      <Fade dur={dur} fadeIn={fadeIn} fadeOut={fadeOut}>{children}</Fade>
    </Sequence>
  );
};
const Fade = ({ dur, fadeIn, fadeOut, children }) => {
  const f = useCurrentFrame();
  const o = Math.min(fadeIn ? interpolate(f, [0, fadeIn], [0, 1], clamp) : 1, fadeOut ? interpolate(f, [dur - fadeOut, dur], [1, 0], clamp) : 1);
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

const Paper = ({ night = 0 }) => (
  <AbsoluteFill style={{ background: `radial-gradient(1200px 700px at 20% 10%, #fbf7f0, transparent), radial-gradient(1000px 800px at 90% 100%, #efe4d3, transparent), ${C.bg}` }}>
    <AbsoluteFill style={{ background: `radial-gradient(900px 600px at 50% 45%, #2a2530, ${C.night})`, opacity: night }} />
  </AbsoluteFill>
);

// ---------- 1. hook ----------
const Hook = () => (
  <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
    <Kinetic words={['You', 'read', 'something', { t: 'worth keeping.', color: C.accent }]} start={lb(0.5)} every={lb(1)} size={104} out={lb(7.3)} />
  </AbsoluteFill>
);

const Gone = () => {
  const f = useCurrentFrame();
  const words = ['Copied', 'it', 'somewhere.'];
  const drift = interpolate(f, [lb(2.4), lb(3.6)], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26 }}>
      <div style={{ opacity: 1 - drift, transform: `translateY(${-drift * 40}px)`, filter: `blur(${drift * 14}px)` }}>
        <Kinetic words={words} start={0} every={lb(0.5)} size={92} color={C.ink2} weight={500} />
      </div>
      <div style={{ position: 'absolute', top: '58%' }}>
        <Kinetic words={['Never', 'saw', 'it', 'again.']} start={lb(1.6)} every={lb(0.33)} size={50} color={C.ink3} weight={500} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- shared desktop for the capture scenes ----------
const ARTICLE = {
  title: 'On reading slowly',
  before: 'We skim more than ever, and remember less.',
  s1: 'The lines that change how we think are rarely the ones we bookmark; they are the ones we stop to write down.',
  s2: 'Keeping a sentence is a small act of attention.',
};
const BAR_CENTER = { x: 960, y: 1080 - 72 - 31 };
const fly = (f, start, end, from, to) => {
  const t = interpolate(f, [start, end], [0, 1], clamp);
  const u = Math.pow(t, 2.1); // accelerate in: "sucked" into the bar
  const cx = (from.x + to.x) / 2, cy = Math.min(from.y, to.y) - 160;
  const k = 1 - u;
  return { x: k * k * from.x + 2 * k * u * cx + u * u * to.x, y: k * k * from.y + 2 * k * u * cy + u * u * to.y, scale: 1 - 0.78 * u, opacity: t >= 1 ? 0 : 1 - Math.pow(u, 5), t };
};
const press = (f, at, len = 4) => interpolate(f, [at, at + 2, at + len, at + len + 3], [0, 1, 1, 0], clamp);

const Headline = ({ children, at, sub, subAt }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', top: 64, left: 0, right: 0, textAlign: 'center' }}>
      <Kinetic words={children.split(' ')} start={at} every={3} size={66} />
      {sub && <div style={{ marginTop: 8, fontFamily: UI, fontSize: 30, color: C.ink3, opacity: interpolate(f, [subAt, subAt + 10], [0, 1], clamp) }}>{sub}</div>}
    </div>
  );
};

const DoubleTap = () => {
  const f = useCurrentFrame();
  const enter = spring({ frame: f, fps: 30, config: { damping: 200 } });
  const select = interpolate(f, [lb(1.5), lb(3.5)], [0, 1], { ...clamp, easing: ease });
  const keysIn = spring({ frame: f - lb(4), fps: 30, config: { damping: 18 } });
  const ctrl = interpolate(f, [lb(5) - 3, lb(5), lb(7.6), lb(7.6) + 3], [0, 1, 1, 0], clamp);
  const c1 = press(f, lb(6)), c2 = press(f, lb(7));
  const capsule = fly(f, lb(7.1), lb(8.6), { x: 914, y: 714 }, BAR_CENTER);
  const barShow = interpolate(f, [lb(7), lb(7.6), lb(11.5), lb(12.2)], [0, 1, 1, 0], clamp);
  const pulse = interpolate(f, [lb(8.6), lb(8.9), lb(9.8)], [0, 1, 0], clamp);
  const saved = interpolate(f, [lb(8.7), lb(9.1)], [0, 1], clamp);
  const cur = interpolate(f, [lb(0.8), lb(1.5), lb(3.5)], [0, 1, 2], clamp);
  const cx = cur < 1 ? interpolate(cur, [0, 1], [1500, 336]) : interpolate(cur, [1, 2], [336, 914]);
  const cy = cur < 1 ? interpolate(cur, [0, 1], [900, 642]) : interpolate(cur, [1, 2], [642, 699]);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 100, top: 230, transformOrigin: '0 0', opacity: enter, transform: `translateY(${(1 - enter) * 80}px) scale(${1.06 + enter * 0.04})` }}>
        <Article title={ARTICLE.title} before={ARTICLE.before} target={ARTICLE.s1} after={ARTICLE.s2} select={select} />
      </div>
      <Cursor x={cx} y={cy} text opacity={interpolate(f, [lb(0.6), lb(1), lb(4.5), lb(5)], [0, 1, 1, 0], clamp)} />
      <div style={{ position: 'absolute', left: 1470, top: 470, display: 'flex', gap: 22, alignItems: 'center', opacity: keysIn, transform: `translateY(${(1 - keysIn) * 40}px)` }}>
        <Keycap label="Ctrl" w={150} down={ctrl} glow={ctrl} />
        <span style={{ fontFamily: UI, fontSize: 40, color: C.ink3 }}>+</span>
        <Keycap label="C" down={Math.max(c1, c2)} glow={Math.max(c1, c2)} />
      </div>
      <div style={{ position: 'absolute', left: 1470, top: 610, width: 300, textAlign: 'center', fontFamily: UI, fontSize: 26, color: C.accent, fontWeight: 600, opacity: interpolate(f, [lb(6), lb(6.3)], [0, 1], clamp) }}>
        {f >= lb(7) ? '× 2' : '× 1'}
      </div>
      {capsule.t > 0 && <Capsule text="The lines that change how we th…" x={capsule.x} y={capsule.y} scale={capsule.scale} opacity={capsule.opacity} />}
      <Bar show={barShow} pulse={pulse} saved={saved} />
      <Headline at={lb(9)} sub="Tucked away. You keep reading." subAt={lb(11)}>Double-tap Ctrl+C.</Headline>
    </AbsoluteFill>
  );
};

const THOUGHT = 'Attention is the real bookmark. #reading';
const Hold = () => {
  const f = useCurrentFrame();
  const select = interpolate(f, [lb(1), lb(2.6)], [0, 1], { ...clamp, easing: ease });
  const ctrl = interpolate(f, [lb(3.6) - 3, lb(3.6), lb(6.8), lb(6.8) + 3], [0, 1, 1, 0], clamp);
  const cDown = interpolate(f, [lb(4), lb(4) + 2, lb(6.8), lb(6.8) + 3], [0, 1, 1, 0], clamp);
  const ring = interpolate(f, [lb(4), lb(6)], [0, 1], { ...clamp, easing: ease });
  const capsule = fly(f, lb(6), lb(7.5), { x: 672, y: 773 }, BAR_CENTER);
  const barShow = interpolate(f, [lb(5.9), lb(6.5), lb(14.6), lb(15.4)], [0, 1, 1, 0], clamp);
  const pulse = Math.max(interpolate(f, [lb(7.5), lb(7.8), lb(8.6)], [0, 1, 0], clamp), interpolate(f, [lb(13.6), lb(13.9), lb(14.8)], [0, 0.8, 0], clamp));
  const expand = interpolate(f, [lb(8), lb(8.8), lb(13.4), lb(13.9)], [0, 1, 1, 0], { ...clamp, easing: ease });
  const chars = Math.floor(interpolate(f, [lb(9), lb(12.6)], [0, [...THOUGHT].length], clamp));
  const enter = press(f, lb(13.2), 4);
  const saved = interpolate(f, [lb(13.9), lb(14.2)], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 100, top: 230, transformOrigin: '0 0', transform: 'scale(1.1)' }}>
        <Article title={ARTICLE.title} before={`${ARTICLE.before} ${ARTICLE.s1}`} target={ARTICLE.s2} after="" select={select} />
      </div>
      <div style={{ position: 'absolute', left: 1470, top: 470, display: 'flex', gap: 22, alignItems: 'center', opacity: interpolate(f, [lb(3), lb(3.5), lb(11.6), lb(12.1)], [0, 1, 1, 0], clamp) }}>
        <Keycap label="Ctrl" w={150} down={ctrl} glow={ctrl} />
        <span style={{ fontFamily: UI, fontSize: 40, color: C.ink3 }}>+</span>
        <div style={{ position: 'relative' }}>
          <Keycap label="C" down={cDown} glow={cDown} />
          <svg width="150" height="150" style={{ position: 'absolute', left: -17, top: -22 }}>
            <circle cx="75" cy="75" r="68" fill="none" stroke={C.accent} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${ring * 427} 427`} transform="rotate(-90 75 75)" opacity={cDown} />
          </svg>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 1470, top: 610, width: 300, textAlign: 'center', fontFamily: UI, fontSize: 26, color: C.accent, fontWeight: 600, opacity: interpolate(f, [lb(4.2), lb(4.6), lb(11.6), lb(12.1)], [0, 1, 1, 0], clamp) }}>hold</div>
      <div style={{ position: 'absolute', left: 1530, top: 470, opacity: interpolate(f, [lb(12.8), lb(13.1), lb(14), lb(14.4)], [0, 1, 1, 0], clamp) }}>
        <Keycap label="Enter" w={190} down={enter} glow={enter} />
      </div>
      {capsule.t > 0 && <Capsule text="Keeping a sentence is a small…" x={capsule.x} y={capsule.y} scale={capsule.scale} opacity={capsule.opacity} />}
      <Bar show={barShow} pulse={pulse} expand={expand} saved={saved} typed={[...THOUGHT].slice(0, chars).join('')} caret={f % 30 < 18 || chars < [...THOUGHT].length} />
      <Headline at={lb(8.5)} sub="Write the why while it’s fresh." subAt={lb(10.5)}>Hold to add a thought.</Headline>
    </AbsoluteFill>
  );
};

// ---------- 5. notebook ----------
const NOTES = [
  { quote: 'Keeping a sentence is a small act of attention.', thought: 'Attention is the real bookmark.', tags: ['#reading'], time: '10:42', app: 'Chrome', fresh: true },
  { quote: 'The best interface is the one you forget is there.', thought: 'Tuck should feel like this.', tags: ['#product'], time: '09:15', app: 'Notion' },
  { quote: 'Write drunk on curiosity, edit sober on evidence.', time: 'Yesterday', app: 'Kindle' },
  { quote: 'A model that is rewarded for looking helpful is not the same as one that is.', thought: 'Core of the alignment problem.', tags: ['#ai_safety'], time: 'Yesterday', app: 'Claude' },
];
const Book = () => {
  const f = useCurrentFrame();
  const rise = spring({ frame: f, fps: 30, config: { damping: 26, stiffness: 70 } });
  const drift = interpolate(f, [0, lb(16)], [0, 1]);
  const tagOn = f >= lb(9.4);
  const tagPulse = interpolate(f, [lb(9.4), lb(9.7), lb(10.6)], [0, 1, 0], clamp);
  const list = tagOn ? [NOTES[1], { quote: 'Small tools win by staying out of the way.', thought: 'Rule #1 for anything I build.', tags: ['#product'], time: 'Mon', app: 'X' }] : NOTES;
  const swap = tagOn ? interpolate(f, [lb(9.4), lb(10)], [0, 1], clamp) : 1;
  const cursor = interpolate(f, [lb(7.5), lb(9.2)], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ perspective: 2200 }}>
      <div style={{ position: 'absolute', left: 70, top: 300, width: 560 }}>
        <Kinetic words={['Everything', 'you', 'kept.']} start={lb(1.5)} every={4} size={74} align="left" />
        <div style={{ height: 18 }} />
        <Kinetic words={['Tagged.', 'Searchable.', { t: 'Yours.', color: C.accent }]} start={lb(4)} every={lb(1)} size={46} weight={500} color={C.ink2} align="left" />
        <div style={{ marginTop: 30, fontFamily: UI, fontSize: 24, color: C.ink3, lineHeight: 1.5, opacity: interpolate(f, [lb(7), lb(7.6)], [0, 1], clamp) }}>A plain Markdown file on your computer.<br />Open it in Obsidian, or anywhere.</div>
      </div>
      <div style={{ position: 'absolute', left: 610, top: 120, transformOrigin: '0% 0%', opacity: rise, transform: `translateY(${(1 - rise) * 380}px) rotateX(${(1 - rise) * 26 + 3 - drift * 2}deg) rotateY(${-7 + drift * 3}deg) scale(${0.78 + drift * 0.03})` }}>
        <Notebook activeTag={tagOn ? '#product' : null} tagPulse={tagPulse}>
          <div style={{ fontFamily: UI, fontSize: 32, fontWeight: 600, color: C.ink, marginBottom: 18 }}>{tagOn ? '#product' : 'All notes'} <span style={{ fontSize: 18, fontWeight: 400, color: C.ink3 }}>{tagOn ? '11 notes' : '128 tucked away'}</span></div>
          <div style={{ opacity: swap, transform: `translateY(${(1 - swap) * 20}px)` }}>
            {list.map((n, i) => {
              const s = spring({ frame: f - lb(1.2) - i * 5 - (tagOn ? lb(9.4) - lb(1.2) : 0), fps: 30, config: { damping: 22 } });
              return <NoteCard key={n.quote} {...n} fresh={n.fresh ? interpolate(f, [lb(2), lb(3), lb(6)], [0, 1, 0], clamp) : 0} style={{ marginBottom: 18, opacity: s, transform: `translateY(${(1 - s) * 30}px)` }} />;
            })}
          </div>
        </Notebook>
        <Cursor x={interpolate(cursor, [0, 1], [900, 120])} y={interpolate(cursor, [0, 1], [700, 372])} scale={1.3} opacity={interpolate(f, [lb(7.3), lb(7.6), lb(12), lb(12.5)], [0, 1, 1, 0], clamp)} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- 6. privacy ----------
const ROW = ['Esc', 'Tab', 'Q', 'W', 'E', 'R', 'Ctrl', '⌘', 'A', 'S', 'C', 'V'];
const Privacy = () => {
  const f = useCurrentFrame();
  const lit = interpolate(f, [lb(1), lb(2)], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Paper night={1} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 70 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          {ROW.map((k, i) => {
            const on = k === 'Ctrl' || k === '⌘' || k === 'C';
            const s = spring({ frame: f - i * 2, fps: 30, config: { damping: 20 } });
            return <div key={k} style={{ opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}><Keycap label={k} w={k.length > 1 ? 110 : 84} h={80} glow={on ? lit : 0} dim={on ? 0 : lit} /></div>;
          })}
        </div>
        <div style={{ textAlign: 'center' }}>
          <Kinetic words={['Tuck', 'sees', 'only', { t: 'Ctrl/⌘', color: '#f2b98f' }, 'and', { t: 'C.', color: '#f2b98f' }]} start={lb(1.5)} every={3} size={78} color="#f4f1ea" />
          <div style={{ height: 14 }} />
          <Kinetic words={['Nothing', 'leaves', 'your', 'computer.']} start={lb(4.2)} every={3} size={46} weight={500} color="rgba(244,241,234,.7)" />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- 7. mac ----------
const Combo = ({ os, mod, f, beta }) => {
  const m = interpolate(f, [lb(3) - 3, lb(3), lb(4.6), lb(4.6) + 3], [0, 1, 1, 0], clamp);
  const c = Math.max(press(f, lb(3.5)), press(f, lb(4.2)));
  return (
    <div style={{ width: 520, padding: '34px 0 40px', borderRadius: 28, background: C.card, border: `1px solid ${C.line}`, boxShadow: '0 30px 70px rgba(60,40,20,.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
      <div style={{ fontFamily: UI, fontSize: 30, fontWeight: 600, color: C.ink2 }}>
        {os}{beta && <span style={{ marginLeft: 12, padding: '3px 12px', borderRadius: 999, background: C.accentSoft, color: C.accent, fontSize: 18, verticalAlign: 4 }}>beta</span>}
      </div>
      <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
        <Keycap label={mod} w={150} down={m} glow={m} />
        <span style={{ fontFamily: UI, fontSize: 40, color: C.ink3 }}>+</span>
        <Keycap label="C" down={c} glow={c} />
      </div>
    </div>
  );
};
const MenuBar = ({ f }) => {
  const s = spring({ frame: f - lb(0.5), fps: 30, config: { damping: 200 } });
  const pulse = interpolate(f, [lb(4.4), lb(4.7), lb(5.8)], [0, 1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 52, transform: `translateY(${(s - 1) * 52}px)`, background: 'rgba(255,253,248,.72)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', padding: '0 30px', gap: 34, fontFamily: UI, fontSize: 21, color: C.ink }}>
      <span style={{ fontSize: 26 }}>●</span><span style={{ fontWeight: 700 }}>Safari</span><span>File</span><span>Edit</span><span>View</span>
      <span style={{ flex: 1 }} />
      <span style={{ width: 40, height: 34, borderRadius: 8, display: 'grid', placeItems: 'center', background: `rgba(180,83,42,${pulse * 0.16})`, boxShadow: `0 0 ${pulse * 26}px rgba(217,138,78,${pulse * 0.7})` }}>
        <svg width="24" height="20" viewBox="0 0 24 20" fill={pulse > 0.2 ? C.accent : C.ink}><path d="M5 2C2.5 3.6 1 6.4 1 10v8h8v-8H5c0-2.4.9-4.2 2.6-5.4zM17 2c-2.5 1.6-4 4.4-4 8v8h8v-8h-4c0-2.4.9-4.2 2.6-5.4z" /></svg>
      </span>
      <span>Fri 10:42</span>
    </div>
  );
};
const Mac = () => {
  const f = useCurrentFrame();
  const cards = spring({ frame: f - lb(1.2), fps: 30, config: { damping: 20 } });
  return (
    <AbsoluteFill>
      <MenuBar f={f} />
      <div style={{ position: 'absolute', top: 190, left: 0, right: 0, textAlign: 'center' }}>
        <Kinetic words={['Now', 'on', { t: 'Mac,', color: C.accent }, 'too.']} start={lb(0.8)} every={4} size={84} />
      </div>
      <div style={{ position: 'absolute', top: 400, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 60, opacity: cards, transform: `translateY(${(1 - cards) * 50}px)` }}>
        <Combo os="Windows" mod="Ctrl" f={f} />
        <Combo os="macOS" mod="⌘" f={f} beta />
      </div>
      <div style={{ position: 'absolute', top: 820, left: 0, right: 0, textAlign: 'center', fontFamily: UI, fontSize: 30, color: C.ink3, opacity: interpolate(f, [lb(5.5), lb(6.2)], [0, 1], clamp) }}>
        Same double-tap. Same hold. Same Markdown notebook.
      </div>
    </AbsoluteFill>
  );
};

// ---------- 8. end card ----------
const End = () => {
  const f = useCurrentFrame();
  const m = spring({ frame: f, fps: 30, config: { damping: 12, stiffness: 120 } });
  const foot = interpolate(f, [lb(4.5), lb(5.2)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      <div style={{ transform: `scale(${m}) rotate(${(1 - m) * -12}deg)` }}><Mark size={170} /></div>
      <div style={{ height: 34 }} />
      <Kinetic words={['Tuck']} start={lb(1)} size={120} weight={700} />
      <div style={{ height: 6 }} />
      <Kinetic words={['Tuck', 'away', 'the', 'lines', 'worth', 'keeping.']} start={lb(2.2)} every={3} size={44} weight={500} color={C.ink2} font={READ} />
      <div style={{ marginTop: 56, display: 'flex', gap: 18, opacity: foot, transform: `translateY(${(1 - foot) * 16}px)`, fontFamily: UI, fontSize: 26 }}>
        <span style={{ padding: '14px 30px', borderRadius: 999, background: C.accent, color: '#fff8ef', fontWeight: 600 }}>Free for Windows &amp; macOS</span>
        <span style={{ padding: '14px 30px', borderRadius: 999, border: `1.5px solid ${C.line}`, color: C.ink2, background: C.card }}>github.com/BayarBH/tuck</span>
      </div>
    </AbsoluteFill>
  );
};

export const Launch = ({ music }) => {
  const { durationInFrames } = useVideoConfig();
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Paper />
      <Scene name="hook" fadeIn={0}><Hook /></Scene>
      <Scene name="gone"><Gone /></Scene>
      <Scene name="double"><DoubleTap /></Scene>
      <Scene name="hold"><Hold /></Scene>
      <Scene name="book"><Book /></Scene>
      <Scene name="privacy" fadeIn={4}><Privacy /></Scene>
      <Scene name="mac"><Mac /></Scene>
      <Scene name="end" fadeOut={0}><End /></Scene>
      {music && <Audio src={staticFile('music.mp3')} startFrom={music.startFrom || 0} volume={(fr) => interpolate(fr, [0, 8, durationInFrames - 24, durationInFrames], [0, 1, 1, 0], clamp)} />}
      <AbsoluteFill style={{ background: '#000', opacity: interpolate(f, [durationInFrames - 12, durationInFrames], [0, 0], clamp), pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};
