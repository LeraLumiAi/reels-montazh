// Стиль «редакция» (образец): голосовое + монохромная типографика.
// Не стиль: без «подписи автора», без золота и Playfair. Монохром: тёплая серая бумага, чёрный,
// серый; крупная типографика, слова появляются ровно когда звучат (выезжают из-под маски), ключевое —
// в чёрной плашке; простые геометрические образы; каждые 2–3 с новая сцена, часть сцен — инверсия
// (чёрный фон). Первые ~17 с — ИИ-видео (готовый кусок 1), затем «шторка» и графика.
// Границы Instagram: шапка до 245, кнопки справа x ≥ 920 при y ≥ 1235, ник с ~1740.
import '../fonts';
import {Sfx} from '../sfx';
import React, {useMemo} from 'react';
import {AbsoluteFill, Html5Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';

type WordT = {н: number; слово: string; начало: number; конец: number};
export type NeutralProps = {intro: string; introEnd: number; audio: string; words: WordT[]; length: number; tail: number};

const FPS = 30;
const P = {paper: '#ECEAE5', ink: '#111111', gray: '#8C8A85', line: '#CFCCC5', white: '#FAFAF8'};
const F = 'Onest, sans-serif';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const sec = (s: number) => Math.round(s * FPS);
const useT = () => useCurrentFrame() / FPS;
const rp = (t: number, a: number, d: number, e = Easing.out(Easing.cubic)) => interpolate(t, [a, a + d], [0, 1], {...clamp, easing: e});

const WCtx = React.createContext<Record<number, WordT>>({});
const useW = () => {
  const m = React.useContext(WCtx);
  return (n: number, end = false) => { for (let k = n; k < n + 30; k++) if (m[k]) return end ? m[k].конец : m[k].начало; return 0; };
};
const clean = (s: string) => s.replace(/[«»,.?!]/g, '');

/** Слова фразы: каждое выезжает снизу из-под маски в момент, когда звучит; ключевые — в плашке. */
const Words: React.FC<{from: number; to: number; keys?: number[]; size?: number; dark?: boolean; upper?: boolean}> = ({from, to, keys = [], size = 92, dark, upper}) => {
  const t = useT();
  const m = React.useContext(WCtx);
  const fg = dark ? P.white : P.ink, bg = dark ? P.white : P.ink, kfg = dark ? P.ink : P.white;
  const list = [];
  for (let n = from; n <= to; n++) if (m[n]) list.push(m[n]);
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', gap: `${size * 0.1}px ${size * 0.26}px`, width: 800, fontFamily: F, fontWeight: 600,
      fontSize: size, lineHeight: 1.04, letterSpacing: '-0.035em'}}>
      {list.map((w) => {
        const p = rp(t, w.начало - 0.06, 0.32, Easing.out(Easing.poly(4)));
        const key = keys.includes(w.н);
        const txt = upper ? clean(w.слово).toUpperCase() : clean(w.слово);
        return (
          <span key={w.н} style={{display: 'inline-block', overflow: 'hidden', paddingBottom: size * 0.06}}>
            <span style={{display: 'inline-block', transform: `translateY(${(1 - p) * 110}%)`, color: key ? kfg : fg,
              background: key ? bg : 'transparent', padding: key ? `0 ${size * 0.12}px` : 0, opacity: p > 0 ? 1 : 0}}>{txt}</span>
          </span>
        );
      })}
    </div>
  );
};

/** Сцена: появляется «шторкой» снизу (вверх), уходит сдвигом; dark — инверсия. */
const Scene: React.FC<{from: number; to: number; dark?: boolean; idx: number; total: number; children: React.ReactNode}> = ({from, to, dark, idx, total, children}) => {
  const t = useT();
  if (t < from - 0.02 || t > to + 0.36) return null;   // держится, пока следующая сцена не закроет её шторкой
  const wipe = rp(t, from, 0.32, Easing.inOut(Easing.cubic));
  const fg = dark ? P.white : P.ink;
  return (
    <AbsoluteFill style={{clipPath: `inset(${(1 - wipe) * 100}% 0 0 0)`, background: dark ? P.ink : P.paper}}>
      {/* тонкая сетка и счётчик кадров — «редакционная» рамка */}
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        {[110, 540, 970].map((x) => <line key={x} x1={x} y1={0} x2={x} y2={1920} stroke={dark ? '#2A2A2A' : P.line} strokeWidth={1} />)}
        {[300, 1200].map((y) => <line key={y} x1={0} y1={y} x2={1080} y2={y} stroke={dark ? '#2A2A2A' : P.line} strokeWidth={1} />)}
      </svg>
      <div style={{position: 'absolute', left: 110, top: 262, fontFamily: F, fontWeight: 500, fontSize: 24, letterSpacing: '0.2em', color: P.gray}}>
        {String(idx).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </div>
      <div style={{position: 'absolute', inset: 0, color: fg}}>{children}</div>
    </AbsoluteFill>
  );
};
const Art: React.FC<{children: React.ReactNode}> = ({children}) => (
  <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>{children}</svg>
);
const Txt: React.FC<{children: React.ReactNode; top?: number}> = ({children, top = 1230}) => (
  <div style={{position: 'absolute', left: 110, top}}>{children}</div>
);
const Lbl: React.FC<{at: number; children: React.ReactNode; dark?: boolean; top?: number}> = ({at, children, dark, top = 1170}) => (
  <div style={{position: 'absolute', left: 110, top, fontFamily: F, fontWeight: 500, fontSize: 26, letterSpacing: '0.24em',
    color: dark ? '#9A9893' : P.gray, opacity: rp(useT(), at, 0.3)}}>{children}</div>
);

const Scenes: React.FC<{length: number; tail: number}> = ({length, tail}) => {
  const w = useW();
  const t = useT();
  const B = [48, 53, 60, 69, 76, 81, 89, 96, 106, 113, 118].map((n) => w(n) - 0.12);
  const end = (i: number) => (i + 1 < B.length ? B[i + 1] : length + tail + 1);
  const N = B.length;
  const CX = 505, CY = 760;
  return (
    <>
      {/* 1 батарейка разряжается */}
      <Scene from={B[0]} to={end(0)} idx={1} total={N}>
        <Art>
          <rect x={CX - 230} y={CY - 120} width={430} height={240} rx={28} fill="none" stroke={P.ink} strokeWidth={10} />
          <rect x={CX + 206} y={CY - 48} width={34} height={96} rx={8} fill={P.ink} />
          {[0, 1, 2, 3].map((i) => {
            const gone = rp(t, w(50) + (3 - i) * 0.22, 0.2);
            return <rect key={i} x={CX - 200 + i * 100} y={CY - 90} width={80} height={180} rx={10} fill={i === 0 ? '#C0392B' : P.ink} opacity={i === 0 ? 1 : 1 - gone} />;
          })}
        </Art>
        <Lbl at={B[0]}>ЭНЕРГИЯ</Lbl>
        <Txt><Words from={48} to={52} keys={[52]} /></Txt>
      </Scene>

      {/* 2 квадрат не проходит в круглое отверстие */}
      <Scene from={B[1]} to={end(1)} idx={2} total={N}>
        <Art>
          <circle cx={CX} cy={CY + 40} r={150} fill="none" stroke={P.ink} strokeWidth={10} strokeDasharray="2 22" strokeLinecap="round" />
          {(() => {
            const k = rp(t, B[1] + 0.2, 0.7, Easing.in(Easing.quad));
            const bounce = Math.sin(rp(t, B[1] + 0.9, 0.5) * Math.PI) * 70;
            const y = CY - 420 + 360 * k - bounce;
            return <rect x={CX - 120} y={y} width={240} height={240} fill={P.ink} transform={`rotate(${bounce * 0.2} ${CX} ${y + 120})`} />;
          })()}
        </Art>
        <Lbl at={B[1]}>НЕ СОВПАДАЕТ</Lbl>
        <Txt><Words from={53} to={59} keys={[58, 59]} size={84} /></Txt>
      </Scene>

      {/* 3 слово «смысл» рассыпается, пустой круг */}
      <Scene from={B[2]} to={end(2)} idx={3} total={N}>
        <Art>
          <circle cx={CX} cy={CY} r={230} fill="none" stroke={P.line} strokeWidth={4} />
          {'СМЫСЛ'.split('').map((ch, i) => {
            const f = rp(t, w(68) + 0.3 + i * 0.07, 0.9, Easing.in(Easing.cubic));
            return <text key={i} x={CX - 230 + i * 115} y={CY + 50 + f * 300} textAnchor="middle" fill={P.ink} opacity={1 - f}
              transform={`rotate(${f * (i % 2 ? 40 : -35)} ${CX - 230 + i * 115} ${CY + 50 + f * 300})`}
              style={{fontFamily: F, fontWeight: 600, fontSize: 150, letterSpacing: '-0.04em'}}>{ch}</text>;
          })}
        </Art>
        <Lbl at={B[2]}>ЛИЧНЫЙ СМЫСЛ</Lbl>
        <Txt><Words from={60} to={68} keys={[67, 68]} size={84} /></Txt>
      </Scene>

      {/* 4 инверсия; осколки собираются в круг */}
      <Scene from={B[3]} to={end(3)} idx={4} total={N} dark>
        <Art>
          {[0, 1, 2, 3].map((i) => {
            const a = rp(t, w(74) - 0.2 + i * 0.08, 0.6, Easing.inOut(Easing.cubic));
            const dx = [-160, 170, -140, 150][i] * (1 - a), dy = [-150, -120, 160, 140][i] * (1 - a);
            const s = i * 90, e = s + 86;
            const r = 210, p1 = [CX + r * Math.cos((s * Math.PI) / 180), CY + r * Math.sin((s * Math.PI) / 180)], p2 = [CX + r * Math.cos((e * Math.PI) / 180), CY + r * Math.sin((e * Math.PI) / 180)];
            return <path key={i} d={`M ${p1[0]} ${p1[1]} A ${r} ${r} 0 0 1 ${p2[0]} ${p2[1]}`} fill="none" stroke={P.white} strokeWidth={22} strokeLinecap="round"
              transform={`translate(${dx} ${dy}) rotate(${(1 - a) * 30} ${CX} ${CY})`} opacity={rp(t, B[3] + i * 0.1, 0.3)} />;
          })}
          <circle cx={CX} cy={CY} r={18 + 30 * rp(t, w(75), 0.4)} fill={P.white} opacity={rp(t, w(75), 0.3)} />
        </Art>
        <Lbl at={B[3]} dark>ЭКЗИСТЕНЦИАЛЬНЫЙ АНАЛИЗ</Lbl>
        <Txt><Words from={74} to={75} keys={[74, 75]} size={110} dark /></Txt>
      </Scene>

      {/* 5 две половины сходятся в одну фигуру */}
      <Scene from={B[4]} to={end(4)} idx={5} total={N}>
        <Art>
          {(() => {
            const j = rp(t, w(79), 0.7, Easing.inOut(Easing.cubic));
            return <g>
              <path d={`M ${CX} ${CY - 220} A 220 220 0 0 0 ${CX} ${CY + 220} Z`} fill={P.ink} transform={`translate(${-140 * (1 - j)} 0)`} />
              <path d={`M ${CX} ${CY - 220} A 220 220 0 0 1 ${CX} ${CY + 220} Z`} fill="none" stroke={P.ink} strokeWidth={10} transform={`translate(${140 * (1 - j)} 0)`} />
            </g>;
          })()}
        </Art>
        <Lbl at={B[4]}>СОГЛАСИЕ</Lbl>
        <Txt><Words from={76} to={80} keys={[79, 80]} size={90} /></Txt>
      </Scene>

      {/* 6 огромное «ДА» штампом */}
      <Scene from={B[5]} to={end(5)} idx={6} total={N}>
        {(() => {
          const s = rp(t, w(85) - 0.05, 0.25, Easing.out(Easing.back(2)));
          const shake = t > w(85) && t < w(85) + 0.25 ? Math.sin(t * 90) * 6 : 0;
          return <div style={{position: 'absolute', left: 0, right: 160, top: 420, textAlign: 'center', fontFamily: F, fontWeight: 600, fontSize: 420,
            letterSpacing: '-0.06em', color: P.ink, transform: `translateX(${shake}px) scale(${0.4 + 0.6 * s})`, opacity: s}}>ДА</div>;
        })()}
        <Lbl at={B[5]}>ВЫБОР</Lbl>
        <Txt><Words from={81} to={88} keys={[85]} size={80} /></Txt>
      </Scene>

      {/* 7 инверсия, обложка практики */}
      <Scene from={B[6]} to={end(6)} idx={7} total={N} dark>
        <div style={{position: 'absolute', left: 110, top: 420, width: 780, fontFamily: F}}>
          <div style={{fontSize: 28, letterSpacing: '0.3em', color: '#9A9893', opacity: rp(t, w(91), 0.3)}}>ПРАКТИКА</div>
          {['Делай', 'с внутренним', 'согласием'].map((l, i) => (
            <div key={i} style={{overflow: 'hidden', paddingBottom: 12}}>
              <div style={{fontSize: 108, fontWeight: 600, letterSpacing: '-0.045em', lineHeight: 1.0, color: P.white, whiteSpace: 'nowrap',
                transform: `translateY(${(1 - rp(t, w(92) + i * 0.2, 0.4, Easing.out(Easing.poly(4)))) * 110}%)`}}>{l}</div>
            </div>
          ))}
          <div style={{marginTop: 40, height: 6, background: P.white, width: `${rp(t, w(95), 0.6) * 100}%`}} />
        </div>
        <Txt top={1290}><Words from={89} to={91} size={70} dark /></Txt>
      </Scene>

      {/* 8 путь от точки к флажку через препятствия */}
      <Scene from={B[7]} to={end(7)} idx={8} total={N}>
        <Art>
          {(() => {
            const go = rp(t, w(102), w(105, true) - w(102) + 0.3, Easing.inOut(Easing.cubic));
            const x0 = 170, x1 = 840, y = CY;
            const blocks = [330, 500, 670];
            return <g>
              <line x1={x0} y1={y} x2={x1} y2={y} stroke={P.ink} strokeWidth={6} strokeDasharray="4 18" strokeLinecap="round" />
              {blocks.map((bx, i) => {
                const gone = rp(t, w(98) + 0.2 + i * 0.35, 0.4);
                return <rect key={i} x={bx - 40} y={y - 120 + gone * 60} width={80} height={120} fill={P.ink} opacity={1 - gone} />;
              })}
              <circle cx={x0 + (x1 - x0) * go} cy={y} r={34} fill={P.ink} />
              <line x1={x1 + 30} y1={y + 40} x2={x1 + 30} y2={y - 200} stroke={P.ink} strokeWidth={8} />
              <path d={`M ${x1 + 30} ${y - 200} L ${x1 + 130} ${y - 165} L ${x1 + 30} ${y - 130} Z`} fill={P.ink} />
            </g>;
          })()}
        </Art>
        <Lbl at={B[7]}>ИССЛЕДОВАТЬ</Lbl>
        <Txt><Words from={96} to={105} keys={[98, 105]} size={74} /></Txt>
      </Scene>

      {/* 9 слово «заставлять» перечёркивается */}
      <Scene from={B[8]} to={end(8)} idx={9} total={N}>
        <div style={{position: 'absolute', left: 110, top: 600, fontFamily: F, fontWeight: 600, fontSize: 118, letterSpacing: '-0.045em', color: P.ink,
          opacity: rp(t, B[8], 0.3)}}>
          заставлять
          <div style={{position: 'absolute', left: -10, right: -10, top: '52%', height: 14, background: '#C0392B',
            transform: `scaleX(${rp(t, w(112), 0.35)})`, transformOrigin: 'left'}} />
        </div>
        <Lbl at={B[8]}>СИЛА ВОЛИ</Lbl>
        <Txt><Words from={106} to={112} keys={[110]} size={84} /></Txt>
      </Scene>

      {/* 10 шумная волна успокаивается в ровную */}
      <Scene from={B[9]} to={end(9)} idx={10} total={N}>
        <Art>
          {(() => {
            const calm = rp(t, w(116), 1.2, Easing.inOut(Easing.cubic));
            let d = '';
            for (let i = 0; i <= 160; i++) {
              const x = 110 + i * 5, ph = i * 0.16 - t * 5;
              const y = CY + Math.sin(ph) * 50 + (Math.sin(ph * 3.3) * 90 + Math.sin(ph * 7.1) * 50) * (1 - calm);
              d += `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)} `;
            }
            return <path d={d} fill="none" stroke={P.ink} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />;
          })()}
        </Art>
        <Lbl at={B[9]}>ТИШИНА</Lbl>
        <Txt><Words from={113} to={117} keys={[117]} size={90} /></Txt>
      </Scene>

      {/* 11 инверсия, стрелка вверх к шапке профиля */}
      <Scene from={B[10]} to={end(10)} idx={11} total={N} dark>
        <div style={{position: 'absolute', left: 110, top: 420, width: 780, fontFamily: F}}>
          <div style={{fontSize: 28, letterSpacing: '0.3em', color: '#9A9893'}}>ПРАКТИКА</div>
          <div style={{fontSize: 104, fontWeight: 600, letterSpacing: '-0.045em', lineHeight: 1.02, color: P.white, marginTop: 10}}>Делай с внутренним согласием</div>
        </div>
        {(() => {
          const bob = Math.sin(t * 6) * 14;
          const a = rp(t, w(120), 0.4);
          return <div style={{position: 'absolute', left: 110, top: 1010, display: 'flex', alignItems: 'center', gap: 26, opacity: a}}>
            <div style={{padding: '22px 46px', borderRadius: 999, background: P.white, color: P.ink, fontFamily: F, fontWeight: 600, fontSize: 46}}>ссылка в шапке профиля</div>
            <svg width={70} height={90} style={{transform: `translateY(${bob}px)`}}><path d="M35 82 L35 12 M10 36 L35 10 L60 36" fill="none" stroke={P.white} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>;
        })()}
        <Txt top={1290}><Words from={118} to={124} keys={[119]} size={70} dark /></Txt>
      </Scene>
    </>
  );
};

const WH = ['Whooshes/Simple Whoosh.wav', 'Whooshes/Smooth And Fast Whoosh.wav', 'Whooshes/Fast Whoosh.wav', 'Whooshes/saas whoosh.wav', 'Whooshes/Simple Whoosh 2.wav', 'Whooshes/Whoosh Deep Light 2.wav'];
const Sounds: React.FC = () => {
  const w = useW();
  const beats = [48, 53, 60, 69, 76, 81, 89, 96, 106, 113, 118].map((n) => w(n) - 0.2);
  const hits = [
    {at: w(53) + 1.05, f: 'ui/Wall Hit 1.wav', v: 0.35},           // квадрат ударился о круг
    {at: w(68) + 0.35, f: 'saas sfx/231188_Mechanics, Electronics, Micro, Glitch x3 09_cut(0003-0004).wav', v: 0.3},
    {at: w(74), f: 'Riser/Импакт 5.wav', v: 0.3},
    {at: w(79), f: 'ui/MA_Equilibrio_ModernInterface_03.wav', v: 0.35},
    {at: w(85), f: 'Riser/Импакт.wav', v: 0.4},                      // «ДА»
    {at: w(92), f: 'ui/MA_BANT_Modern_Clicks_And_Beeps_4.wav', v: 0.3},
    {at: w(112), f: 'ui/ES_Sci Fi Games, UI Menu, Very Short, Close 14 - Epidemic Sound.wav', v: 0.35},
    {at: w(120), f: 'ui/ui-pop-up-2-197887.wav', v: 0.35},
  ];
  return (
    <>
      {beats.map((b, i) => (
        <Sequence key={`b${i}`} from={Math.max(0, sec(b))} durationInFrames={sec(2)} layout="none">
          <Sfx file={WH[i % WH.length]} volume={0.3} />
        </Sequence>
      ))}
      {hits.map((h, i) => (
        <Sequence key={`h${i}`} from={Math.max(0, sec(h.at))} durationInFrames={sec(2.5)} layout="none">
          <Sfx file={h.f} volume={h.v} />
        </Sequence>
      ))}
    </>
  );
};

export const Neutral: React.FC<NeutralProps> = ({intro, introEnd, audio, words, length, tail}) => {
  const map = useMemo(() => Object.fromEntries(words.map((x) => [x.н, x])), [words]);
  const t = useCurrentFrame() / FPS;
  return (
    <WCtx.Provider value={map}>
      <AbsoluteFill style={{background: P.paper}}>
        {/* первые ~17 с — готовый ИИ-кусок с субтитрами (звук — общий, ниже) */}
        {t < introEnd + 0.5 ? <OffthreadVideo src={staticFile(intro)} muted /> : null}
        <Scenes length={length} tail={tail} />
        <Html5Audio src={staticFile(audio)} />
        <Sounds />
      </AbsoluteFill>
    </WCtx.Provider>
  );
};
