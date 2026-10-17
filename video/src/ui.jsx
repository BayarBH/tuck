import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { C, UI, READ } from './theme';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
export const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

export const useSpring = (from, cfg = {}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - from, fps, config: { damping: 200, ...cfg } });
};

// ---------- headline that reveals word by word ----------
export const Kinetic = ({ words, start, every = 4, size = 92, weight = 650, color = C.ink, align = 'center', font = UI, out = null, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeOut = out == null ? 1 : interpolate(frame, [out, out + 8], [1, 0], clamp);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', gap: `0 ${size * 0.26}px`, fontFamily: font, fontSize: size, fontWeight: weight, letterSpacing: -size * 0.025, lineHeight: 1.12, color, opacity: fadeOut, ...style }}>
      {words.map((w, i) => {
        const s = spring({ frame: frame - start - i * every, fps, config: { damping: 18, stiffness: 160, mass: 0.7 } });
        const o = interpolate(frame - start - i * every, [0, 6], [0, 1], clamp);
        const blur = interpolate(s, [0, 1], [10, 0]);
        return (
          <span key={i} style={{ display: 'inline-block', opacity: o, transform: `translateY(${(1 - s) * size * 0.45}px)`, filter: `blur(${blur}px)`, color: typeof w === 'object' ? w.color : undefined }}>
            {typeof w === 'object' ? w.t : w}
          </span>
        );
      })}
    </div>
  );
};

// ---------- keycap ----------
export const Keycap = ({ label, down = 0, glow = 0, w = 116, h = 96, dim = 0 }) => (
  <div style={{ position: 'relative', width: w, height: h + 10 }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 10, height: h, borderRadius: 18, background: '#d8cfc1' }} />
    <div style={{
      position: 'absolute', left: 0, right: 0, top: down * 8, height: h, borderRadius: 18,
      background: glow > 0 ? `color-mix(in srgb, ${C.card} ${100 - glow * 22}%, ${C.accent2})` : C.card,
      border: `2px solid ${glow > 0 ? `rgba(180,83,42,${0.25 + glow * 0.55})` : 'rgba(60,45,25,.14)'}`,
      boxShadow: glow > 0 ? `0 0 ${40 * glow}px rgba(217,138,78,${0.55 * glow})` : '0 2px 0 rgba(255,255,255,.8) inset',
      display: 'grid', placeItems: 'center', fontFamily: UI, fontWeight: 600, fontSize: h * 0.32,
      color: glow > 0.3 ? C.accent : C.ink2, opacity: 1 - dim * 0.65,
    }}>{label}</div>
  </div>
);

// ---------- Windows-style arrow cursor ----------
export const Cursor = ({ x, y, scale = 1, opacity = 1, text = false }) => (
  <svg width={28 * scale} height={36 * scale} viewBox="0 0 28 36" style={{ position: 'absolute', left: x, top: y, opacity, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))', zIndex: 50 }}>
    {text
      ? <path d="M9 3h10M9 33h10M14 3v30" stroke="#111" strokeWidth="3" fill="none" />
      : <path d="M2 2 L2 28 L9 21 L14 33 L19 31 L14 19 L24 19 Z" fill="#fff" stroke="#111" strokeWidth="2" strokeLinejoin="round" />}
  </svg>
);

// ---------- the Tuck mark ----------
export const Mark = ({ size = 120, radius = 0.29 }) => (
  <div style={{ width: size, height: size, borderRadius: size * radius, background: `linear-gradient(145deg, ${C.accent}, ${C.accent2})`, display: 'grid', placeItems: 'center', boxShadow: `0 ${size * 0.12}px ${size * 0.35}px rgba(180,83,42,.28)` }}>
    <span style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: size * 0.78, lineHeight: 1, color: '#fff8ef', paddingTop: size * 0.32 }}>“</span>
  </div>
);

// ---------- article window with a selectable sentence ----------
export const Article = ({ title, before, target, after, select = 0, source = 'medium.com' }) => (
  <div style={{ width: 1180, borderRadius: 22, background: C.card, boxShadow: '0 40px 90px rgba(60,40,20,.16), 0 2px 6px rgba(60,40,20,.06)', overflow: 'hidden', border: `1px solid ${C.line}` }}>
    <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px', background: '#f1ece3', borderBottom: `1px solid ${C.line}` }}>
      {['#e8806b', '#e9b85c', '#8cc276'].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c, opacity: 0.85 }} />)}
      <div style={{ marginLeft: 18, padding: '6px 18px', borderRadius: 10, background: C.card, fontFamily: UI, fontSize: 17, color: C.ink3 }}>{source}</div>
    </div>
    <div style={{ padding: '46px 72px 56px' }}>
      <div style={{ fontFamily: UI, fontSize: 18, letterSpacing: 2, textTransform: 'uppercase', color: C.accent, fontWeight: 600, marginBottom: 14 }}>Essay</div>
      <div style={{ fontFamily: READ, fontSize: 46, lineHeight: 1.15, color: C.ink, marginBottom: 28 }}>{title}</div>
      <p style={{ fontFamily: READ, fontSize: 29, lineHeight: 1.7, color: C.ink2, margin: 0 }}>
        {before}{' '}
        <span style={{ color: C.ink, background: `linear-gradient(90deg, ${C.select} ${select * 100}%, transparent ${select * 100}%)` }}>{target}</span>
        {' '}{after}
      </p>
    </div>
  </div>
);

// ---------- the bottom bar + capsule (overlay.css) ----------
export const Capsule = ({ text, x, y, scale = 1, opacity = 1 }) => (
  <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${scale})`, opacity, padding: '12px 26px', borderRadius: 999, background: C.barBg, border: '1px solid rgba(255,255,255,.16)', boxShadow: '0 16px 40px rgba(0,0,0,.30)', color: '#f4f1ea', fontFamily: UI, fontSize: 26, whiteSpace: 'nowrap', zIndex: 40 }}>{text}</div>
);

export const Bar = ({ show = 0, pulse = 0, saved = 0, expand = 0, typed = '', caret = true, bottom = 72 }) => {
  const w = interpolate(expand, [0, 1], [460, 860]);
  const h = interpolate(expand, [0, 1], [62, 132]);
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom, width: w, height: h, transform: `translateX(-50%) scale(${(0.86 + 0.14 * show) * (1 + pulse * 0.07)})`,
      opacity: show, borderRadius: interpolate(expand, [0, 1], [999, 28]), background: C.barBg, backdropFilter: 'blur(18px)',
      border: `1.5px solid ${pulse > 0 ? `rgba(140,190,255,${0.2 + pulse * 0.5})` : 'rgba(255,255,255,.14)'}`,
      boxShadow: `0 18px 50px rgba(0,0,0,.28), 0 0 ${pulse * 46}px ${pulse * 8}px rgba(140,190,255,${pulse * 0.45})`,
      display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 34px', fontFamily: UI, color: '#f4f1ea', zIndex: 30, overflow: 'hidden',
    }}>
      {expand < 0.5 ? (
        <div style={{ textAlign: 'center', fontSize: 25, opacity: saved, letterSpacing: 0.3 }}>✓ Saved</div>
      ) : (
        <div style={{ opacity: interpolate(expand, [0.5, 1], [0, 1]) }}>
          <div style={{ fontSize: 30, lineHeight: 1.4, minHeight: 42 }}>
            {typed ? renderTags(typed) : <span style={{ color: 'rgba(244,241,234,.45)' }}>Add a thought… (#tags ok)</span>}
            {caret && <span style={{ display: 'inline-block', width: 3, height: 34, marginLeft: 3, background: '#f4f1ea', verticalAlign: -6 }} />}
          </div>
          <div style={{ marginTop: 10, fontSize: 17, color: 'rgba(244,241,234,.45)' }}>Enter save · Esc cancel · Shift+Enter newline</div>
        </div>
      )}
    </div>
  );
};

const renderTags = (s) => s.split(/(#[\p{L}\p{N}_]+)/u).map((p, i) => (p.startsWith('#') ? <span key={i} style={{ color: '#f2b98f' }}>{p}</span> : p));

// ---------- notebook (notebook.css) ----------
export const NoteCard = ({ quote, thought, time, app, tags = [], fresh = 0, style }) => (
  <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: '24px 28px 18px', boxShadow: `0 0 0 ${fresh * 4}px rgba(180,83,42,${fresh * 0.18}), 0 1px 2px rgba(60,40,20,.05), 0 8px 24px rgba(60,40,20,.06)`, ...style }}>
    <div style={{ borderLeft: `3px solid ${C.rule}`, paddingLeft: 18, fontFamily: READ, fontSize: 24, lineHeight: 1.6, color: C.ink }}>{quote}</div>
    {thought && (
      <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: C.accentSoft }}>
        <div style={{ fontFamily: UI, fontSize: 13, fontWeight: 600, letterSpacing: 0.8, color: C.accent, marginBottom: 4 }}>MY THOUGHT</div>
        <div style={{ fontFamily: UI, fontSize: 19, color: C.ink }}>
          {thought}{tags.map((t) => <span key={t} style={{ marginLeft: 8, padding: '2px 10px', borderRadius: 999, background: C.card, color: C.accent, fontWeight: 600, fontSize: 16 }}>{t}</span>)}
        </div>
      </div>
    )}
    <div style={{ marginTop: 14, fontFamily: UI, fontSize: 15, color: C.ink3 }}>{time} · {app}</div>
  </div>
);

export const Notebook = ({ children, activeTag = null, count = 128, tagPulse = 0 }) => {
  const tags = [['#writing', 14], ['#product', 11], ['#ai_safety', 9], ['#attention', 6]];
  return (
    <div style={{ width: 1400, height: 860, display: 'flex', borderRadius: 24, overflow: 'hidden', background: C.bg, boxShadow: '0 60px 120px rgba(60,40,20,.22), 0 2px 8px rgba(60,40,20,.08)', border: `1px solid ${C.line}` }}>
      <div style={{ width: 300, background: C.side, borderRight: `1px solid ${C.line}`, padding: '30px 20px', fontFamily: UI }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26 }}>
          <Mark size={44} />
          <div><div style={{ fontSize: 22, fontWeight: 600, color: C.ink }}>Tuck</div><div style={{ fontSize: 15, color: C.ink3 }}>{count} notes</div></div>
        </div>
        <div style={{ padding: '12px 16px', borderRadius: 12, background: C.card, border: `1px solid ${C.line}`, color: C.ink3, fontSize: 17, marginBottom: 22 }}>Search notes</div>
        {[['All notes', count], ['This week', 12]].map(([n, k], i) => (
          <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, fontSize: 18, background: i === 0 && !activeTag ? C.accentSoft : 'transparent', color: i === 0 && !activeTag ? C.accent : C.ink2, fontWeight: i === 0 && !activeTag ? 600 : 400 }}><span>{n}</span><span style={{ fontSize: 15, opacity: 0.8 }}>{k}</span></div>
        ))}
        <div style={{ margin: '24px 14px 8px', fontSize: 13, fontWeight: 600, letterSpacing: 1, color: C.ink3 }}>TAGS</div>
        {tags.map(([t, k]) => {
          const on = activeTag === t;
          return <div key={t} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, fontSize: 18, background: on ? C.accentSoft : 'transparent', color: on ? C.accent : C.ink2, fontWeight: on ? 600 : 400, transform: on ? `scale(${1 + tagPulse * 0.04})` : 'none' }}><span>{t}</span><span style={{ fontSize: 15, opacity: 0.8 }}>{k}</span></div>;
        })}
      </div>
      <div style={{ flex: 1, padding: '34px 52px', overflow: 'hidden', position: 'relative' }}>{children}</div>
    </div>
  );
};
