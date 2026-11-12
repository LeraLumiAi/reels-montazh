// Стиль «конспект» (образец):
// сверху спикер, низ видео растворяется в кремовой «бумаге» с точечной сеткой; на бумаге по ходу речи —
// заголовок раздела курсивом с подчёркиванием от руки, сгенерированная картинка-фотокарточка
// (картинки делает человек по подсказкам) и схемы «ручкой»: рамки-ярлыки, галочки, стрелки, обводки.
// Цвета и шрифты — «Тёплый свет». Субтитры без плашки, мельче обычных.
// Границы Instagram: шапка до 245, кнопки справа x ≥ 920 с y ≈ 1235, ник с ~1740, края −51 px.
import '../fonts';
import {Sfx} from '../sfx';
import React from 'react';
import {AbsoluteFill, Html5Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import type {Phrase} from '../types';

export const NOTEBOOK_DURATION = 27.6;   // длина образца, с
export type NotebookProps = {video: string; phrases: Phrase[]; shift: number;
  /** «вариант 2» — второй вариант (третий кусок, слова 166–234): свои разделы по словам, человек уменьшен до 0,82 */
  set?: 'цифры' | 'вариант 2'; words?: {н: number; начало: number; конец: number}[]; length?: number};

const FPS = 30;
const sec = (s: number) => Math.round(s * FPS);
const C = {
  paper: '#F7F2EA', card: '#FCF9F4', tile: '#EFE4D3', ink: '#3A332E', muted: '#6B5E54', line: '#D8CBB8',
  pen: '#8A6446', accent: '#7E5A2E', caramel: '#C9A27E', gold: '#D9B36C', fill: '#F1DFC0', red: '#A65A3F',
};
const MAIN = 'Onest, sans-serif';
const ACCENT = '"Playfair Display", serif';
const SEAM = 940;          // где кончается видео
const CX = 505;            // центр содержимого бумаги: чуть левее середины — справа кнопки Instagram
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const useT = () => useCurrentFrame() / FPS;
const WordsCtx = React.createContext<Record<number, number>>({});
/** начало слова н (если вырезано — ближайшее следующее) */
const useW = () => {
  const m = React.useContext(WordsCtx);
  return (n: number) => { for (let k = n; k < n + 40; k++) if (m[k] !== undefined) return m[k]; return 0; };
};
const ramp = (t: number, a: number, d: number, ease = Easing.out(Easing.cubic)) => interpolate(t, [a, a + d], [0, 1], {...clamp, easing: ease});

// ---------- «рука»: дрожащие линии, которые прорисовываются ----------
const rnd = (seed: number) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };
const j = (seed: number, a = 2.2) => (rnd(seed) - 0.5) * 2 * a;

/** Путь, который рисуется от 0 до 1 (pathLength=1). */
const Ink: React.FC<{d: string; p: number; color?: string; w?: number; fill?: string}> = ({d, p, color = C.pen, w = 3, fill}) => (
  <path d={d} pathLength={1} fill={fill ?? 'none'} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray={1} strokeDashoffset={1 - p} />
);
const roughRect = (w: number, h: number, s: number) => {
  const m = (a: number) => j(s + a);
  return `M ${-4 + m(1)} ${m(2)} L ${w + 3 + m(3)} ${m(4)} L ${w + m(5)} ${h + m(6)} L ${m(7)} ${h + m(8)} L ${2 + m(9)} ${-3 + m(10)}`;
};
const roughEllipse = (rx: number, ry: number, s: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = -0.5 + (i / 40) * (Math.PI * 2 + 0.75);          // с нахлёстом, как обводят ручкой
    const k = 1 + j(s + i, 0.035) + (i / 40) * 0.06;
    pts.push(`${(Math.cos(a) * rx * k).toFixed(1)} ${(Math.sin(a) * ry * k).toFixed(1)}`);
  }
  return 'M ' + pts.join(' L ');
};

/** Подчёркивание от руки. */
const Underline: React.FC<{w: number; at: number}> = ({w, at}) => {
  const p = ramp(useT(), at, 0.5, Easing.inOut(Easing.cubic));
  return (
    <svg width={w + 20} height={24} style={{display: 'block', margin: '0 auto', overflow: 'visible'}}>
      <Ink d={`M 6 12 C ${w * 0.3} 6, ${w * 0.6} 18, ${w + 12} 9`} p={p} color={C.caramel} w={3.5} />
    </svg>
  );
};

/** Ярлык в рамке, нарисованной ручкой. */
const Label: React.FC<{at: number; text: React.ReactNode; w: number; filled?: boolean; seed?: number; size?: number}> = ({at, text, w, filled, seed = 1, size = 34}) => {
  const t = useT();
  const p = ramp(t, at, 0.45, Easing.inOut(Easing.quad));
  const txt = ramp(t, at + 0.15, 0.3);
  const h = size * 2.1;
  return (
    <div style={{position: 'relative', width: w, height: h}}>
      <div style={{position: 'absolute', inset: 0, background: filled ? C.fill : 'transparent', opacity: filled ? txt : 0, borderRadius: 4}} />
      <svg width={w} height={h} style={{position: 'absolute', inset: 0, overflow: 'visible'}}><Ink d={roughRect(w, h, seed)} p={p} /></svg>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MAIN,
        fontWeight: 500, fontSize: size, color: C.ink, opacity: txt, transform: `translateY(${(1 - txt) * 8}px)`, whiteSpace: 'nowrap'}}>{text}</div>
    </div>
  );
};

/** Квадратик с галочкой или крестиком. */
const Check: React.FC<{at: number; ok: boolean; size?: number; seed?: number}> = ({at, ok, size = 40, seed = 3}) => {
  const t = useT();
  const box = ramp(t, at - 0.3, 0.3);
  const mark = ramp(t, at, 0.3, Easing.out(Easing.quad));
  const s = size;
  return (
    <svg width={s} height={s} style={{overflow: 'visible', display: 'block'}}>
      <Ink d={roughRect(s, s, seed)} p={box} color={C.caramel} w={2.5} />
      {ok
        ? <Ink d={`M ${s * 0.2} ${s * 0.52} L ${s * 0.42} ${s * 0.76} L ${s * 0.86} ${s * 0.18}`} p={mark} color={C.pen} w={4} />
        : <Ink d={`M ${s * 0.22} ${s * 0.22} L ${s * 0.78} ${s * 0.78} M ${s * 0.78} ${s * 0.22} L ${s * 0.22} ${s * 0.78}`} p={mark} color={C.red} w={4} />}
    </svg>
  );
};

/** Стрелка ручкой. */
const Arrow: React.FC<{at: number; x1: number; y1: number; x2: number; y2: number; bend?: number}> = ({at, x1, y1, x2, y2, bend = 0}) => {
  const p = ramp(useT(), at, 0.4, Easing.inOut(Easing.quad));
  const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2;
  const a = Math.atan2(y2 - my, x2 - mx), L = 16;
  const head = `M ${x2 - L * Math.cos(a - 0.45)} ${y2 - L * Math.sin(a - 0.45)} L ${x2} ${y2} L ${x2 - L * Math.cos(a + 0.45)} ${y2 - L * Math.sin(a + 0.45)}`;
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
      <Ink d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} p={Math.min(1, p * 1.25)} color={C.red} w={2.5} />
      <Ink d={head} p={interpolate(p, [0.8, 1], [0, 1], clamp)} color={C.red} w={2.5} />
    </svg>
  );
};

/** Слово в обводке от руки. */
const Circled: React.FC<{at: number; children: React.ReactNode; rx: number; ry?: number; size?: number}> = ({at, children, rx, ry = 44, size = 50}) => {
  const t = useT();
  const txt = ramp(t, at, 0.35);
  const p = ramp(t, at + 0.2, 0.6, Easing.inOut(Easing.cubic));
  return (
    <div style={{position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: ry * 2 + 10}}>
      <svg style={{position: 'absolute', left: '50%', top: '50%', overflow: 'visible'}} width={1} height={1}>
        <Ink d={roughEllipse(rx, ry, 7)} p={p} color={C.caramel} w={3} />
      </svg>
      <span style={{fontFamily: ACCENT, fontStyle: 'italic', fontSize: size, color: C.accent, opacity: txt, whiteSpace: 'nowrap',
        transform: `scale(${0.92 + 0.08 * txt})`}}>{children}</span>
    </div>
  );
};

// ---------- раздел: заголовок + картинка + схема; на выходе гаснет и размывается ----------
const Section: React.FC<{from: number; to: number; title: string; titleW: number; img: string; children: React.ReactNode}> = ({from, to, title, titleW, img, children}) => {
  const t = useT();
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  if (t < from - 0.05 || t > to + 0.45) return null;
  const out = interpolate(t, [to, to + 0.4], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  const head = ramp(t, from, 0.4);
  const pic = spring({frame: frame - sec(from + 0.25), fps, config: {damping: 20, stiffness: 110, mass: 0.9}});
  const kb = interpolate(t, [from, to + 0.4], [1.0, 1.08]);   // медленный наезд по картинке
  return (
    <AbsoluteFill style={{opacity: 1 - out, filter: out > 0.01 ? `blur(${out * 16}px)` : undefined}}>
      <div style={{position: 'absolute', left: CX - 420, width: 840, top: 975, textAlign: 'center'}}>
        <div style={{fontFamily: ACCENT, fontStyle: 'italic', fontSize: 54, color: C.ink, opacity: head,
          transform: `translateY(${(1 - head) * 14}px)`, filter: head < 1 ? `blur(${(1 - head) * 8}px)` : undefined}}>{title}</div>
        <Underline w={titleW} at={from + 0.2} />
      </div>
      {/* фотокарточка: белые поля, мягкая тень, лёгкий наклон */}
      <div style={{position: 'absolute', left: CX - 330, top: 1088, width: 660, height: 372, padding: 10, boxSizing: 'border-box',
        background: C.card, borderRadius: 18, boxShadow: '0 14px 40px rgba(58,51,46,0.16), 0 2px 6px rgba(58,51,46,0.08)',
        opacity: interpolate(pic, [0, 0.4], [0, 1], clamp),
        transform: `translateY(${(1 - pic) * 70}px) scale(${0.94 + 0.06 * pic}) rotate(${(1 - pic) * -2}deg)`,
        filter: pic < 0.98 ? `blur(${(1 - Math.min(pic, 1)) * 14}px)` : undefined}}>
        <div style={{width: '100%', height: '100%', overflow: 'hidden', borderRadius: 10}}>
          {img ? <Img src={staticFile(img)} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${kb})`}} />
            : <div style={{width: '100%', height: '100%', background: `linear-gradient(135deg, ${C.tile}, ${C.fill})`}} />}
        </div>
      </div>
      {/* схема под картинкой: от 1490 до 1720 */}
      <div style={{position: 'absolute', left: CX - 410, width: 820, top: 1490, height: 230}}>{children}</div>
    </AbsoluteFill>
  );
};

const Row: React.FC<{gap?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({gap = 40, children, style}) => (
  <div style={{display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap, ...style}}>{children}</div>
);

// ---------- разделы (время — по словам) ----------
const Part1 = () => (
  // фраза из ролика
  <Section from={0} to={9.9} title="Повторяющиеся цифры" titleW={470} img="конспект/1.jpg">
    <Row gap={50}>
      <Label at={1.99} w={320} seed={2} text={<><b style={{fontWeight: 600}}>333</b>&nbsp;<span style={{color: C.muted}}>· три тройки</span></>} size={30} />
      <Label at={2.87} w={420} seed={5} text={<><b style={{fontWeight: 600}}>1111</b>&nbsp;<span style={{color: C.muted}}>· четыре единицы</span></>} size={30} />
    </Row>
    <Arrow at={4.98} x1={220} y1={80} x2={350} y2={140} bend={-10} />
    <Arrow at={5.2} x1={620} y1={80} x2={480} y2={140} bend={10} />
    <Row style={{marginTop: 72}}><Circled at={8.99} rx={250} ry={40} size={46}>знак от высших сил</Circled></Row>
  </Section>
);

const Part2 = () => (
  // фраза из ролика
  <Section from={9.95} to={15.4} title="Люди замечают" titleW={340} img="конспект/2.jpg">
    <Row gap={60}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}>
        <Label at={10.63} w={250} seed={11} text="замечают" />
        <Check at={10.95} ok seed={12} />
      </div>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}>
        <Label at={12.35} w={250} seed={13} text="понимают" filled />
        <Check at={12.6} ok={false} seed={14} />
      </div>
    </Row>
    <Row style={{marginTop: 22}}><Circled at={14.29} rx={230} ry={36} size={44}>подсказка — для них</Circled></Row>
  </Section>
);

const Item: React.FC<{at: number; text: React.ReactNode}> = ({at, text}) => {
  const t = useT();
  const a = ramp(t, at - 0.2, 0.35);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 22, height: 64, opacity: a, transform: `translateX(${(1 - a) * -16}px)`}}>
      <Check at={at + 0.25} ok size={36} seed={at * 10} />
      <span style={{fontFamily: MAIN, fontSize: 34, fontWeight: 500, color: C.ink, whiteSpace: 'nowrap'}}>{text}</span>
    </div>
  );
};
const Part3 = () => {
  const t = useT();
  const hl = ramp(t, 23.35, 0.4);
  return (
    // фраза из ролика
    <Section from={15.45} to={24.2} title="Совет: блокнот знаков" titleW={500} img="конспект/3.jpg">
      <div style={{width: 700, margin: '0 auto'}}>
        <Item at={17.69} text="каждый знак" />
        <Item at={19.58} text="что видел" />
        <Item at={20.77} text={<>что происходило <span style={{position: 'relative', fontFamily: ACCENT, fontStyle: 'italic', color: C.accent}}>
          в этот момент
          <span style={{position: 'absolute', left: 0, right: 0, bottom: 2, height: 14, background: C.fill, zIndex: -1,
            transformOrigin: 'left', transform: `scaleX(${hl})`}} />
        </span></>} />
      </div>
    </Section>
  );
};

const Part4 = () => (
  // фраза из ролика
  <Section from={24.25} to={99} title="Через пару недель" titleW={420} img="конспект/4.jpg">
    <Row gap={46} style={{marginTop: 20}}>
      <Label at={24.6} w={170} seed={21} text="знак" />
      <Label at={25.0} w={200} seed={22} text="запись" />
      <Label at={26.21} w={320} seed={23} text={<span style={{fontFamily: ACCENT, fontStyle: 'italic', color: C.accent}}>закономерность</span>} filled />
    </Row>
    <Arrow at={24.85} x1={183} y1={36} x2={219} y2={36} />
    <Arrow at={25.6} x1={429} y1={36} x2={466} y2={36} />
  </Section>
);

// ---------- разделы «вариант 2» (время — по словам) ----------
const PartsUchenik: React.FC<{imgs: string[]; length: number}> = ({imgs, length}) => {
  const w = useW();
  const t = useT();
  const hl = ramp(t, w(228), 0.4);
  return (
    <>
      {/* фраза из ролика */}
      <Section from={w(166) - 0.05} to={w(186) - 0.1} title="Страх рассыпается" titleW={400} img={imgs[0]}>
        <Row gap={50}>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}>
            <Label at={w(170)} w={230} seed={31} text="страх" />
            <Check at={w(171)} ok={false} seed={32} />
          </div>
        </Row>
        <Row style={{marginTop: 18}}><Circled at={w(178)} rx={190} ry={36} size={44}>рассыпается</Circled></Row>
      </Section>
      {/* фраза из ролика */}
      <Section from={w(186)} to={w(204) - 0.1} title="Представь, что ты:" titleW={420} img={imgs[1]}>
        <div style={{width: 640, margin: '0 auto'}}>
          <Item at={w(191)} text="важный" />
          <Item at={w(194)} text="значимый" />
          <Item at={w(197)} text={<>тебя <span style={{fontFamily: ACCENT, fontStyle: 'italic', color: C.accent}}>могут слушать</span></>} />
        </div>
      </Section>
      {/* фраза из ролика */}
      <Section from={w(204)} to={length + 5} title="Такой же человек" titleW={400} img={imgs[2]}>
        <Row gap={40}>
          <Label at={w(210)} w={150} seed={41} text="я" />
          <div style={{fontFamily: MAIN, fontSize: 60, fontWeight: 600, color: C.caramel, lineHeight: '70px', opacity: ramp(t, w(215), 0.3)}}>=</div>
          <Label at={w(215)} w={250} seed={42} text="любой другой" />
        </Row>
        <Row style={{marginTop: 18}}>
          <Circled at={w(221)} rx={210} ry={34} size={42}>ни лучше, ни хуже</Circled>
        </Row>
        <Row style={{marginTop: 4}}>
          <span style={{position: 'relative', fontFamily: ACCENT, fontStyle: 'italic', fontSize: 44, color: C.accent, opacity: ramp(t, w(228) - 0.2, 0.3)}}>
            принятие всех
            <span style={{position: 'absolute', left: 0, right: 0, bottom: 4, height: 16, background: C.fill, zIndex: -1, transformOrigin: 'left', transform: `scaleX(${hl})`}} />
          </span>
        </Row>
      </Section>
    </>
  );
};
const SfxUchenik: React.FC = () => {
  const w = useW();
  const list = [
    {at: w(166) - 0.1, file: 'Whooshes/Smooth Like A Butter Whoosh.wav', vol: 0.25},
    {at: w(171), file: 'Ui Sound Effects/Ui BackSpace.wav', vol: 0.3},
    {at: w(178), file: 'Pop/Premium And Smooth Pop.wav', vol: 0.35},
    {at: w(186) - 0.1, file: 'Whooshes/Simple Whoosh.wav', vol: 0.22},
    {at: w(191) + 0.25, file: 'Clicks/High Click.wav', vol: 0.28},
    {at: w(194) + 0.25, file: 'Clicks/High Click.wav', vol: 0.28},
    {at: w(197) + 0.25, file: 'Clicks/High Click.wav', vol: 0.28},
    {at: w(204) - 0.1, file: 'Whooshes/Simple Whoosh.wav', vol: 0.22},
    {at: w(221), file: 'Pop/Smooth Pop.wav', vol: 0.3},
    {at: w(228), file: 'Pop/Premium And Smooth Pop.wav', vol: 0.4},
  ];
  return <>{list.map((s, i) => (
    <Sequence key={i} from={Math.max(0, sec(s.at))} durationInFrames={sec(3)} layout="none">
      <Sfx file={s.file} volume={s.vol} />
    </Sequence>
  ))}</>;
};

// ---------- субтитры без плашки: белые, ключевое слово — золотым курсивом ----------
const Subs: React.FC<{phrases: Phrase[]}> = ({phrases}) => {
  const t = useT();
  const p = phrases.find((x, i) => {
    const s = x.слова[0].начало, e = x.слова[x.слова.length - 1].конец;
    const next = phrases[i + 1]?.слова[0].начало ?? Infinity;
    return s <= t && t < Math.min(next, e + 0.6);
  });
  if (!p) return null;
  const a = ramp(t, p.слова[0].начало, 0.18);
  return (
    <div style={{position: 'absolute', left: 110, width: 860, top: 790, textAlign: 'center', fontFamily: MAIN, fontWeight: 600,
      fontSize: 54, lineHeight: 1.2, color: '#FFFFFF', opacity: a, transform: `translateY(${(1 - a) * 10}px)`,
      textShadow: '0 2px 14px rgba(0,0,0,0.55), 0 0 2px rgba(0,0,0,0.35)'}}>
      {p.слова.map((w, i) => {
        const key = w.н === p.ключ;
        const said = w.начало <= t;
        return <React.Fragment key={w.н}>{i ? ' ' : ''}<span style={key
          ? {fontFamily: ACCENT, fontStyle: 'italic', fontWeight: 400, fontSize: 62, color: said ? '#F6D894' : 'rgba(246,216,148,0.7)',
            textShadow: '0 2px 10px rgba(30,20,10,0.9), 0 0 4px rgba(30,20,10,0.8), 0 0 18px rgba(30,20,10,0.5)'}
          : {opacity: said ? 1 : 0.6}}>{w.т}</span></React.Fragment>;
      })}
    </div>
  );
};

// ---------- звуки: тихие, «бумажные» ----------
const SFX: {at: number; file: string; vol?: number}[] = [
  {at: 0.25, file: 'Whooshes/Smooth Like A Butter Whoosh.wav', vol: 0.25},
  {at: 1.99, file: 'Pop/Smooth Pop.wav', vol: 0.3},
  {at: 2.87, file: 'Pop/Smooth Pop.wav', vol: 0.3},
  {at: 9.0, file: 'Pop/Premium And Smooth Pop.wav', vol: 0.35},
  {at: 9.9, file: 'Whooshes/Simple Whoosh.wav', vol: 0.22},
  {at: 10.95, file: 'Clicks/High Click.wav', vol: 0.3},
  {at: 12.6, file: 'Ui Sound Effects/Ui BackSpace.wav', vol: 0.3},
  {at: 14.3, file: 'Pop/Premium And Smooth Pop.wav', vol: 0.35},
  {at: 15.4, file: 'Whooshes/Simple Whoosh.wav', vol: 0.22},
  {at: 17.94, file: 'Clicks/High Click.wav', vol: 0.28},
  {at: 19.83, file: 'Clicks/High Click.wav', vol: 0.28},
  {at: 21.02, file: 'Clicks/High Click.wav', vol: 0.28},
  {at: 24.2, file: 'Whooshes/Simple Whoosh.wav', vol: 0.22},
  {at: 26.21, file: 'Pop/Premium And Smooth Pop.wav', vol: 0.4},
];

export const Notebook: React.FC<NotebookProps & {imgs?: string[]}> = ({video, phrases, shift, set = 'цифры', words = [], length = NOTEBOOK_DURATION, imgs = []}) => {
  const uch = set === 'вариант 2';
  const wmap = React.useMemo(() => Object.fromEntries(words.map((x) => [x.н, x.начало])), [words]);
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const t = frame / FPS;
  const zoom = interpolate(t, [0, length], [1.0, 1.04]);   // без уменьшения и размытых полос по бокам
  const vol = interpolate(frame, [durationInFrames - 8, durationInFrames - 1], [1, 0], clamp);
  return (
    <WordsCtx.Provider value={wmap}>
    <AbsoluteFill style={{background: C.paper, overflow: 'hidden'}}>
      {/* бумага: точечная сетка */}
      <AbsoluteFill style={{backgroundImage: `radial-gradient(${C.line} 1.6px, transparent 1.8px)`, backgroundSize: '34px 34px', opacity: 0.55}} />
      {/* спикер; низ кадра растворяется в бумаге */}
      {/* «вариант 2»: без растворения — чёткая граница на SEAM − 20 и тонкая золотая линия */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: uch ? SEAM - 20 : SEAM + 60, overflow: 'hidden',
        ...(uch ? {} : {
          WebkitMaskImage: `linear-gradient(180deg, #000 0, #000 ${SEAM - 90}px, transparent ${SEAM + 50}px)`,
          maskImage: `linear-gradient(180deg, #000 0, #000 ${SEAM - 90}px, transparent ${SEAM + 50}px)`})}}>

        <div style={{position: 'absolute', left: 0, top: -shift, width: 1080, height: 1920, transformOrigin: `540px ${shift + 470}px`, transform: `scale(${zoom})`}}>
          <OffthreadVideo src={staticFile(video)} volume={vol} />
        </div>
      </div>
      {uch ? <div style={{position: 'absolute', left: 0, top: SEAM - 21, width: 1080, height: 3, background: C.caramel}} /> : null}
      {uch ? <PartsUchenik imgs={imgs} length={length} /> : <><Part1 /><Part2 /><Part3 /><Part4 /></>}
      <Subs phrases={phrases} />
      {/* плёночное зерно поверх всего */}
      <AbsoluteFill style={{pointerEvents: 'none', opacity: 0.06, mixBlendMode: 'multiply'}}>
        <svg width="100%" height="100%"><filter id="nb-grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(frame / 2)} />
          <feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter="url(#nb-grain)" /></svg>
      </AbsoluteFill>
      {uch ? <SfxUchenik /> : SFX.map((s, i) => (
        <Sequence key={i} from={sec(s.at)} durationInFrames={sec(3)} layout="none">
          <Sfx file={s.file} volume={s.vol ?? 0.3} />
        </Sequence>
      ))}
    </AbsoluteFill>
    </WordsCtx.Provider>
  );
};
