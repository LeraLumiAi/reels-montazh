// Формат «полэкрана, анимация под слова» — образец «пример 1».
// Сверху спикер с субтитрами (мельче обычных), снизу — стекло, сквозь которое размыто видна спикер
// (прозрачнее, чем в пробе 2 — пожелание пользователя), на стекле — сцены, каждая привязана к словам речи.
// Время сцен — номера слов расшифровки (как в карточки.json): w(н) — начало слова в чистом ролике.
// Стиль — «Тёплый свет» (тема «Утро»), движение и звуки — из пака звуков (VoiceGraphic.tsx).
import '../fonts';
import {Sfx} from '../sfx';
import React, {useMemo} from 'react';
import {AbsoluteFill, Freeze, Html5Audio, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import type {Phrase} from '../types';
import {Subtitles, timing} from '../Subtitles';
import {getStyle} from '../styles';
import {THEMES, ThemeCtx, CenterPad, Grain, Reveal, Scene, Em, Card, Pill, Caption, Center, useT, useSpring, useTh, MAIN, ACCENT, R, sec} from './VoiceGraphic';

type WordT = {н: number; начало: number; конец: number};
export type PolovinaProps = {video: string; phrases: Phrase[]; space: number; length: number; words: WordT[];
  shift: number; seam: number;
  /** ТикТок-дубль: призыв «напиши в комментариях» вырезан, в конце — «Забирайте подарок», кадр держится «хвост» секунд */
  tiktok?: boolean; tail?: number;
  /** какой набор сцен: «пример 1» (по умолчанию) или «вариант 2» (второй вариант, нейтральный — без подписи автора) */
  set?: 'пример 1' | 'вариант 2'};

const W = 1080;
const PANEL_BOTTOM = 1720;   // ниже — ник и подпись Instagram

const WordsCtx = React.createContext<Record<number, WordT>>({});
/** Начало слова н (сек чистого ролика); слово вырезано — ближайшее следующее. */
const useW = () => {
  const m = React.useContext(WordsCtx);
  return (n: number, end = false) => {
    for (let k = n; k < n + 40; k++) if (m[k]) return end ? m[k].конец : m[k].начало;
    return 0;
  };
};

// ---------- рисунки (линия рисуется, потом заливка светом) ----------
const Draw: React.FC<{d: string; at: number; dur?: number; width?: number; color?: string; fill?: string}> = ({d, at, dur = 0.9, width = 5, color, fill}) => {
  const th = useTh();
  const t = useT();
  const p = interpolate(t, [at, at + dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
  const f = fill ? interpolate(t, [at + dur * 0.7, at + dur + 0.3], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
  return <path d={d} pathLength={1} fill={fill ?? 'none'} fillOpacity={f} stroke={color ?? th.deep} strokeWidth={width}
    strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1} strokeDashoffset={1 - p} />;
};

const FEATHER = {
  vane: 'M100 28 C 150 60 168 160 152 262 C 142 322 118 352 100 362 C 84 342 54 300 50 230 C 46 150 60 72 100 28 Z',
  shaft: 'M100 392 C 102 300 99 160 100 40',
  barbs: ['M100 120 L 140 92', 'M100 170 L 152 140', 'M100 220 L 150 196', 'M100 150 L 60 118', 'M100 210 L 54 176', 'M100 270 L 62 246'],
};
const Feather: React.FC<{at: number; size?: number; dur?: number}> = ({at, size = 300, dur = 1.1}) => {
  const th = useTh();
  return (
    <svg width={size * 0.5} height={size} viewBox="0 0 200 400" style={{overflow: 'visible', filter: `drop-shadow(0 0 22px ${th.glow})`}}>
      <defs>
        <linearGradient id="fth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F3E3C4" /><stop offset="1" stopColor={th.gold} />
        </linearGradient>
      </defs>
      <Draw d={FEATHER.vane} at={at} dur={dur} fill="url(#fth)" color={th.deep} width={5} />
      <Draw d={FEATHER.shaft} at={at + 0.15} dur={dur * 0.8} color={th.deep} width={6} />
      {FEATHER.barbs.map((b, i) => <Draw key={i} d={b} at={at + 0.4 + i * 0.06} dur={0.35} color={th.deep} width={3} />)}
    </svg>
  );
};

const Icon: React.FC<{kind: 'облако' | 'нота' | 'перо' | 'дверь' | 'чемодан' | 'конверт'; at: number; size?: number}> = ({kind, at, size = 120}) => {
  const th = useTh();
  if (kind === 'перо') return <div style={{height: size, display: 'flex', alignItems: 'center'}}><Feather at={at} size={size} dur={0.7} /></div>;
  const paths: Record<string, string[]> = {
    'облако': ['M40 140 C 10 140 10 96 44 92 C 44 52 100 44 112 80 C 132 56 176 70 168 104 C 196 108 194 140 168 140 Z'],
    'нота': ['M80 150 C 80 130 50 130 50 150 C 50 170 80 170 80 150 Z', 'M80 150 L 80 50 L 150 36 L 150 132', 'M150 132 C 150 112 120 112 120 132 C 120 152 150 152 150 132 Z'],
    'дверь': ['M60 180 L 60 30 C 60 20 70 14 80 14 L 140 14 C 150 14 160 20 160 30 L 160 180', 'M40 180 L 180 180', 'M140 100 L 140 104'],
    'чемодан': ['M40 70 L 160 70 C 168 70 174 76 174 84 L 174 170 C 174 178 168 184 160 184 L 40 184 C 32 184 26 178 26 170 L 26 84 C 26 76 32 70 40 70 Z', 'M76 70 L 76 48 C 76 42 80 38 86 38 L 114 38 C 120 38 124 42 124 48 L 124 70', 'M26 110 L 174 110'],
    'конверт': ['M24 50 L 176 50 L 176 160 L 24 160 Z', 'M24 54 L 100 112 L 176 54'],
  };
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{overflow: 'visible'}}>
      {paths[kind].map((d, i) => <Draw key={i} d={d} at={at + i * 0.15} dur={0.7} width={8} color={th.deep}
        fill={i === 0 && kind !== 'дверь' ? th.tile : undefined} />)}
    </svg>
  );
};

/** Чип «12:12» и т. п. */
const Chip: React.FC<{at: number; children: React.ReactNode}> = ({at, children}) => {
  const th = useTh();
  return (
    <Reveal at={at} kind="bounce" from={40} scaleFrom={0.6}>
      <div style={{background: th.card, borderRadius: R.pill, padding: '14px 34px', fontSize: 52, fontWeight: 600, color: th.deep,
        boxShadow: `0 0 40px ${th.glow}, ${th.shadow}`, letterSpacing: -1}}>{children}</div>
    </Reveal>
  );
};

/** Карточка решения: подсветка (знаки пришли) и значок ✓ / ?. */
const Choice: React.FC<{at: number; n: string; glowAt?: number; mark?: '✓' | '?'; markAt?: number; dimAt?: number}> = ({at, n, glowAt, mark, markAt, dimAt}) => {
  const th = useTh();
  const t = useT();
  const g = glowAt === undefined ? 0 : interpolate(t, [glowAt, glowAt + 0.5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const dim = dimAt === undefined ? 0 : interpolate(t, [dimAt, dimAt + 0.4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const m = useSpring(markAt ?? 999, 'bounce');
  return (
    <Reveal at={at} kind="bounce" from={80} scaleFrom={0.8}>
      <div style={{position: 'relative', width: 330, height: 250, borderRadius: R.lg, background: th.card, boxSizing: 'border-box',
        border: `3px solid ${g > 0.3 ? th.gold : th.line}`, opacity: 1 - dim * 0.45,
        boxShadow: `0 0 ${20 + 70 * g}px ${g > 0 ? th.glow : 'transparent'}, ${th.shadow}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{fontSize: 30, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color: th.muted}}>Решение</div>
        <div style={{fontFamily: ACCENT, fontStyle: 'italic', fontSize: 120, lineHeight: 1, color: th.accent, fontVariantNumeric: 'lining-nums'}}>{n}</div>
        {mark ? (
          <div style={{position: 'absolute', top: -34, right: -26, width: 86, height: 86, borderRadius: 43, transform: `scale(${m})`,
            background: mark === '✓' ? th.deep : th.button, color: th.onFill, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 50, fontWeight: 600, boxShadow: `0 0 34px ${th.glow}`}}>{mark}</div>
        ) : null}
      </div>
    </Reveal>
  );
};

/** Падающее пёрышко: качается из стороны в сторону, медленно опускается. */
const Falling: React.FC<{at: number; to: number; h: number}> = ({at, to, h}) => {
  const t = useT();
  const p = interpolate(t, [at, to], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const sway = Math.sin((t - at) * 2.6) * 70;
  const rot = Math.sin((t - at) * 2.6 + 0.8) * 22 - 15;
  return (
    <div style={{position: 'absolute', left: `calc(50% - 60px + ${sway}px)`, top: -220 + p * (h + 40), transform: `rotate(${rot}deg)`,
      opacity: interpolate(t, [at, at + 0.3], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
      <Feather at={at - 2} size={220} />
    </div>
  );
};

const Title: React.FC<{at: number; size?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({at, size = 72, children, style}) => (
  <Reveal at={at} from={40} kind="snap" style={style}>
    <div style={{fontSize: size, fontWeight: 600, letterSpacing: -1.5, lineHeight: 1.12, textAlign: 'center'}}>{children}</div>
  </Reveal>
);

// ---------- сцены ----------
const Scenes: React.FC<{length: number; tiktok: boolean}> = ({length, tiktok}) => {
  // в ТикТоке слов призыва нет — карточка «Забирайте подарок» встаёт за полсекунды до конца речи
  const cta = length - 0.5;
  const th = useTh();
  const w = useW();
  const t = useT();
  // зачёркивание слова на фразе-противопоставлении
  const strike = interpolate(t, [w(223), w(224, true)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <>
      {/* 1. хук: фраза из ролика */}
      <Scene from={0} to={w(12) - 0.1}>
        <Center>
          <Reveal at={0.05} kind="snap" from={30} style={{marginBottom: 30}}><Caption dot>Подпись автора</Caption></Reveal>
          <Title at={0.2} size={76}>Как я принимаю</Title>
          <Reveal at={0.55} kind="bounce" from={50}><Em size={112}>решения</Em></Reveal>
          <Title at={w(9)} size={60} style={{marginTop: 16}}><span style={{color: th.muted, fontWeight: 400}}>— и получаю</span> <Em size={70}>ответ</Em></Title>
        </Center>
      </Scene>

      {/* 2. фраза из ролика */}
      <Scene from={w(12)} to={w(20) - 0.1}>
        <Center>
          <div style={{display: 'flex', alignItems: 'center', gap: 50}}>
            <Feather at={w(14) - 0.2} size={380} />
            <div>
              <Title at={w(14)} size={84} style={{textAlign: 'left'}}><div style={{textAlign: 'left'}}>Знаки —</div></Title>
              <Reveal at={w(16)} from={30}><div style={{fontSize: 52, color: th.muted, marginTop: 10}}>самый главный</div></Reveal>
              <Reveal at={w(19)} kind="bounce" from={40}><div style={{fontSize: 64, fontWeight: 600}}>мой <Em size={84}>знак</Em></div></Reveal>
            </div>
          </div>
        </Center>
      </Scene>

      {/* 3. фраза из ролика */}
      <Scene from={w(20)} to={w(64) - 0.1}>
        <Center>
          <Title at={w(20)} size={64}>Не знаю, какое</Title>
          <Reveal at={w(26)} kind="bounce" from={40}><Em size={96}>решение</Em></Reveal>
          <Reveal at={w(31)} kind="bounce" from={50} scaleFrom={0.6} style={{marginTop: 30}}>
            <Pill style={{fontSize: 44, padding: '16px 42px'}}>задаю себе вопрос</Pill>
          </Reveal>
          <Reveal at={w(50)} from={30} style={{marginTop: 38}}>
            <div style={{fontSize: 46, color: th.muted}}>и открыта видеть <span style={{color: th.ink, fontWeight: 600}}>знаки</span></div>
          </Reveal>
          <div style={{display: 'flex', gap: 24, marginTop: 24}}>
            <Chip at={w(53)}>12:12</Chip>
            <Chip at={w(54)}>777</Chip>
            <Chip at={w(54) + 0.25}>333</Chip>
          </div>
        </Center>
      </Scene>

      {/* 4. фраза из ролика */}
      <Scene from={w(64)} to={w(107) - 0.1}>
        <Center>
          <Title at={w(64)} size={64}>Приходят <Em size={80}>знаки</Em>?</Title>
          <div style={{display: 'flex', gap: 50, marginTop: 50}}>
            <Choice at={w(67)} n="1" glowAt={w(72)} mark="✓" markAt={w(76)} />
            <Choice at={w(89)} n="2" mark="?" markAt={w(102)} />
          </div>
        </Center>
      </Scene>

      {/* 5. фраза из ролика */}
      <Scene from={w(107)} to={w(133) - 0.1}>
        <Center>
          <Reveal at={w(107)} kind="snap" from={30}><Caption dot>Мои знаки</Caption></Reveal>
          <div style={{display: 'flex', gap: 40, marginTop: 40, alignItems: 'flex-end'}}>
            {([['перо', 117, 'пёрышки'], ['облако', 122, 'облака'], ['нота', 130, 'музыка']] as const).map(([k, n, label]) => (
              <Reveal key={k} at={w(n) - 0.1} kind="bounce" from={60} scaleFrom={0.7}>
                <Card style={{width: 230, height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22}}>
                  <Icon kind={k} at={w(n) - 0.3} size={k === 'перо' ? 150 : 130} />
                  <div style={{fontSize: 38, fontWeight: 600}}>{label}</div>
                </Card>
              </Reveal>
            ))}
          </div>
        </Center>
      </Scene>

      {/* 6. история с примером: фраза из ролика */}
      <Scene from={w(133)} to={w(177) - 0.1}>
        <Center>
          <Title at={w(133)} size={60}>Новый <Em size={74}>проект</Em></Title>
          <div style={{position: 'relative', width: 620, height: 330, marginTop: 30}}>
            <div style={{position: 'absolute', left: 190, top: 0}}><Icon kind="дверь" at={w(136)} size={280} /></div>
            <div style={{position: 'absolute', left: 20, top: 150}}><Icon kind="чемодан" at={w(149) - 0.2} size={150} /></div>
            <div style={{position: 'absolute', left: 450, top: 150}}><Icon kind="чемодан" at={w(149)} size={150} /></div>
            {/* пёрышко у порога */}
            <div style={{position: 'absolute', left: 300, top: 222, transform: 'rotate(-72deg)', transformOrigin: 'center'}}>
              <Reveal at={w(153)} kind="bounce" from={-80}><Feather at={w(153)} size={150} dur={0.6} /></Reveal>
            </div>
          </div>
          <Reveal at={w(172)} kind="bounce" from={40} scaleFrom={0.7} style={{marginTop: 10}}>
            <Pill style={{fontSize: 44, padding: '14px 40px'}}>это знак для нас</Pill>
          </Reveal>
        </Center>
      </Scene>

      {/* 7. фраза из ролика */}
      <Scene from={w(177)} to={w(200) - 0.1}>
        <AbsoluteFill>
          <Falling at={w(193) - 0.3} to={w(200) + 0.2} h={560} />
        </AbsoluteFill>
        <Center>
          <Title at={w(180)} size={60}><span style={{color: th.muted, fontWeight: 400}}>думаю о</span> <Em size={76}>вопросе</Em></Title>
          <Reveal at={w(197)} from={30} style={{marginTop: 300}}>
            <div style={{fontSize: 52, fontWeight: 600}}>и спускается <Em size={66}>пёрышко</Em></div>
          </Reveal>
        </Center>
      </Scene>

      {/* 8. фраза из ролика */}
      <Scene from={w(200)} to={w(210) - 0.1}>
        <Center>
          <Title at={w(200)} size={68}>Таких историй —</Title>
          <Reveal at={w(205)} kind="bounce" from={40}><Em size={110}>очень много</Em></Reveal>
          <Reveal at={w(207)} kind="bounce" from={40} scaleFrom={0.6} style={{marginTop: 30}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 16, background: th.card, borderRadius: R.pill, padding: '14px 34px',
              boxShadow: th.shadow, fontSize: 40, fontWeight: 600}}>
              <span style={{width: 18, height: 18, borderRadius: 9, background: '#C8553D', boxShadow: '0 0 16px 4px rgba(200,85,61,0.5)',
                opacity: 0.55 + 0.45 * Math.abs(Math.sin(t * 3))}} />
              на прямых эфирах
            </div>
          </Reveal>
        </Center>
      </Scene>

      {/* 9. фраза из ролика */}
      <Scene from={w(210)} to={w(227) - 0.1}>
        <Center>
          <Reveal at={w(210)} from={30}><div style={{fontSize: 46, color: th.muted}}>люди называют это</div></Reveal>
          <Reveal at={w(216)} kind="bounce" from={40}>
            <div style={{position: 'relative', fontFamily: ACCENT, fontStyle: 'italic', fontSize: 120, color: strike > 0 ? th.muted : th.accent, lineHeight: 1.2}}>
              чудеса
              <div style={{position: 'absolute', left: -10, top: '55%', height: 8, borderRadius: 4, background: th.deep, width: `${strike * 104}%`}} />
            </div>
          </Reveal>
          <Reveal at={w(225)} kind="bounce" from={60} scaleFrom={0.5} style={{marginTop: 10}}>
            <div style={{fontSize: 64, fontWeight: 600}}>это <Em size={118}>данность</Em></div>
          </Reveal>
        </Center>
      </Scene>

      {/* 10. фраза из ролика */}
      <Scene from={w(227)} to={tiktok ? cta - 0.05 : w(234) - 0.1}>
        <Center>
          <Title at={w(229)} size={76}>Высшие силы</Title>
          <Reveal at={w(231)} kind="bounce" from={50}><Em size={118}>всегда с нами</Em></Reveal>
        </Center>
      </Scene>

      {/* 11. призыв: фраза из ролика */}
      {tiktok ? (
        <Scene from={cta} to={length + 99}>
          <Center>
            <div style={{display: 'flex', alignItems: 'center', gap: 46}}>
              <div>
                <Reveal at={cta} kind="snap" from={30}><Caption dot>Подпись автора</Caption></Reveal>
                <Title at={cta + 0.1} size={70} style={{marginTop: 18}}><div style={{textAlign: 'left'}}>Забирайте</div></Title>
                <Reveal at={cta + 0.3} kind="bounce" from={40}><Em size={96}>подарок</Em></Reveal>
                <Reveal at={cta + 0.5} from={30}><div style={{fontSize: 38, color: th.muted, marginTop: 10}}>по ссылке<br />в шапке профиля</div></Reveal>
              </div>
              <Reveal at={cta + 0.4} kind="bounce" from={80} scaleFrom={0.7}>
                <div style={{width: 250, height: 320, background: th.card, borderRadius: 18, rotate: '4deg', boxShadow: `0 0 70px ${th.glow}, ${th.shadow}`,
                  padding: 24, boxSizing: 'border-box', display: 'flex', flexDirection: 'column'}}>
                  <div style={{fontSize: 20, fontWeight: 500, letterSpacing: '0.16em', color: th.muted}}>ПОДАРОК</div>
                  <div style={{marginTop: 18}}><Icon kind="конверт" at={cta + 0.5} size={150} /></div>
                  <div style={{marginTop: 'auto', fontSize: 38, fontWeight: 600, lineHeight: 1.1}}>Название<br /><Em size={42}>подарка</Em></div>
                </div>
              </Reveal>
            </div>
          </Center>
        </Scene>
      ) : null}
      {tiktok ? null : <Scene from={w(234)} to={length + 5}>
        <Center>
          <div style={{display: 'flex', alignItems: 'center', gap: 46}}>
            <div>
              <Reveal at={w(234)} kind="snap" from={30}><Caption dot>Подарок</Caption></Reveal>
              <Title at={w(235)} size={70} style={{marginTop: 18}}><div style={{textAlign: 'left'}}>Напиши</div></Title>
              <Reveal at={w(238)} kind="bounce" from={40}><Em size={96}>«Слово»</Em></Reveal>
              <Reveal at={w(240)} from={30}><div style={{fontSize: 38, color: th.muted, marginTop: 10}}>в комментариях —<br />пришлю подарок</div></Reveal>
            </div>
            <Reveal at={w(244)} kind="bounce" from={80} scaleFrom={0.7}>
              <div style={{width: 250, height: 320, background: th.card, borderRadius: 18, rotate: '4deg', boxShadow: `0 0 70px ${th.glow}, ${th.shadow}`,
                padding: 24, boxSizing: 'border-box', display: 'flex', flexDirection: 'column'}}>
                <div style={{fontSize: 20, fontWeight: 500, letterSpacing: '0.16em', color: th.muted}}>ПОДАРОК</div>
                <div style={{marginTop: 18}}><Icon kind="конверт" at={w(244) + 0.1} size={150} /></div>
                <div style={{marginTop: 'auto', fontSize: 38, fontWeight: 600, lineHeight: 1.1}}>Название<br /><Em size={42}>подарка</Em></div>
              </div>
            </Reveal>
          </div>
        </Center>
      </Scene>}
    </>
  );
};

// ---------- набор «вариант 2» (второй вариант, 2/3 человек + 1/3 анимация; слова 70–131) ----------
/** Человечек: голова + плечи; рисуется линией, size — рост. */
const Person: React.FC<{at: number; size: number; color?: string; fill?: string}> = ({at, size, color, fill}) => {
  const th = useTh();
  return (
    <svg width={size * 0.6} height={size} viewBox="0 0 120 200" style={{overflow: 'visible'}}>
      <Draw d="M60 10 C 86 10 86 66 60 66 C 34 66 34 10 60 10 Z" at={at} dur={0.5} width={9} color={color ?? th.deep} fill={fill ?? th.gold} />
      <Draw d="M12 196 C 12 120 32 84 60 84 C 88 84 108 120 108 196 Z" at={at + 0.2} dur={0.6} width={9} color={color ?? th.deep} fill={fill ?? th.gold} />
    </svg>
  );
};
const Grow: React.FC<{from: number; to: number; at: number; dur?: number; children: React.ReactNode}> = ({from, to, at, dur = 1.2, children}) => {
  const t = useT();
  const k = interpolate(t, [at, at + dur], [from, to], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
  return <div style={{transform: `scale(${k})`, transformOrigin: '50% 100%'}}>{children}</div>;
};
// «не дублировать слова, написанные в субтитрах» — сцены без текста речи,
// объёмные «глиняные» фигурки (свет сверху-слева, тень на полу), лёгкое покачивание в перспективе.
const CLAY = {
  gold: {hi: '#FFF4D8', base: '#D9B36C', lo: '#8A6446'},
  gray: {hi: '#EEE7DF', base: '#A89888', lo: '#4A3D34'},
};
const Pawn: React.FC<{at: number; size: number; tone?: 'gold' | 'gray'; label?: string; sway?: number}> = ({at, size, tone = 'gold', label, sway = 0}) => {
  const t = useT();
  const p = useSpring(at, 'bounce');
  const c = CLAY[tone];
  const rot = Math.sin((t + sway) * 1.3) * 14;
  const bob = Math.sin((t + sway) * 2) * 4;
  const ball = (w: number) => `radial-gradient(circle at 34% 28%, ${c.hi} 0%, ${c.base} ${w}%, ${c.lo} 100%)`;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: interpolate(p, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'}),
      transform: `translateY(${(1 - p) * 60 + bob}px) scale(${0.6 + 0.4 * p})`}}>
      <div style={{transform: `perspective(900px) rotateY(${rot}deg)`, transformStyle: 'preserve-3d', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{width: size * 0.42, height: size * 0.42, borderRadius: '50%', background: ball(55),
          boxShadow: `inset -${size * 0.04}px -${size * 0.05}px ${size * 0.08}px rgba(0,0,0,0.25), 0 ${size * 0.03}px ${size * 0.06}px rgba(0,0,0,0.18)`}} />
        <div style={{width: size * 0.78, height: size * 0.6, marginTop: size * 0.03, borderRadius: '50% 50% 22% 22% / 62% 62% 22% 22%', background: ball(50),
          boxShadow: `inset -${size * 0.06}px -${size * 0.06}px ${size * 0.12}px rgba(0,0,0,0.28), inset ${size * 0.03}px ${size * 0.03}px ${size * 0.06}px rgba(255,255,255,0.35)`}} />
      </div>
      {/* тень на «полу» */}
      <div style={{width: size * 0.9, height: size * 0.12, marginTop: -size * 0.04, borderRadius: '50%', background: 'rgba(40,30,20,0.35)', filter: `blur(${size * 0.05}px)`}} />
      {label ? <div style={{marginTop: 8, fontFamily: MAIN, fontWeight: 600, fontSize: Math.max(40, size * 0.2), color: c.lo}}>{label}</div> : null}
    </div>
  );
};
/** Объёмный знак: буквы с выдавленным краем (слои тени), покачивается. */
const Glyph3D: React.FC<{at: number; ch: string; size: number}> = ({at, ch, size}) => {
  const t = useT();
  const p = useSpring(at, 'bounce');
  const depth = Array.from({length: 10}, (_, i) => `${i + 1}px ${i + 1}px 0 #8A6446`).join(', ');
  return (
    <div style={{transform: `perspective(900px) rotateY(${Math.sin(t * 1.4) * 22}deg) rotateX(8deg) scale(${p})`,
      fontFamily: ACCENT, fontStyle: 'italic', fontSize: size, lineHeight: 1, color: '#E9C77E',
      textShadow: `${depth}, 14px 22px 30px rgba(40,30,20,0.35)`}}>{ch}</div>
  );
};
/** Объёмная стрелка давления (от большого к маленькому). */
const Arrow3D: React.FC<{at: number; w: number}> = ({at, w}) => {
  const t = useT();
  const k = interpolate(t, [at, at + 0.6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  return (
    <div style={{display: 'flex', alignItems: 'center', transform: `perspective(800px) rotateX(18deg)`, opacity: k}}>
      <div style={{width: (w - 50) * k, height: 26, borderRadius: 13, background: 'linear-gradient(180deg, #E08A6A, #A65A3F 60%, #6E3A28)',
        boxShadow: '0 10px 18px rgba(80,30,15,0.35)'}} />
      <div style={{width: 0, height: 0, borderTop: '30px solid transparent', borderBottom: '30px solid transparent', borderLeft: '50px solid #A65A3F',
        filter: 'drop-shadow(0 10px 8px rgba(80,30,15,0.35))', marginLeft: -4}} />
    </div>
  );
};
// ---- набор «вариант 2», вторая версия («анимация должна меняться постоянно, как в образце «голос и графика»») ----
// Тёмное стекло, тонкая светящаяся линейная графика (как Kosmos.tsx), новая мини-сцена на каждой фразе (~2 с).
// Рисуем прямо в координатах панели: ширина 1080, высота PH; центр сцены x = 490 (справа кнопки Instagram).
const PH = 440, SX = 490, SY = 200;
const LC = {line: '#EADBC2', dim: 'rgba(234,219,194,0.35)', gold: '#E6C27C', gold2: '#F6D894', red: '#E08A6A', white: '#F7F2EA', glow: 'rgba(230,194,124,0.55)'};
const rp = (t: number, a: number, d: number, e = Easing.out(Easing.cubic)) => interpolate(t, [a, a + d], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e});
const LDefs: React.FC = () => (
  <defs>
    <filter id="ug" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    <filter id="ug2" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="12" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    <radialGradient id="ulight"><stop offset="0" stopColor="#FFF6DC" /><stop offset="0.35" stopColor={LC.gold2} stopOpacity="0.8" /><stop offset="1" stopColor={LC.gold} stopOpacity="0" /></radialGradient>
  </defs>
);
const L: React.FC<{d: string; p?: number; c?: string; w?: number; o?: number; g?: boolean}> = ({d, p = 1, c = LC.line, w = 3, o = 1, g = true}) => (
  <path d={d} pathLength={1} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray={1} strokeDashoffset={1 - Math.max(0, Math.min(1, p))} opacity={o} filter={g ? 'url(#ug)' : undefined} />
);
const Dot: React.FC<{x: number; y: number; p: number; r?: number; c?: string}> = ({x, y, p, r = 4, c = LC.white}) => p <= 0 ? null : (
  <g opacity={Math.min(1, p * 1.5)}><circle cx={x} cy={y} r={r * 3 * p} fill={LC.glow} opacity={0.35} /><circle cx={x} cy={y} r={r * p} fill={c} filter="url(#ug)" /></g>
);
/** Контурная фигурка: ноги на y, рост s. */
const fig = (x: number, y: number, s: number) =>
  `M ${x} ${y - s * 0.86} m -${s * 0.1} 0 a ${s * 0.1} ${s * 0.1} 0 1 0 ${s * 0.2} 0 a ${s * 0.1} ${s * 0.1} 0 1 0 -${s * 0.2} 0 ` +
  `M ${x} ${y - s * 0.75} L ${x} ${y - s * 0.38} L ${x - s * 0.13} ${y} M ${x} ${y - s * 0.38} L ${x + s * 0.13} ${y} ` +
  `M ${x} ${y - s * 0.66} L ${x - s * 0.16} ${y - s * 0.4} M ${x} ${y - s * 0.66} L ${x + s * 0.16} ${y - s * 0.4}`;
const Tx: React.FC<{x: number; y: number; at: number; children: React.ReactNode; c?: string; size?: number}> = ({x, y, at, children, c = LC.gold, size = 30}) => (
  <text x={x} y={y} textAnchor="middle" fill={c} opacity={rp(useT(), at, 0.35)} style={{fontFamily: MAIN, fontWeight: 600, fontSize: size, letterSpacing: '0.18em'}}>{children}</text>
);
const UShot: React.FC<{from: number; to: number; children: React.ReactNode}> = ({from, to, children}) => {
  const t = useT();
  if (t < from - 0.05 || t > to + 0.3) return null;
  const i = rp(t, from, 0.3), o = interpolate(t, [to - 0.05, to + 0.22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const drift = interpolate(t, [from, to], [1, 1.04], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{opacity: i * (1 - o), transform: `scale(${(1.08 - 0.08 * i) * drift - o * 0.03})`, transformOrigin: `${SX}px ${SY}px`,
      filter: i < 1 || o > 0 ? `blur(${(1 - i) * 8 + o * 8}px)` : undefined}}>
      <svg width={1080} height={PH} viewBox={`0 0 1080 ${PH}`} style={{overflow: 'visible'}}><LDefs />{children}</svg>
    </AbsoluteFill>
  );
};
const BEATS_U = [70, 74, 77, 80, 93, 95, 101, 103, 109, 114, 119, 123, 127];
const ScenesUchenik: React.FC<{length: number}> = ({length}) => {
  const w = useW();
  const t = useT();
  const b = BEATS_U.map((n) => w(n) - 0.06);
  const e = (i: number) => (i + 1 < b.length ? b[i + 1] : length + 5);
  const G = SY + 170;   // линия «пола»
  return (
    <>
      {/* знак вопроса из звёзд, вокруг вращается кольцо */}
      <UShot from={b[0]} to={e(0)}>
        {(() => {
          const pts: [number, number][] = [[SX - 60, SY - 90], [SX - 30, SY - 130], [SX + 30, SY - 130], [SX + 65, SY - 85], [SX + 40, SY - 30], [SX, SY], [SX, SY + 50]];
          return <g>
            {pts.slice(0, -1).map((p, i) => <L key={i} d={`M ${p[0]} ${p[1]} L ${pts[i + 1][0]} ${pts[i + 1][1]}`} p={rp(t, b[0] + i * 0.12, 0.2)} c={LC.dim} w={2} g={false} />)}
            {pts.map((p, i) => <Dot key={i} x={p[0]} y={p[1]} p={rp(t, b[0] + i * 0.12, 0.2)} r={5} c={LC.gold2} />)}
            <Dot x={SX} y={SY + 110} p={rp(t, w(73), 0.3)} r={9} c={LC.gold2} />
            <circle cx={SX} cy={SY} r={180} fill="none" stroke={LC.gold} strokeWidth={2} strokeDasharray="8 14" transform={`rotate(${t * 40} ${SX} ${SY})`} opacity={rp(t, b[0], 0.4)} />
          </g>;
        })()}
      </UShot>
      {/* поворот: вспышка, лучи */}
      <UShot from={b[1]} to={e(1)}>
        {Array.from({length: 20}, (_, i) => {
          const a = (i / 20) * Math.PI * 2, p = rp(t, b[1] + (i % 4) * 0.04, 0.5);
          return <L key={i} d={`M ${SX + Math.cos(a) * 40} ${SY + Math.sin(a) * 40} L ${SX + Math.cos(a) * (40 + 150 * p)} ${SY + Math.sin(a) * (40 + 150 * p)}`} c={i % 2 ? LC.gold : LC.dim} w={2} g={false} />;
        })}
        <circle cx={SX} cy={SY} r={36 + 8 * Math.sin(t * 5)} fill="url(#ulight)" />
      </UShot>
      {/* маленькая фигурка в тесном кольце */}
      <UShot from={b[2]} to={e(2)}>
        <circle cx={SX} cy={SY + 60} r={110} fill="none" stroke={LC.dim} strokeWidth={3} />
        <circle cx={SX} cy={SY + 60} r={110} fill="none" stroke={LC.gold} strokeWidth={3} strokeDasharray="2 22" transform={`rotate(${-t * 30} ${SX} ${SY + 60})`} />
        <L d={fig(SX, SY + 140, 150)} p={rp(t, b[2], 0.7)} />
        <Tx x={SX} y={G + 50} at={b[2] + 0.3} c={LC.gold2}>Я</Tx>
      </UShot>
      {/* фигура вырастает, кольцо рассыпается звёздами */}
      <UShot from={b[3]} to={e(3)}>
        {(() => {
          const g = rp(t, b[3] + 0.2, 0.9, Easing.inOut(Easing.cubic));
          return <g>
            {Array.from({length: 18}, (_, i) => {
              const a = (i / 18) * Math.PI * 2, r = 110 + 260 * g;
              return <Dot key={i} x={SX + Math.cos(a) * r} y={SY + 60 + Math.sin(a) * r * 0.55} p={1 - g * 0.6} r={4} c={LC.gold2} />;
            })}
            <L d={fig(SX, G, 150 + 190 * g)} c={g > 0.5 ? LC.gold2 : LC.line} w={3.5} />
            <circle cx={SX} cy={G - (150 + 190 * g) * 0.6} r={10 + 20 * g} fill="url(#ulight)" />
          </g>;
        })()}
      </UShot>
      {/* появляется вторая фигура, над головой знак вопроса */}
      <UShot from={b[4]} to={e(4)}>
        <L d={fig(SX + 120, G, 300)} p={rp(t, b[4], 0.8)} c={LC.dim} />
        <L d={fig(SX - 160, G, 170)} p={1} c={LC.gold2} />
        <text x={SX + 120} y={G - 330} textAnchor="middle" fill={LC.gold} opacity={rp(t, w(94), 0.4)} style={{fontFamily: MAIN, fontSize: 60, fontWeight: 600}}>?</text>
        <Tx x={SX + 120} y={G + 46} at={b[4] + 0.3} c={LC.line} size={26}>НЕЗНАКОМЕЦ</Tx>
        <Tx x={SX - 160} y={G + 46} at={b[4] + 0.3} c={LC.gold2} size={26}>Я</Tx>
      </UShot>
      {/* его тень растёт и накрывает меня */}
      <UShot from={b[5]} to={e(5)}>
        {(() => {
          const g = rp(t, b[5], 2, Easing.inOut(Easing.cubic));
          return <g>
            <ellipse cx={SX - 60 - 90 * g} cy={G + 4} rx={200 + 160 * g} ry={16} fill="rgba(0,0,0,0.55)" style={{filter: 'blur(6px)'}} />
            <L d={fig(SX + 120, G, 280 + 50 * g)} c={LC.line} />
            <L d={fig(SX - 160, G, 170 - 30 * g)} c={LC.gold2} o={0.6} />
            <Tx x={SX + 120} y={G + 46} at={b[5]} c={LC.line} size={26}>НЕЗНАКОМЕЦ</Tx>
          </g>;
        })()}
      </UShot>
      {/* вокруг него вспыхивает колючая аура */}
      <UShot from={b[6]} to={e(6)}>
        {(() => {
          let d = '';
          for (let i = 0; i <= 36; i++) {
            const a = (i / 36) * Math.PI * 2, r = (i % 2 ? 120 : 160) + 8 * Math.sin(t * 9 + i);
            d += `${i ? 'L' : 'M'} ${SX + 120 + Math.cos(a) * r * 0.75} ${SY + 20 + Math.sin(a) * r} `;
          }
          return <g>
            <L d={d + 'Z'} p={rp(t, b[6], 0.6)} c={LC.red} w={2.5} />
            <L d={fig(SX + 120, G, 330)} c={LC.line} />
            <L d={fig(SX - 200, G, 140)} c={LC.gold2} o={0.6} />
            <Tx x={SX + 330} y={SY - 60} at={w(101)} c={LC.red} size={30}>ОПАСНО</Tx>
          </g>;
        })()}
      </UShot>
      {/* свет переходит от меня к нему */}
      <UShot from={b[7]} to={e(7)}>
        {(() => {
          const m = rp(t, w(105), 1.6, Easing.inOut(Easing.cubic));
          const x = SX - 200 + 320 * m, y = G - 120 - Math.sin(m * Math.PI) * 120;
          return <g>
            <L d={fig(SX + 120, G, 330)} c={LC.line} />
            <L d={fig(SX - 200, G, 140)} c={LC.gold2} />
            <L d={`M ${SX - 200} ${G - 120} Q ${SX - 40} ${G - 260} ${SX + 120} ${G - 120}`} c={LC.dim} w={2} g={false} p={m} />
            <circle cx={x} cy={y} r={22} fill="url(#ulight)" filter="url(#ug2)" />
            <Tx x={SX - 200} y={G + 46} at={b[7]} c={LC.gold2} size={26}>Я</Tx>
            <Tx x={SX + 120} y={G + 46} at={b[7]} c={LC.line} size={26}>НЕЗНАКОМЕЦ</Tx>
          </g>;
        })()}
      </UShot>
      {/* от его руки ко мне тянутся нити, как у марионетки */}
      <UShot from={b[8]} to={e(8)}>
        <L d={fig(SX + 120, G, 330)} c={LC.line} />
        <L d={fig(SX - 200, G, 140)} c={LC.gold2} />
        {[-30, 0, 30].map((dx, i) => (
          <L key={i} d={`M ${SX + 60} ${G - 230} Q ${SX - 80} ${G - 300} ${SX - 200 + dx} ${G - 120 + Math.abs(dx)}`} p={rp(t, b[8] + 0.2 + i * 0.15, 0.6)} c={LC.red} w={2} />
        ))}
        <Tx x={SX - 40} y={G - 320} at={w(113)} c={LC.red} size={28}>КОНТРОЛЬ</Tx>
      </UShot>
      {/* волны давят на маленькую фигурку */}
      <UShot from={b[9]} to={e(9)}>
        <L d={fig(SX + 160, G, 330)} c={LC.line} />
        <L d={fig(SX - 220, G, 130)} c={LC.gold2} />
        {[0, 1, 2, 3].map((k) => {
          const p = ((t - b[9]) * 0.9 + k * 0.25) % 1;
          const x = SX + 80 - p * 220;
          return <L key={k} d={`M ${x} ${G - 220} Q ${x - 40} ${G - 140} ${x} ${G - 60}`} c={LC.red} w={3} o={Math.sin(p * Math.PI)} />;
        })}
      </UShot>
      {/* нити рвутся, вспышка */}
      <UShot from={b[10]} to={e(10)}>
        {(() => {
          const s = rp(t, b[10] + 0.2, 0.5);
          return <g>
            <L d={fig(SX + 160, G, 330)} c={LC.line} o={1 - 0.4 * s} />
            <L d={fig(SX - 200, G, 140 + 60 * s)} c={LC.gold2} />
            {[-30, 0, 30].map((dx, i) => <g key={i} opacity={1 - s}>
              <L d={`M ${SX + 90} ${G - 230} L ${SX - 20 - 40 * s} ${G - 260 + 30 * s + dx}`} c={LC.red} w={2} />
              <L d={`M ${SX - 80 + 30 * s} ${G - 250 + dx} L ${SX - 200 + dx} ${G - 140 + 40 * s}`} c={LC.red} w={2} />
            </g>)}
            <circle cx={SX - 50} cy={G - 230} r={20 + 120 * s} fill="url(#ulight)" opacity={(1 - s) * 0.9 + 0.1} />
          </g>;
        })()}
      </UShot>
      {/* фигурка и её отражение в зеркале-линии */}
      <UShot from={b[11]} to={e(11)}>
        <L d={fig(SX, SY + 110, 240)} c={LC.gold2} />
        <L d={`M ${SX - 300} ${SY + 125} L ${SX + 300} ${SY + 125}`} p={rp(t, b[11], 0.6)} c={LC.line} w={2} />
        <g transform={`translate(0 ${2 * (SY + 125)}) scale(1 -1)`} opacity={0.35 * rp(t, w(126), 0.5)}><L d={fig(SX, SY + 110, 240)} c={LC.gold2} /></g>
        <circle cx={SX} cy={SY + 110 - 240 * 0.86} r={46} fill="none" stroke={LC.gold} strokeWidth={2} strokeDasharray="4 8" opacity={rp(t, w(126), 0.4)} transform={`rotate(${t * 40} ${SX} ${SY + 110 - 240 * 0.86})`} />
      </UShot>
      {/* две равные фигуры на одной линии, между ними «=» */}
      <UShot from={b[12]} to={e(12)}>
        {(() => {
          const g = rp(t, b[12], 1, Easing.inOut(Easing.cubic));
          return <g>
            <L d={`M ${SX - 380} ${G} L ${SX + 380} ${G}`} c={LC.dim} w={2} g={false} />
            <L d={fig(SX + 200, G, 330 - 90 * g)} c={LC.line} />
            <L d={fig(SX - 200, G, 160 + 130 * g)} c={LC.gold2} />
            <L d={`M ${SX - 40} ${G - 170} L ${SX + 40} ${G - 170} M ${SX - 40} ${G - 140} L ${SX + 40} ${G - 140}`} p={rp(t, w(130), 0.4)} c={LC.gold2} w={6} />
            <circle cx={SX} cy={G - 155} r={20 + 60 * rp(t, w(130), 0.5)} fill="url(#ulight)" opacity={0.6} />
            <Tx x={SX - 200} y={G + 46} at={b[12]} c={LC.gold2} size={26}>Я</Tx>
            <Tx x={SX + 200} y={G + 46} at={b[12]} c={LC.line} size={26}>НЕЗНАКОМЕЦ</Tx>
          </g>;
        })()}
      </UShot>
    </>
  );
};
const useSfxUchenik = () => {
  const w = useW();
  const wh = ['Whooshes/Simple Whoosh.wav', 'Whooshes/Smooth And Fast Whoosh.wav', 'Whooshes/Simple Whoosh 2.wav', 'Whooshes/Slow And Smooth Whoosh.wav',
    'Whooshes/Fast Whoosh.wav', 'Whooshes/Smooth Like A Butter Whoosh.wav', 'Whooshes/Whoosh Deep Light 2.wav', 'Whooshes/saas whoosh.wav'];
  const beats = [70, 74, 77, 80, 93, 95, 101, 103, 109, 114, 119, 123, 127];
  const list = beats.map((n, i) => ({at: w(n) - 0.18, file: wh[i % wh.length], vol: 0.3}));
  return list.concat([
    {at: w(80) + 0.2, file: 'Riser/Разгон 2.wav', vol: 0.22},
    {at: w(101) + 0.1, file: 'Riser/Импакт 4.wav', vol: 0.26},
    {at: w(119) + 0.2, file: 'Riser/Импакт.wav', vol: 0.26},
    {at: w(130), file: 'Riser/Импакт (колокольчик).wav', vol: 0.3},
  ]);
};

// ---------- звуки (пак звуков): вжух на смене сцены, хлопок на главном появлении ----------
const useSfx = (tiktok: boolean, length: number) => {
  const w = useW();
  const list = [
    {at: 0.0, file: 'Whooshes/Smooth Like A Butter Whoosh.wav', vol: 0.3},
    {at: 0.55, file: 'Pop/Premium And Smooth Pop.wav', vol: 0.35},
    {at: w(12) - 0.1, file: 'Whooshes/Simple Whoosh.wav', vol: 0.25},
    {at: w(19), file: 'Pop/Smooth Pop.wav', vol: 0.35},
    {at: w(20) - 0.1, file: 'Whooshes/Simple Whoosh.wav', vol: 0.25},
    {at: w(31), file: 'Pop/Sweet UI Open.wav', vol: 0.35},
    {at: w(53), file: 'Clicks/High Click.wav', vol: 0.3},
    {at: w(54), file: 'Clicks/High Click.wav', vol: 0.3},
    {at: w(64) - 0.1, file: 'Whooshes/Smooth And Fast Whoosh.wav', vol: 0.25},
    {at: w(76), file: 'Pop/Premium And Smooth Pop.wav', vol: 0.4},
    {at: w(89), file: 'Ui Sound Effects/UI Premium Open.wav', vol: 0.3},
    {at: w(102), file: 'Pop/Smooth Pop.wav', vol: 0.3},
    {at: w(107) - 0.1, file: 'Whooshes/Simple Whoosh.wav', vol: 0.25},
    {at: w(117), file: 'Pop/Smooth Pop.wav', vol: 0.3},
    {at: w(122), file: 'Pop/Smooth Pop.wav', vol: 0.3},
    {at: w(130), file: 'Pop/Smooth Pop.wav', vol: 0.3},
    {at: w(133) - 0.1, file: 'Whooshes/Smooth Like A Butter Whoosh.wav', vol: 0.25},
    {at: w(153), file: 'Pop/Sweet UI Open.wav', vol: 0.35},
    {at: w(172), file: 'Pop/Premium And Smooth Pop.wav', vol: 0.35},
    {at: w(177) - 0.1, file: 'Whooshes/Simple Whoosh.wav', vol: 0.25},
    {at: w(200) - 0.1, file: 'Whooshes/Simple Whoosh.wav', vol: 0.25},
    {at: w(207), file: 'Ui Sound Effects/UI Premium Open.wav', vol: 0.3},
    {at: w(210) - 0.1, file: 'Whooshes/Smooth And Fast Whoosh.wav', vol: 0.25},
    {at: w(223), file: 'Ui Sound Effects/Ui BackSpace.wav', vol: 0.35},
    {at: w(225), file: 'Pop/Premium And Smooth Pop.wav', vol: 0.4},
    {at: w(227) - 0.1, file: 'Whooshes/Simple Whoosh.wav', vol: 0.25},
  ];
  // слова призыва (234…) в ТикТоке вырезаны — их звуки только в основном ролике
  return list.concat(tiktok
    ? [{at: length - 0.6, file: 'Risers/Smooth Riser.wav', vol: 0.2}, {at: length - 0.1, file: 'Pop/Sweet UI Open.wav', vol: 0.4}]
    : [{at: w(234) - 0.1, file: 'Risers/Smooth Riser.wav', vol: 0.2}, {at: w(244), file: 'Pop/Sweet UI Open.wav', vol: 0.4}]);
};
const Sounds: React.FC<{tiktok: boolean; length: number; set: string}> = ({tiktok, length, set}) => (
  <>
    {(set === 'вариант 2' ? useSfxUchenik() : useSfx(tiktok, length)).map((s, i) => (
      <Sequence key={i} from={Math.max(0, sec(s.at))} durationInFrames={sec(3)} layout="none">
        <Sfx file={s.file} volume={s.vol} />
      </Sequence>
    ))}
  </>
);

export const Polovina: React.FC<PolovinaProps> = ({video, phrases, space, length, words, shift, seam, tiktok = false, set = 'пример 1'}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = frame / fps;
  const th = THEMES['Утро'];
  const base = getStyle('Тёплый свет');
  // в «полэкрана» субтитры мельче (обычные 64 px)
  const style = useMemo(() => ({...base, subtitle: {...base.subtitle, size: 52}}), [base]);
  const timed = useMemo(() => timing(phrases, style), [phrases, style]);
  const map = useMemo(() => Object.fromEntries(words.map((x) => [x.н, x])), [words]);
  const zoom = interpolate(t, [0, length], [1.0, 1.05]);
  const fadeOut = interpolate(frame, [durationInFrames - 8, durationInFrames - 1], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const panelH = PANEL_BOTTOM - seam;
  // «хвост»: после последнего слова кадр автора замирает (Freeze), карточка в конце стоит
  const last = Math.round(length * fps) - 1;
  const hold = frame >= last;
  const k = set === 'вариант 2' ? Math.min(1.1, panelH / 600) : Math.min(1.1, panelH / 580);   // масштаб сцен под высоту панели
  return (
    <WordsCtx.Provider value={map}>
      <ThemeCtx.Provider value={th}>
        <AbsoluteFill style={{background: th.bg, overflow: 'hidden'}}>
          {/* под стеклом — та же запись, растянутая и размытая */}
          <AbsoluteFill style={{transform: 'scale(1.35)', filter: 'blur(30px) saturate(1.1)'}}>
            <Freeze frame={last} active={hold}><OffthreadVideo src={staticFile(video)} muted /></Freeze>
          </AbsoluteFill>
          <div style={{position: 'absolute', left: 0, top: -shift, width: 1080, height: 1920,
            transformOrigin: `540px ${shift + 480}px`, transform: `scale(${zoom})`}}>
            <Freeze frame={last} active={hold}><OffthreadVideo src={staticFile(video)} volume={tiktok ? 1 : fadeOut} /></Freeze>
          </div>
          <AbsoluteFill>
            <Subtitles phrases={timed} t0={0} y={seam - 80} style={style} faces={null} shots={[]} space={space} />
          </AbsoluteFill>
          {/* стекло — прозрачнее пробы 2 (было 0,46 / 0,62 / 0,70) */}
          <div style={{position: 'absolute', left: 0, top: seam, width: W, height: 1920 - seam, overflow: 'hidden',
            borderRadius: '48px 48px 0 0',
            // для набора «вариант 2» стекло почти прозрачное, размытие слабее
            background: set === 'вариант 2'
              ? 'linear-gradient(180deg, rgba(23,18,15,0.62) 0%, rgba(23,18,15,0.72) 50%, rgba(23,18,15,0.80) 100%)'
              : 'linear-gradient(180deg, rgba(252,249,244,0.30) 0%, rgba(247,242,234,0.44) 45%, rgba(247,242,234,0.54) 100%)',
            backdropFilter: set === 'вариант 2' ? 'blur(18px) saturate(1.1)' : 'blur(40px) saturate(1.25)',
            WebkitBackdropFilter: set === 'вариант 2' ? 'blur(18px) saturate(1.1)' : 'blur(40px) saturate(1.25)',
            boxShadow: '0 -18px 60px rgba(0,0,0,0.22), inset 0 2px 0 rgba(255,255,255,0.75), inset 0 0 0 1px rgba(255,255,255,0.35)'}}>
            <div style={{position: 'absolute', left: 0, top: 0, width: W, height: 140,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.40), rgba(255,255,255,0))'}} />
            <div style={{position: 'absolute', left: 620, top: 120, width: 520, height: 520, borderRadius: '50%',
              background: th.gold, opacity: 0.14, filter: 'blur(120px)'}} />
            {/* сцены — в видимой части панели (до ника Instagram), правее 900 при y ≥ 1235 — кнопки */}
            {/* Сцены нарисованы под панель высотой ~600 px; панель ниже (спикер 2/3, стекло 1/3) — уменьшаем
                целиком. Ширина 760×k по центру x≈490 — кнопки Instagram (x ≥ 920) не задевает. */}
            {set === 'вариант 2' ? (
              // вторая версия «варианта 2» рисуется прямо в координатах панели (1080 × высота до ника Instagram)
              <div style={{position: 'absolute', left: 0, top: 0, width: W, height: panelH}}><ScenesUchenik length={length} /></div>
            ) : (
              <div style={{position: 'absolute', left: -50, top: 0, width: W / k, height: panelH / k,
                transform: `scale(${k})`, transformOrigin: '0 0'}}>
                <CenterPad.Provider value={{top: 10, bottom: 10}}>
                  <Scenes length={length} tiktok={tiktok} />
                </CenterPad.Provider>
              </div>
            )}
          </div>
          <Grain />
          <Sounds tiktok={tiktok} length={length} set={set} />
        </AbsoluteFill>
      </ThemeCtx.Provider>
    </WordsCtx.Provider>
  );
};
