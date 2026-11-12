// «Голос и графика», горизонталь 16:9 — образец.
// По референсам: тёмный фон, тонкая светящаяся линейная графика (созвездия, контурные фигуры),
// картинка БУКВАЛЬНО рисует каждую фразу и меняется каждые 2–3 с, сверху постоянный «якорь» —
// золотой портал; субтитры внизу (серые, сказанное — светлое, ключевое — золотом).
// Цвета — тёмная тема «Вечер» «Тёплого света» + золото. Время — по номерам слов: w(н).
import '../fonts';
import {Sfx} from '../sfx';
import React, {useMemo} from 'react';
import {AbsoluteFill, Html5Audio, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import type {Phrase} from '../types';

type WordT = {н: number; начало: number; конец: number};
export type KosmosProps = {audio: string; words: WordT[]; phrases: Phrase[]; length: number; tail: number};

const FPS = 30;
const W = 1920, H = 1080, CX = 960, CY = 500;
const C = {
  bg: '#17120F', bg2: '#2A221D', line: '#EADBC2', dim: 'rgba(234,219,194,0.35)', gold: '#E6C27C', gold2: '#F6D894',
  muted: '#8F8172', white: '#F7F2EA', glow: 'rgba(230,194,124,0.55)',
};
const MAIN = 'Onest, sans-serif';
const ACCENT = '"Playfair Display", serif';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const sec = (s: number) => Math.round(s * FPS);
const useT = () => useCurrentFrame() / FPS;
const ramp = (t: number, a: number, d: number, e = Easing.out(Easing.cubic)) => interpolate(t, [a, a + d], [0, 1], {...clamp, easing: e});

const WordsCtx = React.createContext<Record<number, WordT>>({});
const useW = () => {
  const m = React.useContext(WordsCtx);
  return (n: number, end = false) => {
    for (let k = n; k < n + 40; k++) if (m[k]) return end ? m[k].конец : m[k].начало;
    return 0;
  };
};

// ---------- примитивы ----------
const Defs: React.FC = () => (
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <filter id="glow2" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="14" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <radialGradient id="light"><stop offset="0" stopColor="#FFF6DC" /><stop offset="0.35" stopColor={C.gold2} stopOpacity="0.8" /><stop offset="1" stopColor={C.gold} stopOpacity="0" /></radialGradient>
  </defs>
);
/** Линия, которая прорисовывается от 0 до 1. */
const Ln: React.FC<{d: string; p: number; c?: string; w?: number; glow?: boolean; o?: number}> = ({d, p, c = C.line, w = 2.5, glow = true, o = 1}) => (
  <path d={d} pathLength={1} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray={1} strokeDashoffset={1 - Math.max(0, Math.min(1, p))} opacity={o} filter={glow ? 'url(#glow)' : undefined} />
);
/** Звезда: точка с ореолом, мерцает. */
const Star: React.FC<{x: number; y: number; p: number; r?: number; c?: string; seed?: number}> = ({x, y, p, r = 5, c = C.white, seed = 0}) => {
  const t = useT();
  const tw = 0.75 + 0.25 * Math.sin(t * 3 + seed * 1.7);
  if (p <= 0) return null;
  return (
    <g opacity={Math.min(1, p * 1.5)}>
      <circle cx={x} cy={y} r={r * 3.2 * p} fill={C.glow} opacity={0.35 * tw} />
      <circle cx={x} cy={y} r={r * p} fill={c} filter="url(#glow)" />
    </g>
  );
};
type Pt = [number, number];
/** Созвездие: звёзды загораются по очереди, линии тянутся между ними. */
const Constellation: React.FC<{pts: Pt[]; edges: [number, number][]; at: number; dur?: number; c?: string; r?: number}> = ({pts, edges, at, dur = 1.2, c, r = 5}) => {
  const t = useT();
  const step = dur / Math.max(1, pts.length);
  return (
    <g>
      {edges.map(([a, b], i) => {
        const s = at + Math.max(a, b) * step;
        return <Ln key={i} d={`M ${pts[a][0]} ${pts[a][1]} L ${pts[b][0]} ${pts[b][1]}`} p={ramp(t, s, step * 1.5)} c={c ?? C.dim} w={2} glow={false} />;
      })}
      {pts.map(([x, y], i) => <Star key={i} x={x} y={y} p={ramp(t, at + i * step, 0.25)} r={r} c={c ? C.gold2 : C.white} seed={i} />)}
    </g>
  );
};
/** Цифры-созвездия: «1» и «0». */
const digit = (ch: string, x: number, y: number, h: number): {pts: Pt[]; edges: [number, number][]} => {
  if (ch === '1') return {pts: [[x - h * 0.16, y + h * 0.16], [x, y], [x, y + h * 0.5], [x, y + h]], edges: [[0, 1], [1, 2], [2, 3]]};
  const pts: Pt[] = [];
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI * 2;
    pts.push([x + Math.cos(a) * h * 0.3, y + h / 2 + Math.sin(a) * h * 0.5]);
  }
  return {pts, edges: pts.map((_, i) => [i, (i + 1) % 8] as [number, number])};
};
const Num: React.FC<{text: string; at: number; h: number; gap: number; y?: number; c?: string}> = ({text, at, h, gap, y = CY - h / 2, c}) => {
  const chars = text.split('');
  const total = (chars.length - 1) * gap;
  return (
    <g>
      {chars.map((ch, i) => {
        const x = CX - total / 2 + i * gap;
        if (ch === '.' || ch === '/') return <Ln key={i} d={`M ${x + h * 0.08} ${y + h * 0.05} L ${x - h * 0.08} ${y + h * 0.95}`} p={ramp(useT(), at + i * 0.25, 0.4)} c={C.dim} glow={false} />;
        const d = digit(ch, x, y, h);
        return <Constellation key={i} pts={d.pts} edges={d.edges} at={at + i * 0.25} dur={0.7} c={c} />;
      })}
    </g>
  );
};
/** Фигурка-контур: голова и тело одной линией. */
const figurePath = (x: number, y: number, s: number, arms: 'down' | 'up' = 'down') => {
  const head = `M ${x} ${y - s * 0.86} m -${s * 0.09} 0 a ${s * 0.09} ${s * 0.09} 0 1 0 ${s * 0.18} 0 a ${s * 0.09} ${s * 0.09} 0 1 0 -${s * 0.18} 0`;
  const body = `M ${x} ${y - s * 0.76} L ${x} ${y - s * 0.38} M ${x} ${y - s * 0.38} L ${x - s * 0.12} ${y} M ${x} ${y - s * 0.38} L ${x + s * 0.12} ${y}`;
  const a = arms === 'up'
    ? `M ${x} ${y - s * 0.66} L ${x - s * 0.2} ${y - s * 0.98} M ${x} ${y - s * 0.66} L ${x + s * 0.2} ${y - s * 0.98}`
    : `M ${x} ${y - s * 0.66} L ${x - s * 0.15} ${y - s * 0.4} M ${x} ${y - s * 0.66} L ${x + s * 0.15} ${y - s * 0.4}`;
  return `${head} ${body} ${a}`;
};
/** Подпись мелкими заглавными с разрядкой (как в референсах). */
const Label: React.FC<{x: number; y: number; at: number; children: React.ReactNode; c?: string; size?: number}> = ({x, y, at, children, c = C.gold, size = 26}) => {
  const p = ramp(useT(), at, 0.4);
  return <text x={x} y={y} textAnchor="middle" fill={c} opacity={p} style={{fontFamily: MAIN, fontWeight: 500, fontSize: size, letterSpacing: '0.24em'}}>{children}</text>;
};

/** Кадр-сцена: быстро проявляется (масштаб + размытие), уходит перед следующей. */
const Shot: React.FC<{from: number; to: number; children: React.ReactNode}> = ({from, to, children}) => {
  const t = useT();
  if (t < from - 0.05 || t > to + 0.3) return null;
  const i = ramp(t, from, 0.35);
  const o = interpolate(t, [to - 0.05, to + 0.25], [0, 1], clamp);
  const drift = interpolate(t, [from, to], [1, 1.035], clamp);   // медленный наезд, как камера
  return (
    <AbsoluteFill style={{opacity: i * (1 - o), transform: `scale(${(1.06 - 0.06 * i) * drift - o * 0.03})`, filter: i < 1 || o > 0 ? `blur(${(1 - i) * 10 + o * 10}px)` : undefined}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{overflow: 'visible'}}><Defs />{children}</svg>
    </AbsoluteFill>
  );
};

// ---------- фон и якорь ----------
const Background: React.FC = () => {
  const t = useT();
  const stars = useMemo(() => Array.from({length: 120}, (_, i) => {
    const r1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1, r2 = Math.abs(Math.sin(i * 78.233) * 12543.21) % 1;
    return [r1 * W, r2 * H, 0.6 + ((i * 7) % 10) / 10] as [number, number, number];
  }), []);
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 45%, ${C.bg2} 0%, ${C.bg} 70%)`}}>
      <svg width={W} height={H}>
        {stars.map(([x, y, s], i) => <circle key={i} cx={x} cy={y} r={s} fill={C.white} opacity={0.12 + 0.18 * (0.5 + 0.5 * Math.sin(t * (0.6 + s) + i))} />)}
      </svg>
    </AbsoluteFill>
  );
};
/** Якорь: золотой портал сверху — весь ролик, вращается, пульсирует на каждой смене кадра. */
const Anchor: React.FC<{beats: number[]}> = ({beats}) => {
  const t = useT();
  const last = beats.filter((b) => b <= t).pop() ?? -9;
  const pulse = 1 + 0.18 * Math.exp(-(t - last) * 5);
  const a = ramp(t, 0, 0.8);
  return (
    <AbsoluteFill style={{opacity: a}}>
      <svg width={W} height={H}>
        <Defs />
        <g transform={`translate(${CX} 92) scale(${pulse})`}>
          <circle r={70} fill="url(#light)" opacity={0.5} />
          <circle r={44} fill="none" stroke={C.gold} strokeWidth={2} strokeDasharray="6 10" transform={`rotate(${t * 25})`} opacity={0.8} />
          <circle r={32} fill="none" stroke={C.gold2} strokeWidth={1.5} strokeDasharray="30 12" transform={`rotate(${-t * 40})`} opacity={0.9} />
          <circle r={14} fill={C.gold2} filter="url(#glow2)" />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

// ---------- субтитры: серые, сказанное — светлое, ключевое слово — золотом ----------
const Subs: React.FC<{phrases: Phrase[]}> = ({phrases}) => {
  const t = useT();
  const p = phrases.find((x, i) => {
    const s = x.слова[0].начало, e = x.слова[x.слова.length - 1].конец;
    const next = phrases[i + 1]?.слова[0].начало ?? Infinity;
    return s - 0.05 <= t && t < Math.min(next, e + 0.5);
  });
  if (!p) return null;
  const a = ramp(t, p.слова[0].начало - 0.05, 0.18);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 940, textAlign: 'center', fontFamily: MAIN, fontWeight: 500, fontSize: 46,
      opacity: a, transform: `translateY(${(1 - a) * 8}px)`, letterSpacing: '0.01em'}}>
      {p.слова.map((w, i) => {
        const key = w.н === p.ключ, said = w.начало <= t;
        return <React.Fragment key={w.н}>{i ? ' ' : ''}<span style={key
          ? {fontFamily: ACCENT, fontStyle: 'italic', fontSize: 54, color: said ? C.gold2 : 'rgba(246,216,148,0.45)'}
          : {color: said ? C.white : C.muted, fontWeight: said ? 600 : 500}}>{w.т}</span></React.Fragment>;
      })}
    </div>
  );
};

// ---------- сцены по фразам ----------
const Scenes: React.FC<{length: number; beats: number[]}> = ({length, beats}) => {
  const w = useW();
  const t = useT();
  const b = (i: number) => beats[i];
  const end = (i: number) => (i + 1 < beats.length ? beats[i + 1] : length);
  return (
    <>
      {/* 0 вспышка: лучи из центра, ядро света */}
      <Shot from={b(0)} to={end(0)}>
        {Array.from({length: 28}, (_, i) => {
          const a = (i / 28) * Math.PI * 2, r1 = 60, r2 = 180 + (i % 3) * 90;
          const p = ramp(t, b(0) + 0.1 + (i % 5) * 0.05, 0.6);
          return <Ln key={i} d={`M ${CX + Math.cos(a) * r1} ${CY + Math.sin(a) * r1} L ${CX + Math.cos(a) * (r1 + (r2 - r1) * p)} ${CY + Math.sin(a) * (r1 + (r2 - r1) * p)}`} p={1} c={i % 2 ? C.gold : C.dim} w={2} glow={false} />;
        })}
        <circle cx={CX} cy={CY} r={40 + 10 * Math.sin(t * 4)} fill="url(#light)" />
        <circle cx={CX} cy={CY} r={18} fill={C.gold2} filter="url(#glow2)" />
      </Shot>

      {/* 1 кольцо загрузки наполняется, в него падают искры */}
      <Shot from={b(1)} to={end(1)}>
        <circle cx={CX} cy={CY} r={190} fill="none" stroke={C.dim} strokeWidth={3} />
        <Ln d={`M ${CX} ${CY - 190} A 190 190 0 1 1 ${CX - 0.1} ${CY - 190}`} p={ramp(t, b(1), end(1) - b(1), Easing.inOut(Easing.cubic))} c={C.gold} w={6} />
        {Array.from({length: 14}, (_, i) => {
          const x = CX - 150 + ((i * 53) % 300), life = ((t - b(1)) * 0.9 + i * 0.13) % 1;
          return <circle key={i} cx={x} cy={CY - 420 + life * 380} r={3} fill={C.gold2} opacity={Math.sin(life * Math.PI)} filter="url(#glow)" />;
        })}
        <text x={CX} y={CY + 22} textAnchor="middle" fill={C.white} style={{fontFamily: MAIN, fontWeight: 600, fontSize: 64}}>
          {Math.round(ramp(t, b(1), end(1) - b(1), Easing.inOut(Easing.cubic)) * 100)}%
        </text>
        <Label x={CX} y={CY + 260} at={w(217)}>КРАЙНЕ РЕДКО</Label>
      </Shot>

      {/* 2 «100» складывается созвездием */}
      <Shot from={b(2)} to={end(2)}>
        <Label x={CX} y={CY - 210} at={b(2)}>РАЗ В</Label>
        <Num text="100" at={w(224)} h={300} gap={260} />
        <Label x={CX} y={CY + 230} at={w(226)}>ЛЕТ</Label>
      </Shot>

      {/* 3 глаз открывается */}
      <Shot from={b(3)} to={end(3)}>
        {(() => {
          const o = ramp(t, w(391) - 0.2, 0.7, Easing.inOut(Easing.cubic));
          const up = CY - 150 * o;
          return (
            <g>
              <Ln d={`M ${CX - 330} ${CY} Q ${CX} ${up - 30 * o} ${CX + 330} ${CY}`} p={ramp(t, b(3), 0.8)} w={3} />
              <Ln d={`M ${CX - 330} ${CY} Q ${CX} ${CY + 150} ${CX + 330} ${CY}`} p={ramp(t, b(3), 0.8)} w={3} />
              {Array.from({length: 9}, (_, i) => {
                const k = (i + 1) / 10, x = CX - 330 + 660 * k, y = CY - (CY - up + 30 * o) * 4 * k * (1 - k) * 0.5 - (1 - o) * 0;
                return <Ln key={i} d={`M ${x} ${y} L ${x + (k - 0.5) * 30} ${y - 30 - 10 * o}`} p={ramp(t, b(3) + 0.5, 0.4)} w={2} c={C.dim} glow={false} />;
              })}
              <g opacity={o}>
                <circle cx={CX} cy={CY - 10} r={95 * o} fill="none" stroke={C.gold} strokeWidth={3} filter="url(#glow)" />
                <circle cx={CX} cy={CY - 10} r={60 * o} fill="none" stroke={C.dim} strokeWidth={2} strokeDasharray="4 6" transform={`rotate(${t * 20} ${CX} ${CY - 10})`} />
                <circle cx={CX} cy={CY - 10} r={30 * o} fill="url(#light)" />
              </g>
            </g>
          );
        })()}
        <Label x={CX} y={CY + 250} at={w(391)}>ПРОСНУТЬСЯ</Label>
      </Shot>

      {/* 4 сетка дней, загорается один */}
      <Shot from={b(4)} to={end(4)}>
        {Array.from({length: 7 * 17}, (_, i) => {
          const cx = CX - 640 + (i % 17) * 80, cy = CY - 240 + Math.floor(i / 17) * 80;
          const lit = i === 59;
          const p = ramp(t, b(4) + (i % 17) * 0.02, 0.3);
          const g = lit ? ramp(t, w(397), 0.5) : 0;
          return <circle key={i} cx={cx} cy={cy} r={lit ? 6 + 12 * g : 5} fill={lit && g > 0 ? C.gold2 : C.dim} opacity={p} filter={lit ? 'url(#glow2)' : undefined} />;
        })}
      </Shot>

      {/* 5 три планеты выстраиваются в линию */}
      <Shot from={b(5)} to={end(5)}>
        {[-1, 0, 1].map((k) => {
          const al = ramp(t, b(5) + 0.4, end(5) - b(5) - 0.6, Easing.inOut(Easing.cubic));
          const x = CX + k * 330, y = CY + (k === 0 ? 0 : k * 120 * (1 - al)) + (k === 0 ? 0 : -60 * (1 - al));
          return (
            <g key={k}>
              <ellipse cx={CX} cy={CY} rx={Math.abs(k) * 330 || 1} ry={Math.abs(k) * 90 || 1} fill="none" stroke={C.dim} strokeWidth={1.5} opacity={0.5} />
              <circle cx={x} cy={y} r={k === 0 ? 46 : 26} fill="none" stroke={k === 0 ? C.gold : C.line} strokeWidth={3} filter="url(#glow)" />
            </g>
          );
        })}
        <Ln d={`M ${CX - 420} ${CY} L ${CX + 420} ${CY}`} p={ramp(t, end(5) - 0.6, 0.5)} c={C.gold} w={2} />
      </Shot>

      {/* 6 фигура, в груди загорается свет */}
      <Shot from={b(6)} to={end(6)}>
        <Ln d={figurePath(CX, CY + 260, 520)} p={ramp(t, b(6), 1)} w={3} />
        <circle cx={CX} cy={CY + 260 - 520 * 0.6} r={10 + 26 * ramp(t, w(409), 0.6)} fill="url(#light)" filter="url(#glow2)" />
        {Array.from({length: 16}, (_, i) => {
          const a = (i / 16) * Math.PI * 2, p = ramp(t, w(410), 0.6), cx = CX, cy = CY + 260 - 520 * 0.6;
          return <Ln key={i} d={`M ${cx + Math.cos(a) * 60} ${cy + Math.sin(a) * 60} L ${cx + Math.cos(a) * (60 + 110 * p)} ${cy + Math.sin(a) * (60 + 110 * p)}`} p={1} c={C.gold} w={2} glow={false} o={p} />;
        })}
      </Shot>

      {/* 7 коридор уходит вдаль, в него входит фигурка */}
      <Shot from={b(7)} to={end(7)}>
        {[1, 0.7, 0.48, 0.32, 0.2].map((k, i) => (
          <rect key={i} x={CX - 520 * k} y={CY - 300 * k} width={1040 * k} height={600 * k} fill="none" stroke={i === 4 ? C.gold : C.dim} strokeWidth={2}
            opacity={ramp(t, b(7) + i * 0.12, 0.3)} rx={8} />
        ))}
        {[[-520, -300], [520, -300], [-520, 300], [520, 300]].map(([dx, dy], i) => (
          <Ln key={i} d={`M ${CX + dx} ${CY + dy} L ${CX + dx * 0.2} ${CY + dy * 0.2}`} p={ramp(t, b(7), 0.6)} c={C.dim} w={2} glow={false} />
        ))}
        <circle cx={CX} cy={CY} r={60 + 30 * Math.sin(t * 3)} fill="url(#light)" opacity={ramp(t, w(414), 0.5)} />
        {(() => {
          const k = 1 - 0.75 * ramp(t, b(7) + 0.4, end(7) - b(7), Easing.inOut(Easing.quad));
          return <Ln d={figurePath(CX, CY + 300 * k, 260 * k)} p={1} w={2.5} o={ramp(t, b(7) + 0.3, 0.3)} />;
        })()}
      </Shot>

      {/* 8 «11» созвездием */}
      <Shot from={b(8)} to={end(8)}>
        <Num text="11" at={w(447)} h={340} gap={180} />
      </Shot>

      {/* 9 «11.11» и подпись */}
      <Shot from={b(9)} to={end(9)}>
        <Num text="11.11" at={b(9)} h={300} gap={150} />
        <Label x={CX} y={CY + 250} at={w(453)}>НОЯБРЬ</Label>
        <Label x={CX} y={CY + 300} at={w(456)} c={C.muted} size={22}>11-Й МЕСЯЦ</Label>
      </Shot>

      {/* 10 ворота наполняются светом, перед ними фигурка */}
      <Shot from={b(10)} to={end(10)}>
        {(() => {
          const p = ramp(t, b(10), 0.9);
          const light = ramp(t, w(461), 0.9);
          return (
            <g>
              <rect x={CX - 190} y={CY - 260} width={380} height={520} fill="url(#light)" opacity={light * 0.9} />
              <Ln d={`M ${CX - 230} ${CY + 270} L ${CX - 230} ${CY - 260} L ${CX + 230} ${CY - 260} L ${CX + 230} ${CY + 270}`} p={p} c={C.gold} w={5} />
              <Ln d={`M ${CX - 280} ${CY - 300} L ${CX + 280} ${CY - 300}`} p={p} c={C.gold} w={5} />
              <text x={CX} y={CY - 312} textAnchor="middle" fill={C.gold2} opacity={p} style={{fontFamily: MAIN, fontWeight: 600, fontSize: 26}}>11 : 11</text>
              <Ln d={`M ${CX - 700} ${CY + 270} L ${CX + 700} ${CY + 270}`} p={p} c={C.dim} w={2} glow={false} />
              <Ln d={figurePath(CX, CY + 270, 210)} p={ramp(t, b(10) + 0.4, 0.6)} w={2.5} />
            </g>
          );
        })()}
      </Shot>

      {/* 11 небо со звёздами сверху, горы снизу */}
      <Shot from={b(11)} to={end(11)}>
        {Array.from({length: 18}, (_, i) => <Star key={i} x={CX - 520 + ((i * 97) % 1040)} y={CY - 330 + ((i * 53) % 150)} p={ramp(t, w(468) - 0.3 + i * 0.03, 0.3)} r={3 + (i % 3)} seed={i} />)}
        <Ln d={`M ${CX - 700} ${CY - 120} Q ${CX} ${CY - 240} ${CX + 700} ${CY - 120}`} p={ramp(t, w(467), 0.6)} c={C.gold} w={2} />
        <Ln d={`M ${CX - 700} ${CY + 230} L ${CX - 420} ${CY + 80} L ${CX - 240} ${CY + 170} L ${CX - 60} ${CY + 40} L ${CX + 160} ${CY + 180} L ${CX + 380} ${CY + 70} L ${CX + 700} ${CY + 230}`}
          p={ramp(t, w(469), 0.7)} w={2.5} />
        <Label x={CX} y={CY - 280} at={w(468)}>БОЖЕСТВЕННЫЙ</Label>
        <Label x={CX} y={CY + 300} at={w(470)} c={C.line}>ЗЕМНОЙ</Label>
      </Shot>

      {/* 12 два круга встают на одну вертикаль */}
      <Shot from={b(12)} to={end(12)}>
        {(() => {
          const al = ramp(t, b(12) + 0.2, 1.4, Easing.inOut(Easing.cubic));
          return (
            <g>
              <Ln d={`M ${CX} ${CY - 380} L ${CX} ${CY + 380}`} p={ramp(t, w(474), 0.8)} c={C.gold} w={3} />
              <circle cx={CX - 300 * (1 - al)} cy={CY - 190} r={90} fill="none" stroke={C.gold} strokeWidth={3} filter="url(#glow)" />
              <circle cx={CX - 300 * (1 - al)} cy={CY - 190} r={30} fill="url(#light)" />
              <circle cx={CX + 300 * (1 - al)} cy={CY + 190} r={90} fill="none" stroke={C.line} strokeWidth={3} filter="url(#glow)" />
              <Ln d={`M ${CX + 300 * (1 - al) - 90} ${CY + 190} L ${CX + 300 * (1 - al) + 90} ${CY + 190}`} p={1} c={C.dim} w={2} glow={false} />
            </g>
          );
        })()}
      </Shot>

      {/* 13 глаз сверху и его отражение в воде */}
      <Shot from={b(13)} to={end(13)}>
        {(() => {
          const eye = (y: number, s: number, o: number) => (
            <g opacity={o}>
              <path d={`M ${CX - 200} ${y} Q ${CX} ${y - 110 * s} ${CX + 200} ${y} Q ${CX} ${y + 110 * s} ${CX - 200} ${y}`} fill="none" stroke={C.gold} strokeWidth={3} filter="url(#glow)" />
              <circle cx={CX} cy={y} r={46} fill="none" stroke={C.gold2} strokeWidth={3} />
              <circle cx={CX} cy={y} r={16} fill={C.gold2} filter="url(#glow2)" />
            </g>
          );
          return (
            <g>
              {eye(CY - 200, 1, ramp(t, w(479), 0.5))}
              <Ln d={`M ${CX - 760} ${CY + 20} L ${CX + 760} ${CY + 20}`} p={ramp(t, w(484), 0.7)} c={C.line} w={2} />
              {[1, 2, 3].map((k) => <Ln key={k} d={`M ${CX - 300 + k * 40} ${CY + 20 + k * 22} L ${CX + 300 - k * 40} ${CY + 20 + k * 22}`} p={ramp(t, w(484) + 0.2 * k, 0.5)} c={C.dim} w={1.5} glow={false} />)}
              <g transform={`translate(0 ${2 * (CY + 20)}) scale(1 -1)`}>{eye(CY - 200, 1, 0.45 * ramp(t, w(485), 0.6))}</g>
            </g>
          );
        })()}
      </Shot>

      {/* 14 вращающийся глобус, луч вверх к звезде */}
      <Shot from={b(14)} to={end(14)}>
        {(() => {
          const r = 220, rot = (t * 0.6) % 1;
          return (
            <g>
              <circle cx={CX} cy={CY + 60} r={r} fill="none" stroke={C.line} strokeWidth={3} filter="url(#glow)" />
              {[0, 0.25, 0.5, 0.75].map((k, i) => {
                const ph = ((k + rot) % 1) * Math.PI, rx = Math.abs(Math.cos(ph)) * r;
                return <ellipse key={i} cx={CX} cy={CY + 60} rx={Math.max(2, rx)} ry={r} fill="none" stroke={C.dim} strokeWidth={1.5} />;
              })}
              {[-0.5, 0, 0.5].map((k, i) => <ellipse key={i} cx={CX} cy={CY + 60 + k * r} rx={r * Math.sqrt(1 - k * k)} ry={r * 0.12} fill="none" stroke={C.dim} strokeWidth={1.5} />)}
              <Ln d={`M ${CX} ${CY + 60 - r} L ${CX} ${CY - 380}`} p={ramp(t, w(491), 0.9)} c={C.gold} w={3} />
              <Star x={CX} y={CY - 390} p={ramp(t, w(494), 0.5)} r={12} c={C.gold2} />
            </g>
          );
        })()}
      </Shot>

      {/* 15 фигура с поднятыми руками, сверху её «высшее Я» созвездием */}
      <Shot from={b(15)} to={end(15)}>
        <Ln d={figurePath(CX, CY + 360, 360, 'up')} p={ramp(t, b(15), 0.8)} w={3} />
        <Constellation at={w(790)} dur={1.2} c={C.gold}
          pts={[[CX, CY - 400], [CX, CY - 330], [CX - 90, CY - 420], [CX + 90, CY - 420], [CX, CY - 220], [CX - 60, CY - 130], [CX + 60, CY - 130]]}
          edges={[[0, 1], [1, 2], [1, 3], [1, 4], [4, 5], [4, 6]]} />
        <Ln d={`M ${CX} ${CY + 360 - 360 * 0.98} L ${CX} ${CY - 130}`} p={ramp(t, w(792), 0.7)} c={C.gold} w={3} />
        <Label x={CX + 330} y={CY - 280} at={w(792)}>ВЫСШИЕ СИЛЫ</Label>
      </Shot>

      {/* 16 книга раскрывается, строки пишутся */}
      <Shot from={b(16)} to={end(16)}>
        {(() => {
          const o = ramp(t, w(798), 0.8, Easing.inOut(Easing.cubic));
          const page = (s: number) => {
            const x2 = CX + s * 360 * (0.3 + 0.7 * o);
            return `M ${CX} ${CY - 200} Q ${(CX + x2) / 2} ${CY - 240} ${x2} ${CY - 210} L ${x2} ${CY + 200} Q ${(CX + x2) / 2} ${CY + 170} ${CX} ${CY + 210} Z`;
          };
          return (
            <g>
              <circle cx={CX} cy={CY} r={300 * o} fill="url(#light)" opacity={0.35} />
              <Ln d={page(-1)} p={ramp(t, b(16), 0.8)} c={C.gold} w={3} />
              <Ln d={page(1)} p={ramp(t, b(16), 0.8)} c={C.gold} w={3} />
              {Array.from({length: 6}, (_, i) => [-1, 1].map((s) => (
                <Ln key={`${i}${s}`} d={`M ${CX + s * 50} ${CY - 130 + i * 52} L ${CX + s * (50 + 240 * o)} ${CY - 130 + i * 52}`}
                  p={ramp(t, w(800) + i * 0.15 + (s > 0 ? 0.5 : 0), 0.35)} c={C.dim} w={2} glow={false} />
              )))}
            </g>
          );
        })()}
        <Label x={CX} y={CY + 290} at={w(801)}>КНИГА ЖИЗНИ</Label>
      </Shot>

      {/* 17 книга уходит вверх, превращаясь в звёзды */}
      <Shot from={b(17)} to={end(17)}>
        {Array.from({length: 40}, (_, i) => {
          const a = (i / 40) * Math.PI * 2, d = 40 + ((i * 37) % 260) * ramp(t, b(17), 1.4);
          return <Star key={i} x={CX + Math.cos(a) * d * 1.6} y={CY - 60 + Math.sin(a) * d - 120 * ramp(t, b(17), 1.4)} p={ramp(t, b(17) + (i % 8) * 0.06, 0.4)} r={2 + (i % 3)} seed={i} />;
        })}
        <Label x={CX} y={CY + 250} at={w(807)}>ТОНКИЙ ПЛАН</Label>
      </Shot>

      {/* 18 сердце прорисовывается и вспыхивает */}
      <Shot from={b(18)} to={end(18)}>
        <Ln d={`M ${CX} ${CY + 200} C ${CX - 420} ${CY - 80} ${CX - 200} ${CY - 330} ${CX} ${CY - 150} C ${CX + 200} ${CY - 330} ${CX + 420} ${CY - 80} ${CX} ${CY + 200} Z`}
          p={ramp(t, b(18), 1.1, Easing.inOut(Easing.cubic))} c={C.gold} w={4} />
        <circle cx={CX} cy={CY - 20} r={20 + 120 * ramp(t, w(914), 0.6)} fill="url(#light)" opacity={0.7} />
        <Label x={CX} y={CY + 290} at={w(914)}>ИСЦЕЛИТЬ</Label>
      </Shot>

      {/* 19 запутанная нить */}
      <Shot from={b(19)} to={end(19)}>
        <Ln d={`M ${CX - 700} ${CY} C ${CX - 400} ${CY} ${CX - 300} ${CY - 250} ${CX - 120} ${CY - 120} S ${CX - 260} ${CY + 220} ${CX - 40} ${CY + 120}
          S ${CX + 160} ${CY - 260} ${CX + 60} ${CY - 60} S ${CX + 260} ${CY + 200} ${CX + 140} ${CY + 40} S ${CX + 400} ${CY} ${CX + 700} ${CY}`}
          p={ramp(t, b(19), 1.3, Easing.inOut(Easing.cubic))} c={C.line} w={4} />
        <Label x={CX} y={CY + 300} at={w(915)} c={C.muted}>КАРМИЧЕСКИЕ УЗЛЫ</Label>
      </Shot>

      {/* 20 нить через тени прошлых воплощений распрямляется в золотую */}
      <Shot from={b(20)} to={end(20)}>
        {(() => {
          const u = ramp(t, w(921), end(20) - w(921) - 0.2, Easing.inOut(Easing.cubic));
          const ys = [-150, 120, -90, 140, -60, 0];
          let d = `M ${CX - 760} ${CY}`;
          ys.forEach((y, i) => { const x = CX - 760 + (i + 1) * 253; d += ` Q ${x - 126} ${CY + y * (1 - u)} ${x} ${CY + (i === ys.length - 1 ? 0 : -y * 0.4 * (1 - u))}`; });
          return (
            <g>
              {[0, 1, 2, 3, 4].map((i) => <Ln key={i} d={figurePath(CX - 600 + i * 300, CY + 330, 220)} p={1} w={2} glow={false} o={0.12 + i * 0.12} />)}
              <path d={d} fill="none" stroke={u > 0.5 ? C.gold : C.line} strokeWidth={4} filter="url(#glow)" />
            </g>
          );
        })()}
        <Label x={CX} y={CY - 300} at={w(924)}>МНОГИЕ ВОПЛОЩЕНИЯ</Label>
      </Shot>

      {/* 21 шумная волна успокаивается */}
      <Shot from={b(21)} to={end(21)}>
        {(() => {
          const calm = ramp(t, w(1021), end(21) - w(1021), Easing.inOut(Easing.cubic));
          let d = '';
          for (let i = 0; i <= 200; i++) {
            const x = CX - 760 + i * 7.6, ph = i * 0.12 - t * 4;
            const y = CY + Math.sin(ph) * 60 + (Math.sin(ph * 3.7) * 70 + Math.sin(ph * 7.3) * 40) * (1 - calm);
            d += `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)} `;
          }
          return <path d={d} fill="none" stroke={calm > 0.6 ? C.gold : C.line} strokeWidth={3} filter="url(#glow)" opacity={ramp(t, b(21), 0.4)} />;
        })()}
        <Label x={CX} y={CY + 260} at={w(1021)}>НАСТРОИТЬСЯ</Label>
      </Shot>

      {/* 22 капля и круги на воде */}
      <Shot from={b(22)} to={end(22)}>
        {(() => {
          const fall = ramp(t, b(22), 0.5, Easing.in(Easing.quad));
          return (
            <g>
              <Ln d={`M ${CX} ${CY - 330 + 260 * fall} C ${CX - 50} ${CY - 250 + 260 * fall} ${CX - 50} ${CY - 190 + 260 * fall} ${CX} ${CY - 190 + 260 * fall} C ${CX + 50} ${CY - 190 + 260 * fall} ${CX + 50} ${CY - 250 + 260 * fall} ${CX} ${CY - 330 + 260 * fall}`}
                p={1} c={C.white} w={3} o={1 - ramp(t, b(22) + 0.5, 0.2)} />
              {[0, 1, 2, 3].map((k) => {
                const p = ramp(t, b(22) + 0.5 + k * 0.25, 1.6);
                return <ellipse key={k} cx={CX} cy={CY + 80} rx={60 + 520 * p} ry={14 + 120 * p} fill="none" stroke={C.gold} strokeWidth={2.5} opacity={(1 - p) * 0.9} filter="url(#glow)" />;
              })}
            </g>
          );
        })()}
        <Label x={CX} y={CY + 300} at={w(1024)}>ЧИСТОТА</Label>
      </Shot>
    </>
  );
};

/** Концовка: календарь + курс + кнопка (стоит до конца, «хвост»). */
const Final: React.FC<{at: number}> = ({at}) => {
  const t = useT();
  if (t < at) return null;
  const p = ramp(t, at, 0.5);
  const card = ramp(t, at + 0.2, 0.6);
  const pill = ramp(t, at + 0.9, 0.5);
  return (
    <AbsoluteFill style={{opacity: p, alignItems: 'center', justifyContent: 'center', paddingBottom: 60, fontFamily: MAIN}}>
      <div style={{display: 'flex', gap: 48, alignItems: 'center', padding: '44px 60px', borderRadius: 36, border: `2px solid ${C.gold}`,
        background: 'rgba(42,34,29,0.85)', boxShadow: `0 0 80px ${C.glow}`, transform: `translateY(${(1 - card) * 40}px) scale(${0.94 + 0.06 * card})`, opacity: card}}>
        <div style={{width: 210, borderRadius: 18, overflow: 'hidden', textAlign: 'center', border: `1px solid ${C.dim}`}}>
          <div style={{background: C.gold, color: C.bg, fontWeight: 600, fontSize: 28, letterSpacing: '0.18em', padding: '10px 0'}}>НОЯБРЬ</div>
          <div style={{color: C.white, fontWeight: 600, fontSize: 140, lineHeight: 1.1}}>11</div>
        </div>
        <div>
          <div style={{color: C.gold, fontSize: 28, letterSpacing: '0.2em', fontWeight: 500}}>• СКИДКА · ДАТА</div>
          <div style={{color: C.white, fontSize: 66, fontWeight: 600, lineHeight: 1.1, marginTop: 14}}>Название<br /><span style={{fontFamily: ACCENT, fontStyle: 'italic', fontWeight: 400, color: C.gold2, fontSize: 74}}>курса</span></div>
          <div style={{color: C.muted, fontSize: 34, marginTop: 14}}>только сегодня</div>
        </div>
      </div>
      <div style={{marginTop: 44, padding: '18px 44px', borderRadius: 999, background: C.white, color: C.bg, fontSize: 38, fontWeight: 600,
        boxShadow: `0 0 50px ${C.glow}`, opacity: pill, transform: `scale(${0.8 + 0.2 * pill})`}}>подробнее — по ссылке в шапке профиля</div>
    </AbsoluteFill>
  );
};

// ---------- звуки: на каждой смене кадра — свой вжух/щелчок, на акцентах — удары и разгоны ----------
const WHOOSH = ['Whooshes/Simple Whoosh.wav', 'Whooshes/Smooth And Fast Whoosh.wav', 'Whooshes/Simple Whoosh 2.wav', 'Whooshes/Slow And Smooth Whoosh.wav',
  'Whooshes/Fast Whoosh.wav', 'Whooshes/Smooth Like A Butter Whoosh.wav', 'Whooshes/Whoosh Deep Light 2.wav', 'Whooshes/saas whoosh.wav'];
const ACCENTS: Record<number, string> = {
  0: 'Riser/Импакт (колокольчик).wav', 2: 'Riser/Импакт.wav', 3: 'Riser/Разгон 2.wav', 8: 'Riser/Импакт 4.wav', 10: 'Riser/Разгон.wav',
  12: 'Riser/Импакт 5.wav', 15: 'Riser/Импакт (колокольчик).wav', 18: 'Riser/Импакт.wav', 20: 'Riser/Разгон 3.wav',
};
const Sounds: React.FC<{beats: number[]; length: number}> = ({beats, length}) => (
  <>
    {beats.map((b, i) => (
      <Sequence key={`w${i}`} from={Math.max(0, sec(b - 0.12))} durationInFrames={sec(2.5)} layout="none">
        <Sfx file={WHOOSH[i % WHOOSH.length]} volume={0.32} />
      </Sequence>
    ))}
    {Object.entries(ACCENTS).map(([i, f]) => beats[+i] !== undefined ? (
      <Sequence key={`a${i}`} from={Math.max(0, sec(beats[+i] + 0.15))} durationInFrames={sec(3)} layout="none">
        <Sfx file={f} volume={0.28} />
      </Sequence>
    ) : null)}
    <Sequence from={sec(length - 0.1)} durationInFrames={sec(3)} layout="none">
      <Sfx file='Riser/Импакт (колокольчик).wav' volume={0.35} />
    </Sequence>
  </>
);

// начала кадров — по словам: первое слово каждой фразы-смысла
const BEAT_WORDS = [212, 214, 220, 383, 392, 399, 405, 411, 443, 452, 459, 465, 471, 477, 487, 783, 794, 803, 910, 915, 919, 1017, 1023];

export const Kosmos: React.FC<KosmosProps> = ({audio, words, phrases, length}) => {
  const map = useMemo(() => Object.fromEntries(words.map((x) => [x.н, x])), [words]);
  const beats = useMemo(() => {
    const at = (n: number) => { for (let k = n; k < n + 40; k++) if (map[k]) return map[k].начало; return 0; };
    return BEAT_WORDS.map((n, i) => (i === 0 ? 0 : at(n) - 0.08));
  }, [map]);
  return (
    <WordsCtx.Provider value={map}>
      <AbsoluteFill style={{background: C.bg}}>
        <Background />
        <Anchor beats={beats} />
        <Scenes length={length} beats={beats} />
        <Final at={length} />
        <Subs phrases={phrases} />
        {/* плёночное зерно */}
        <AbsoluteFill style={{pointerEvents: 'none', opacity: 0.07, mixBlendMode: 'screen'}}>
          <svg width="100%" height="100%"><filter id="kg"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(useCurrentFrame() / 2)} />
            <feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter="url(#kg)" /></svg>
        </AbsoluteFill>
        <Html5Audio src={staticFile(audio)} />
        <Sounds beats={beats} length={length} />
      </AbsoluteFill>
    </WordsCtx.Provider>
  );
};
