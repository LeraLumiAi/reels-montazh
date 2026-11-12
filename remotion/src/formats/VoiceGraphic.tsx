// Формат «голос + анимированная графика, без говорящей головы».
// Оформление — стиль «Тёплый свет» (styles/teplyj-svet.md): цвета, Onest + Playfair Italic,
// радиусы, зерно, точка ps-dot. Движение и звуки — из пака звуков: пружины, проявление из размытия,
// размытие на выходе, вжухи/хлопки/щелчки/печать под каждое появление.
// Проба: голос — public/графика/голос.wav (свой файл), звуки: public/sfx/.
import '../fonts';
import {Sfx} from '../sfx';
import React from 'react';
import {
  AbsoluteFill, Html5Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';

const FPS = 30;
export const GRAPHIC_DURATION = 27.6;
export type GraphicProps = {theme: 'Утро' | 'Вечер'};

// ---------- токены «Тёплого света» ----------
type Theme = {
  bg: string; card: string; tile: string; ink: string; muted: string; line: string; accent: string;
  caramel: string; deep: string; gold: string; onDark: string; onFill: string; button: string; buttonText: string;
  shadow: string; glow: string; spots: [string, string, string]; grain: number;
};
export const THEMES: Record<GraphicProps['theme'], Theme> = {
  'Утро': {
    bg: '#F7F2EA', card: '#FCF9F4', tile: '#E8DCCB', ink: '#3A332E', muted: '#6B5E54', line: '#D8CBB8',
    accent: '#7E5A2E', caramel: '#C9A27E', deep: '#8A6446', gold: '#D9B36C', onDark: '#F7F2EA', onFill: '#F7F2EA',
    button: '#3A332E', buttonText: '#F7F2EA',                    // кнопки: заливка ink, текст on-dark
    shadow: '0 18px 48px rgba(0,0,0,0.10)', glow: 'rgba(217,179,108,0.45)',
    spots: ['#EBD9BC', '#E8DCCB', '#F3E3C4'], grain: 0.07,
  },
  'Вечер': {
    bg: '#2A221D', card: '#362C26', tile: '#4A3D34', ink: '#F3EAE0', muted: '#BFAE9E', line: '#54463C',
    accent: '#E0BE7A', caramel: '#C9A27E', deep: '#D4A983', gold: '#E0BE7A', onDark: '#F7F2EA', onFill: '#2A221D',
    button: '#E0BE7A', buttonText: '#2A221D',
    shadow: '0 18px 48px rgba(0,0,0,0.35)', glow: 'rgba(224,190,122,0.35)',
    spots: ['#4A3D34', '#3E322B', '#5A4636'], grain: 0.09,
  },
};
export const ThemeCtx = React.createContext<Theme>(THEMES['Утро']);
export const useTh = () => React.useContext(ThemeCtx);

export const MAIN = 'Onest, sans-serif';
export const ACCENT = '"Playfair Display", serif';
export const R = {sm: 10, md: 20, lg: 36, pill: 999};
export const sec = (s: number) => Math.round(s * FPS);

// ---------- движение (из пака: пружины, проявление из размытия) ----------
export const useT = () => useCurrentFrame() / FPS;

export const useSpring = (start: number, kind: 'soft' | 'bounce' | 'snap' = 'soft') => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const config = kind === 'bounce' ? {damping: 9, stiffness: 140, mass: 0.7}
    : kind === 'snap' ? {damping: 18, stiffness: 260, mass: 0.6}
    : {damping: 20, stiffness: 110, mass: 0.9};
  return spring({frame: frame - sec(start), fps, config});
};

/** Появление: подъём + проявление + размытие, которое уходит вместе с движением. */
export const Reveal: React.FC<{at: number; from?: number; kind?: 'soft' | 'bounce' | 'snap'; scaleFrom?: number;
  style?: React.CSSProperties; children: React.ReactNode}> = ({at, from = 60, kind = 'soft', scaleFrom = 1, style, children}) => {
  const p = useSpring(at, kind);
  const blur = Math.max(0, (1 - Math.min(p, 1)) * 22);
  return (
    <div style={{
      opacity: interpolate(p, [0, 0.45], [0, 1], {extrapolateRight: 'clamp'}),
      transform: `translateY(${(1 - p) * from}px) scale(${scaleFrom + (1 - scaleFrom) * p})`,
      filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
      ...style,
    }}>{children}</div>
  );
};

/** Сцена: живёт с from по to (сек), на выходе уменьшается, размывается и гаснет. */
export const Scene: React.FC<{from: number; to: number; children: React.ReactNode}> = ({from, to, children}) => {
  const t = useT();
  if (t < from - 0.05 || t > to + 0.4) return null;
  const out = interpolate(t, [to, to + 0.3], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic)});
  return (
    <AbsoluteFill style={{
      opacity: 1 - out, transform: `scale(${1 - out * 0.08}) translateY(${-out * 80}px)`,
      filter: out > 0.01 ? `blur(${out * 24}px)` : undefined,
    }}>{children}</AbsoluteFill>
  );
};

export const Typed: React.FC<{text: string; at: number; dur: number; cursor?: boolean}> = ({text, at, dur, cursor = true}) => {
  const th = useTh();
  const t = useT();
  const n = Math.round(interpolate(t, [at, at + dur], [0, text.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const typing = t >= at && n < text.length;
  const blink = Math.floor(t * 2.2) % 2 === 0;
  return (
    <span>
      {t < at ? '' : text.slice(0, n)}
      {cursor && t >= at && (typing || blink) ? <span style={{color: th.gold, fontWeight: 400}}>|</span> : null}
    </span>
  );
};

/** Курсивный акцент: Playfair Display Italic цветом accent-ink (1–3 слова на фразу). */
export const Em: React.FC<{children: React.ReactNode; size?: number}> = ({children, size}) => {
  const th = useTh();
  return <span style={{fontFamily: ACCENT, fontStyle: 'italic', fontWeight: 400, color: th.accent, letterSpacing: 0,
    fontSize: size, fontVariantNumeric: 'lining-nums'}}>{children}</span>;
};

export const Card: React.FC<{style?: React.CSSProperties; children: React.ReactNode}> = ({style, children}) => {
  const th = useTh();
  return <div style={{background: th.card, borderRadius: R.lg, boxShadow: th.shadow, ...style}}>{children}</div>;
};

/** Кнопка-призыв: заливка ink, текст on-dark, radius-pill; glow — золотой ореол (свет, а не краска). */
export const Pill: React.FC<{style?: React.CSSProperties; glow?: number; children: React.ReactNode}> = ({style, glow = 0.4, children}) => {
  const th = useTh();
  return (
    <div style={{
      display: 'inline-block', background: th.button, color: th.buttonText, borderRadius: R.pill, padding: '16px 40px',
      fontFamily: MAIN, fontWeight: 500, fontSize: 40, boxShadow: `0 0 ${40 + 80 * glow}px ${th.glow}, ${th.shadow}`, ...style,
    }}>{children}</div>
  );
};

/** Подпись заглавными с разрядкой (canvas-caption). */
export const Caption: React.FC<{children: React.ReactNode; dot?: boolean}> = ({children, dot}) => {
  const th = useTh();
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16, fontFamily: MAIN, fontWeight: 500, fontSize: 32,
      letterSpacing: '0.16em', textTransform: 'uppercase', color: th.muted, lineHeight: 1}}>
      {dot && <span style={{width: 12, height: 12, borderRadius: 6, background: th.gold, boxShadow: `0 0 18px 4px ${th.glow}`}} />}
      {children}
    </div>
  );
};

// Безопасная зона Reels: шапка до 245 px, снизу 460 px, справа кнопки — контент шириной ≤ 760 по центру.
// В формате «полэкрана» сцены рисуются в нижней панели — там отступы под шапку не нужны.
export const CenterPad = React.createContext<{top: number; bottom: number}>({top: 245, bottom: 460});
export const Center: React.FC<{children: React.ReactNode}> = ({children}) => {
  const th = useTh();
  const pad = React.useContext(CenterPad);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', paddingTop: pad.top, paddingBottom: pad.bottom,
      fontFamily: MAIN, color: th.ink}}>
      <div style={{width: 760, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>{children}</div>
    </AbsoluteFill>
  );
};

// ---------- фон: тёплые пятна света + плёночное зерно + подпись «Подпись автора» с точкой ----------
export const Background: React.FC = () => {
  const th = useTh();
  const t = useT();
  const frame = useCurrentFrame();
  const blob = (x: number, y: number, r: number, color: string, ph: number, op = 0.8) => (
    <div style={{
      position: 'absolute', width: r, height: r, borderRadius: '50%', background: color, filter: 'blur(140px)', opacity: op,
      left: x + Math.sin(t * 0.35 + ph) * 90 - r / 2, top: y + Math.cos(t * 0.3 + ph) * 110 - r / 2,
    }} />
  );
  return (
    <AbsoluteFill style={{background: th.bg, overflow: 'hidden'}}>
      {blob(200, 420, 640, th.spots[0], 0)}
      {blob(900, 1500, 720, th.spots[1], 2)}
      {blob(860, 320, 440, th.spots[2], 4)}
      {/* золотой блик — свет, а не заливка */}
      {blob(760, 760, 360, th.gold, 1, 0.18)}
    </AbsoluteFill>
  );
};
export const Grain: React.FC = () => {
  const th = useTh();
  const seed = Math.floor(useCurrentFrame() / 2);
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: th.grain, mixBlendMode: 'multiply'}}>
      <svg width="100%" height="100%">
        <filter id="ps-grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#ps-grain)" />
      </svg>
    </AbsoluteFill>
  );
};
const Signature: React.FC = () => (
  // Шапка Instagram кончается на ~245 px — подпись ниже неё, слева на поле 96.
  <div style={{position: 'absolute', left: 96, top: 275}}><Caption dot>Подпись автора</Caption></div>
);

// ---------- сцены (время — по словам) ----------

// 0.0–1.95 фраза из ролика
export const S1Title: React.FC = () => {
  const th = useTh();
  const letters = 'Повторяющиеся'.split('');
  return (
    <Scene from={0} to={1.9}>
      <Center>
        <Reveal at={0.05} kind="snap" from={30} style={{marginBottom: 36}}><Caption>Тема ролика</Caption></Reveal>
        <div style={{display: 'flex', fontSize: 96, fontWeight: 600, letterSpacing: -2, color: th.ink}}>
          {letters.map((ch, i) => <Reveal key={i} at={0.15 + i * 0.03} from={40}><span>{ch}</span></Reveal>)}
        </div>
        <Reveal at={0.6} from={50} kind="bounce"><Em size={150}>цифры</Em></Reveal>
      </Center>
    </Scene>
  );
};

// 1.95–4.65 фраза из ролика
const NumberTile: React.FC<{at: number; num: string; caption: string}> = ({at, num, caption}) => {
  const th = useTh();
  return (
    <Reveal at={at} kind="bounce" from={120} scaleFrom={0.6}>
      <Card style={{width: 700, padding: '44px 0 40px', textAlign: 'center', marginBottom: 40}}>
        <div style={{fontFamily: MAIN, fontSize: 200, fontWeight: 600, letterSpacing: -6, lineHeight: 1, color: th.deep,
          textShadow: `0 0 60px ${th.glow}`}}>{num}</div>
        <div style={{fontSize: 46, fontWeight: 400, color: th.muted, marginTop: 16}}>{caption}</div>
      </Card>
    </Reveal>
  );
};
export const S2Numbers: React.FC = () => (
  <Scene from={1.95} to={4.55}>
    <Center>
      <NumberTile at={1.98} num="333" caption="три тройки" />
      <NumberTile at={2.9} num="1111" caption="четыре единицы" />
    </Center>
  </Scene>
);

// 4.7–9.95 фраза из ролика
const Ring: React.FC<{at: number; size: number}> = ({at, size}) => {
  const th = useTh();
  const t = useT();
  const p = interpolate(t, [at, at + 1.6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const r = size / 2 - 22;
  const len = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{position: 'absolute', inset: 0, filter: `drop-shadow(0 0 18px ${th.glow})`}}>
      <defs>
        <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={th.caramel} /><stop offset="1" stopColor={th.gold} />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={th.tile} strokeWidth={22} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke="url(#ring)" strokeWidth={22} fill="none" strokeLinecap="round"
        strokeDasharray={len} strokeDashoffset={len * (1 - p * 0.92)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
};
export const S3Signs: React.FC = () => {
  const th = useTh();
  const glow = useSpring(9.14, 'bounce');
  return (
    <Scene from={4.65} to={9.9}>
      <Center>
        <Reveal at={4.7} kind="snap" from={40}>
          <div style={{fontSize: 90, fontWeight: 600, letterSpacing: -2, marginBottom: 44}}>Парные <Em>числа</Em></div>
        </Reveal>
        <Reveal at={5.3} kind="bounce" from={100} scaleFrom={0.7}>
          <div style={{position: 'relative', width: 400, height: 400, marginBottom: 50}}>
            <Ring at={5.5} size={400} />
            <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
              <div style={{fontSize: 104, fontWeight: 600, letterSpacing: -3, color: th.ink}}>12:12</div>
            </AbsoluteFill>
          </div>
        </Reveal>
        <div style={{fontSize: 60, fontWeight: 600, letterSpacing: -1, textAlign: 'center', lineHeight: 1.2}}>
          <Reveal at={6.5} from={30}><span style={{color: th.muted, fontWeight: 400}}>один из самых</span></Reveal>
          <Reveal at={7.54} from={30}><span>частых знаков</span></Reveal>
        </div>
        <Reveal at={9.0} kind="bounce" from={50} scaleFrom={0.5} style={{marginTop: 36}}>
          <Pill glow={glow} style={{fontSize: 52, padding: '18px 48px'}}>от высших сил</Pill>
        </Reveal>
      </Center>
    </Scene>
  );
};

// 9.95–15.45 фраза из ролика
const Notification: React.FC<{at: number}> = ({at}) => {
  const th = useTh();
  const p = useSpring(at, 'snap');
  return (
    <div style={{
      transform: `translateY(${(1 - p) * -260}px) scale(${0.9 + p * 0.1})`, opacity: interpolate(p, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'}),
      width: 760, background: th.card, borderRadius: R.lg, padding: '30px 34px', boxShadow: th.shadow,
      display: 'flex', alignItems: 'center', gap: 28, boxSizing: 'border-box',
    }}>
      <div style={{width: 92, height: 92, borderRadius: R.md, background: th.tile, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0, boxShadow: `inset 0 0 0 1px ${th.line}`}}>
        <span style={{width: 22, height: 22, borderRadius: 11, background: th.gold, boxShadow: `0 0 24px 8px ${th.glow}`}} />
      </div>
      <div style={{flex: 1}}>
        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 34, fontWeight: 600}}>
          <span>Знак</span><span style={{color: th.muted, fontWeight: 400}}>сейчас</span>
        </div>
        <div style={{fontSize: 38, marginTop: 6}}>Снова 12:12 на часах</div>
      </div>
    </div>
  );
};
const Row: React.FC<{at: number; ok: boolean; text: string}> = ({at, ok, text}) => {
  const th = useTh();
  return (
    <Reveal at={at} kind="bounce" from={40} scaleFrom={0.8}>
      <div style={{display: 'flex', alignItems: 'center', gap: 26, fontSize: 64, fontWeight: 600, letterSpacing: -1, marginTop: 30,
        color: ok ? th.ink : th.muted}}>
        <div style={{width: 76, height: 76, borderRadius: 38, background: ok ? th.deep : th.tile, color: ok ? th.onFill : th.muted,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 600,
          boxShadow: ok ? `0 0 30px ${th.glow}` : undefined}}>{ok ? '✓' : '✕'}</div>
        <span style={{textDecoration: ok ? 'none' : 'line-through', textDecorationThickness: 4}}>{text}</span>
      </div>
    </Reveal>
  );
};
export const S4Hint: React.FC = () => {
  const th = useTh();
  return (
    <>
      <Scene from={9.95} to={13.25}>
        <Center>
          <Notification at={10.0} />
          <div style={{height: 70}} />
          <Reveal at={10.0} from={30}><div style={{fontSize: 48, color: th.muted}}>Люди</div></Reveal>
          <Row at={10.64} ok text="замечают" />
          <Row at={12.16} ok={false} text="понимают" />
        </Center>
      </Scene>
      <Scene from={13.3} to={15.4}>
        <Center>
          <Reveal at={13.36} from={60}>
            <div style={{fontSize: 100, fontWeight: 600, letterSpacing: -2, textAlign: 'center'}}>это подсказка</div>
          </Reveal>
          <Reveal at={14.28} kind="bounce" from={50} scaleFrom={0.7}>
            <div style={{fontSize: 92, fontWeight: 600, letterSpacing: -2, textAlign: 'center', whiteSpace: 'nowrap'}}><Em size={104}>именно</Em> для них</div>
          </Reveal>
        </Center>
      </Scene>
    </>
  );
};

// 15.45–24.3 фраза из ролика
const NoteField: React.FC<{at: number; dur: number; text: string}> = ({at, dur, text}) => {
  const th = useTh();
  const check = useSpring(at + dur + 0.2, 'bounce');
  return (
    <Reveal at={at} from={30} kind="snap">
      <div style={{borderTop: `1px solid ${th.line}`, padding: '24px 0 4px', display: 'flex', alignItems: 'center', gap: 24}}>
        <div style={{width: 50, height: 50, borderRadius: 25, border: `3px solid ${check > 0.05 ? th.deep : th.line}`,
          background: check > 0.05 ? th.deep : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: th.onFill, fontSize: 28, fontWeight: 600}}>
          <span style={{transform: `scale(${check})`}}>✓</span>
        </div>
        <div style={{fontSize: 48, minHeight: 60}}><Typed text={text} at={at + 0.15} dur={dur} /></div>
      </div>
    </Reveal>
  );
};
const S5Notes: React.FC = () => {
  const th = useTh();
  const t = useT();
  const now = useSpring(22.76, 'bounce');
  return (
    <Scene from={15.45} to={24.25}>
      <Center>
        <Reveal at={15.48} kind="bounce" from={40} scaleFrom={0.5}><Caption dot>Совет</Caption></Reveal>
        <Reveal at={16.3} from={40} style={{marginTop: 26}}>
          <div style={{fontSize: 84, fontWeight: 600, letterSpacing: -2}}>Заведи <Em size={94}>блокнот</Em></div>
        </Reveal>
        <Reveal at={16.96} from={140} scaleFrom={0.85} style={{marginTop: 40}}>
          <Card style={{width: 760, padding: '40px 50px 34px', position: 'relative', boxSizing: 'border-box'}}>
            <div style={{fontSize: 30, fontWeight: 500, color: th.muted, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 18}}>
              Заметки
            </div>
            <div style={{fontSize: 56, fontWeight: 600, letterSpacing: -1, marginBottom: 18}}>
              <Typed text="Блокнот знаков" at={17.1} dur={0.6} cursor={t < 17.72} />
            </div>
            <NoteField at={17.72} text="Каждый знак" dur={0.9} />
            <NoteField at={19.56} text="Что видел" dur={0.6} />
            <NoteField at={20.78} text="Что происходило" dur={1.0} />
            <div style={{
              position: 'absolute', right: 36, top: 32, transform: `scale(${now})`, opacity: Math.min(1, now * 2),
              background: th.button, color: th.buttonText, borderRadius: R.pill, padding: '10px 26px', fontSize: 32, fontWeight: 500,
              boxShadow: `0 0 40px ${th.glow}`,
            }}>в этот момент</div>
          </Card>
        </Reveal>
      </Center>
    </Scene>
  );
};

// 24.3–27.6 фраза из ролика
const S6Pattern: React.FC = () => {
  const th = useTh();
  const t = useT();
  const marked = [2, 5, 8, 11]; // каждый третий день — ровный ритм, это и есть закономерность
  const cell = 92, gap = 14, cols = 7;
  const W = cols * cell + (cols - 1) * gap, H = 2 * cell + gap;
  return (
    <Scene from={24.3} to={99}>
      <Center>
        <Reveal at={24.38} from={40} kind="snap">
          <div style={{fontSize: 80, fontWeight: 600, letterSpacing: -2, marginBottom: 46}}>Через пару недель</div>
        </Reveal>
        <Reveal at={24.45} from={80} scaleFrom={0.9}>
          <Card style={{padding: 34}}>
            <div style={{position: 'relative', width: W, height: H}}>
              {Array.from({length: 14}).map((_, i) => {
                const x = (i % cols) * (cell + gap), y = Math.floor(i / cols) * (cell + gap);
                const k = marked.indexOf(i);
                const appear = interpolate(t, [24.5 + i * 0.05, 24.75 + i * 0.05], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
                const lit = k >= 0 ? interpolate(t, [25.55 + k * 0.13, 25.75 + k * 0.13], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
                const fill = k >= 0 ? interpolate(t, [26.22 + k * 0.1, 26.42 + k * 0.1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
                const pulse = 1 + Math.sin(fill * Math.PI) * 0.12;
                return (
                  <div key={i} style={{
                    position: 'absolute', left: x, top: y, width: cell, height: cell, borderRadius: R.md,
                    background: fill > 0.5 ? th.deep : th.tile, opacity: appear,
                    boxShadow: fill > 0 ? `0 0 ${50 * fill}px ${th.glow}` : undefined,
                    transform: `scale(${(0.6 + 0.4 * appear) * pulse})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 34, fontWeight: 500, color: fill > 0.5 ? th.onFill : lit > 0.5 ? th.ink : th.muted,
                  }}>
                    {i + 1}
                    {k >= 0 ? <div style={{position: 'absolute', bottom: 12, width: 12, height: 12, borderRadius: 6,
                      background: fill > 0.5 ? th.onFill : th.gold, transform: `scale(${lit})`, boxShadow: `0 0 14px 3px ${th.glow}`}} /> : null}
                  </div>
                );
              })}
            </div>
          </Card>
        </Reveal>
        <Reveal at={26.22} kind="bounce" from={60} scaleFrom={0.6} style={{marginTop: 50, textAlign: 'center'}}>
          <div style={{fontSize: 46, color: th.muted}}>ты увидишь</div>
          <Em size={118}>закономерность</Em>
        </Reveal>
      </Center>
    </Scene>
  );
};

// ---------- звуки из пака звуков ----------
export type Sfx = {at: number; file: string; vol?: number};
export const SFX: Sfx[] = [
  {at: 0.0, file: 'Whooshes/Smooth Like A Butter Whoosh.wav', vol: 0.35},
  {at: 0.6, file: 'Pop/Premium And Smooth Pop.wav', vol: 0.4},
  {at: 1.9, file: 'Whooshes/Simple Whoosh.wav', vol: 0.3},
  {at: 1.98, file: 'Pop/Smooth Pop.wav', vol: 0.45},
  {at: 2.9, file: 'Pop/Smooth Pop.wav', vol: 0.45},
  {at: 4.55, file: 'Whooshes/Simple Whoosh.wav', vol: 0.3},
  {at: 5.3, file: 'Data Collect/Cinematic data.wav', vol: 0.25},
  {at: 9.0, file: 'Pop/Sweet UI Open.wav', vol: 0.45},
  {at: 9.9, file: 'Whooshes/Simple Whoosh.wav', vol: 0.3},
  {at: 10.0, file: 'Ui Sound Effects/UI Premium Open.wav', vol: 0.4},
  {at: 10.64, file: 'Clicks/High Click.wav', vol: 0.4},
  {at: 12.16, file: 'Ui Sound Effects/Ui BackSpace.wav', vol: 0.4},
  {at: 13.25, file: 'Whooshes/Smooth And Fast Whoosh.wav', vol: 0.3},
  {at: 14.28, file: 'Pop/Premium And Smooth Pop.wav', vol: 0.4},
  {at: 15.4, file: 'Whooshes/Simple Whoosh.wav', vol: 0.3},
  {at: 15.48, file: 'Pop/Sweet UI Open.wav', vol: 0.45},
  {at: 16.96, file: 'Ui Sound Effects/Ui Open.wav', vol: 0.35},
  {at: 17.1, file: 'Ui Sound Effects/Ui Typing.wav', vol: 0.25},
  {at: 19.7, file: 'Ui Sound Effects/Ui Typing.wav', vol: 0.25},
  {at: 20.9, file: 'Ui Sound Effects/Ui Typing.wav', vol: 0.25},
  {at: 22.76, file: 'Pop/Smooth Pop.wav', vol: 0.4},
  {at: 24.25, file: 'Risers/Smooth Riser.wav', vol: 0.25},
  {at: 25.55, file: 'Clicks/Click 2.wav', vol: 0.3},
  {at: 26.22, file: 'Pop/Premium And Smooth Pop.wav', vol: 0.5},
];

export const VoiceGraphic: React.FC<GraphicProps> = ({theme}) => (
  <ThemeCtx.Provider value={THEMES[theme] ?? THEMES['Утро']}>
    <AbsoluteFill style={{fontFamily: MAIN}}>
      <Background />
      <Signature />
      <S1Title />
      <S2Numbers />
      <S3Signs />
      <S4Hint />
      <S5Notes />
      <S6Pattern />
      <Grain />
      <Html5Audio src={staticFile('графика/голос.wav')} />
      {SFX.map((s, i) => (
        <Sequence key={i} from={sec(s.at)} durationInFrames={sec(3)} layout="none">
          <Sfx file={s.file} volume={s.vol ?? 0.35} />
        </Sequence>
      ))}
    </AbsoluteFill>
  </ThemeCtx.Provider>
);
