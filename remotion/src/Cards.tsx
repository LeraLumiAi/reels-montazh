// Графические карточки по смыслу фраз (этап 3). Плоские, в цветах профиля стиля, без иконок.
// Каждая карточка — запись в раскадровке: тип, время (с, по — секунды чистого ролика) и тексты.
// В текстах *звёздочки* отмечают курсивный акцент (Playfair Italic), «\n» — новую строку.
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill, Easing, continueRender, delayRender, interpolate} from 'remotion';
import {lowestChin, type FaceTrack} from './face';
import {crownOnScreen, type CrownTrack} from './Behind';
import type {Shot} from './camera';
import type {StyleProfile as Style} from './styles';
import type {CardTheme} from './styles/types';

export type Card = {
  тип: 'заголовок' | 'шаг' | 'бейдж' | 'список' | 'цитата' | 'дата' | 'призыв' | 'слово' | 'экран' | 'за спикером';
  с: number; по: number;
  тема?: 'тёмная' | 'светлая';
  [поле: string]: unknown;
};

// enter(k) — стиль k-й части карточки: части проявляются по очереди (подпись → главное → ниже),
// enter(k, секунда) — часть появляется в эту секунду (пункт списка — когда его произносят).
type Ctx = {style: Style; th: CardTheme; enter: (k: number, at?: number) => React.CSSProperties};

const STAGGER = 0.12;   // с между частями карточки
const PART_RISE = 12;   // px: часть приподнимается при появлении
const SWAP = 0.2;       // с: в серии старые цифра и слово гаснут перед сменой

const W = 1080;

/** «В каком *образе*» → обычный текст + курсивный акцент. */
function rich(text: string, ctx: Ctx, size: number, color?: string): React.ReactNode {
  // короткие предлоги и союзы («о», «в», «и», «не») не висят в конце строки —
  // склеиваем их со следующим словом неразрывным пробелом.
  text = text.replace(/(^|[\s*«(])([а-яёА-ЯЁ]{1,2}) /g, '$1$2 ');
  return text.split('\n').map((line, li) => (
    <div key={li}>
      {line.split(/(\*[^*]+\*)/).map((part, i) =>
        part.startsWith('*') && part.endsWith('*') ? (
          <span key={i} style={{fontFamily: ctx.style.font.accent, fontStyle: 'italic', fontWeight: 400,
            fontSize: size * 1.08, color: ctx.th.accent, letterSpacing: 0, fontVariantNumeric: 'lining-nums'}}>{part.slice(1, -1)}</span>
        ) : <span key={i} style={{color}}>{part}</span>)}
    </div>
  ));
}

/** Подпись заглавными с разрядкой; dot — светящаяся точка (ps-dot) перед ней. */
const Caption: React.FC<{text: string; ctx: Ctx; dot?: boolean; color?: string}> = ({text, ctx, dot, color}) => (
  <div style={{...ctx.enter(0), display: 'flex', alignItems: 'center', gap: 16, fontFamily: ctx.style.font.main, fontWeight: 500,
    fontSize: ctx.style.card.size.caption, letterSpacing: '0.16em', textTransform: 'uppercase', color: color ?? ctx.th.accent, lineHeight: 1}}>
    {dot && <span style={{width: 12, height: 12, borderRadius: 6, background: ctx.th.accent, boxShadow: `0 0 18px 4px ${ctx.th.glow}`}} />}
    {text}
  </div>
);

const Shell: React.FC<{ctx: Ctx; glass?: boolean; children: React.ReactNode; style?: React.CSSProperties}> = ({ctx, glass, children, style}) => {
  const c = ctx.style.card;
  return (
    <div style={{background: glass ? ctx.th.glass : ctx.th.surface, backdropFilter: glass ? `blur(${ctx.style.subtitle.blur}px)` : undefined,
      border: `1px solid ${ctx.th.edge}`, borderRadius: c.radius, boxShadow: ctx.th.shadow, padding: c.pad,
      maxWidth: W - 2 * ctx.style.safe.side, boxSizing: 'border-box', color: ctx.th.ink, fontFamily: ctx.style.font.main, ...style}}>
      {children}
    </div>
  );
};

const s = (v: unknown) => (typeof v === 'string' ? v : '');

/** Размер шрифта, при котором строка влезает в ширину (шрифты уже загружены — fonts.ts ждёт их). */
function fitSize(text: string, font: string, size: number, maxWidth: number): number {
  const c2d = document.createElement('canvas').getContext('2d');
  if (!c2d) return size;
  c2d.font = font.replace('{size}', String(size));
  const w = c2d.measureText(text).width;
  return w > maxWidth ? Math.floor((size * maxWidth) / w) : size;
}

function body(card: Card, ctx: Ctx): React.ReactNode {
  const z = ctx.style.card.size, gap = ctx.style.card.gap;
  switch (card.тип) {
    case 'заголовок': { // заголовок-крючок в начале ролика
      // «крупно» — главная строка огромным курсивом (цифра цифрой: «3 вопроса»), под ней «текст» —
      // Onest помельче, с курсивными акцентами по всей фразе (так читается лучше,
      // чем один акцент в длинном заголовке). Без «крупно» — как раньше: весь текст одним размером.
      const big = s(card.крупно);
      const maxText = W - 2 * ctx.style.safe.side - 2 * ctx.style.card.pad;
      const bigSize = big ? fitSize(big, `italic 400 {size}px "${ctx.style.font.accent}"`, z.accent * 1.15, maxText) : 0;
      return (
        <Shell ctx={ctx} style={big ? {paddingTop: 34, paddingBottom: 36} : undefined}>
          <Caption text={s(card.подпись)} ctx={ctx} dot />
          {big ? (
            <>
              <div style={{...ctx.enter(1), fontFamily: ctx.style.font.accent, fontStyle: 'italic', fontSize: bigSize, lineHeight: 1.05,
                color: ctx.th.accent, fontVariantNumeric: 'lining-nums', marginTop: 6, whiteSpace: 'nowrap'}}>{big}</div>
              <div style={{...ctx.enter(2), marginTop: gap * 0.5, fontWeight: 600, fontSize: 66, lineHeight: 1.12}}>{rich(s(card.текст), ctx, 66)}</div>
            </>
          ) : (
            <div style={{...ctx.enter(1), marginTop: gap * 1.5, fontWeight: 600, fontSize: z.title, lineHeight: 1.08, letterSpacing: '-0.01em'}}>{rich(s(card.текст), ctx, z.title)}</div>
          )}
        </Shell>
      );
    }
    case 'шаг': {       // «ШАГ / 3 стиль.» — номер пункта, истории, шага
      // Длинное слово («3 про путешествие») не вылезает за карточку — шрифт уменьшается под ширину.
      // В серии размер — по самой длинной карточке серии, плашка во всю ширину: при смене ничего не прыгает.
      const maxText = W - 2 * ctx.style.safe.side - 2 * ctx.style.card.pad;
      const series = card.серия as string[] | undefined;
      const size = fitSize(`${s(card.цифра)}  ${s(card.слово)}`, `italic 400 {size}px "${ctx.style.font.accent}"`, z.accent, maxText);
      const fit = series ? Math.min(...series.map((x) => fitSize(x, `italic 400 {size}px "${ctx.style.font.accent}"`, z.accent, maxText))) : size;
      return (
        <Shell ctx={ctx} style={{paddingTop: 32, paddingBottom: 24, ...(series ? {width: W - 2 * ctx.style.safe.side} : {})}}>
          <Caption text={s(card.подпись)} ctx={ctx} />
          {/* цифра тем же курсивом и цветом, что и слово (белая Onest рядом с курсивом не сочетается), без точки в конце */}
          <div style={{fontFamily: ctx.style.font.accent, fontStyle: 'italic', fontSize: fit, lineHeight: 1.05, color: ctx.th.accent, marginTop: 4, whiteSpace: 'nowrap',
            fontVariantNumeric: 'lining-nums'}}>{/* цифра в рост заглавной, а не «строчная» старого стиля */}
            <span style={{display: 'inline-block', ...ctx.enter(1)}}>{s(card.цифра)}</span>&nbsp; <span style={{display: 'inline-block', ...ctx.enter(2)}}>{s(card.слово)}</span>
          </div>
        </Shell>
      );
    }
    case 'бейдж': {     // окно-«досье»: подпись + рамка с главным — «случай из практики», «имя»
      // шапка — одной подписью, оформленной как в «шаге» («Случай из практики · 2 · клиент»),
      // без курсивного названия, белой плашки и точки.
      return (
        <Shell ctx={ctx} style={{width: W - 2 * ctx.style.safe.side, paddingTop: 32}}>
          <Caption text={s(card.подпись)} ctx={ctx} />
          <div style={{...ctx.enter(1), marginTop: gap * 1.25, border: `1px solid ${ctx.th.line}`, borderRadius: 14, padding: '28px 32px', background: ctx.th.tile + '55'}}>
            <div style={{fontWeight: 600, fontSize: 72, lineHeight: 1.05}}>{rich(s(card.главное), ctx, 72)}</div>
            <div style={{...ctx.enter(2), marginTop: 12, fontWeight: 400, fontSize: z.body, color: ctx.th.muted, lineHeight: 1.2}}>{s(card.ниже)}</div>
          </div>
        </Shell>
      );
    }
    case 'список': {    // пункты появляются по одному (время пункта — секунда, когда его произносят)
      // у пункта «с» — секунда, когда его произносят (overlay.py ставит её по номеру слова)
      const items = (card.пункты as {т: string; с?: number}[]) ?? [];
      return (
        <Shell ctx={ctx}>
          <Caption text={s(card.подпись)} ctx={ctx} color={ctx.th.muted} />
          <div style={{...ctx.enter(1), marginTop: gap * 1.25, fontWeight: 600, fontSize: 64, lineHeight: 1.1}}>{rich(s(card.заголовок), ctx, 64)}</div>
          <div style={{marginTop: gap * 1.5, display: 'flex', flexDirection: 'column', gap: 14}}>
            {items.map((it, i) => (
              <div key={i} style={{...ctx.enter(2 + i, it.с), display: 'flex', alignItems: 'baseline', gap: 24, borderTop: `1px solid ${ctx.th.line}`, paddingTop: 14}}>
                <span style={{fontWeight: 600, fontSize: 34, color: ctx.th.caramel, letterSpacing: '0.04em', width: 48}}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{fontWeight: 400, fontSize: z.body + 6}}>{rich(it.т, ctx, z.body + 6)}</span>
              </div>
            ))}
          </div>
        </Shell>
      );
    }
    case 'цитата':      // фраза, которую хочется пересказать
      return (
        <Shell ctx={ctx} glass={card.стекло === true}>
          <div style={{...ctx.enter(1), fontFamily: ctx.style.font.accent, fontStyle: 'italic', fontSize: 64, lineHeight: 1.18}}>
            {rich(`«${s(card.текст)}»`, ctx, 64)}
          </div>
          {card.автор ? <div style={{marginTop: gap * 1.5}}><Caption text={s(card.автор)} ctx={ctx} color={ctx.th.muted} /></div> : null}
        </Shell>
      );
    case 'дата':        // календарь: дата + что случится
      return (
        <Shell ctx={ctx} style={{display: 'flex', gap: 36, alignItems: 'center', padding: 32}}>
          <div style={{...ctx.enter(0), background: ctx.th.tile, borderRadius: 16, width: 210, textAlign: 'center', overflow: 'hidden', flexShrink: 0}}>
            <div style={{background: ctx.th.ink, color: ctx.style.color.background, fontWeight: 600, fontSize: 28, letterSpacing: '0.16em', padding: '10px 0'}}>{s(card.месяц)}</div>
            <div style={{fontWeight: 600, fontSize: 130, lineHeight: 1.15, color: ctx.th.caramel, letterSpacing: '-0.03em'}}>{s(card.число)}</div>
          </div>
          <div>
            <Caption text={s(card.подпись)} ctx={ctx} dot />
            <div style={{...ctx.enter(1), marginTop: gap, fontWeight: 600, fontSize: 60, lineHeight: 1.1}}>{rich(s(card.заголовок), ctx, 60)}</div>
            <div style={{...ctx.enter(2), marginTop: gap * 0.75, fontSize: 40, color: ctx.th.muted}}>{s(card.ниже)}</div>
          </div>
        </Shell>
      );
    case 'призыв': {    // карточка в конце: слово в комментарии + превью подарка
      // «размер» — шрифт подписи гайда (30 по умолчанию); длинное название в 4 строки — 26
      // «ярлык» — надпись над подарком (ГАЙД по умолчанию); без «цифры» рисуется конверт (например, для медитации)
      const g = (card.гайд as {цифра?: string; текст: string; размер?: number; ярлык?: string}) ?? {цифра: '', текст: ''};
      const L = ctx.style.card.light;
      return (
        <Shell ctx={ctx} style={{display: 'flex', gap: 32, alignItems: 'center', padding: 36, width: W - 2 * ctx.style.safe.side}}>
          <div style={{flex: 1}}>
            <Caption text={s(card.подпись)} ctx={ctx} dot />
            <div style={{...ctx.enter(1), marginTop: gap * 1.25, fontWeight: 600, fontSize: 70, lineHeight: 1.08}}>{rich(s(card.заголовок), ctx, 70)}</div>
            <div style={{...ctx.enter(2), marginTop: gap, fontSize: 42, lineHeight: 1.2, color: ctx.th.muted}}>{rich(s(card.ниже), ctx, 42)}</div>
          </div>
          <div style={{...ctx.enter(3), width: 230, minHeight: 300, flexShrink: 0,   /* длинное название — превью вытягивается вниз */ background: L.surface, borderRadius: 16, rotate: '4deg',
            boxShadow: `0 0 60px ${ctx.th.glow}`, padding: 22, boxSizing: 'border-box', color: L.ink, display: 'flex', flexDirection: 'column'}}>
            <div style={{fontWeight: 500, fontSize: 18, letterSpacing: '0.16em', color: L.muted}}>{g.ярлык ?? 'ГАЙД'}</div>
            {g.цифра ? <div style={{fontWeight: 600, fontSize: 120, lineHeight: 1, color: L.caramel, marginTop: 6}}>{g.цифра}</div> : (
              <svg width={150} height={104} viewBox="0 0 150 104" style={{marginTop: 18, marginBottom: 14}}>
                <rect x={3} y={3} width={144} height={98} rx={10} fill="none" stroke={L.caramel} strokeWidth={5} />
                <path d="M6 8 L75 60 L144 8" fill="none" stroke={L.caramel} strokeWidth={5} strokeLinejoin="round" />
                <circle cx={75} cy={64} r={13} fill={L.accent} />
              </svg>
            )}
            <div style={{fontWeight: 600, fontSize: g.размер ?? 30, lineHeight: 1.12, marginTop: 'auto'}}>{rich(g.текст, {...ctx, th: L}, g.размер ?? 30)}</div>
          </div>
        </Shell>
      );
    }
    default:
      return null;
  }
}

/** Слово на весь экран: светлый лист «Утро», сквозь буквы видно спикера (приём «OVER» из референса). */
const FullWord: React.FC<{card: Card; ctx: Ctx; id: string}> = ({card, ctx, id}) => {
  const L = ctx.style.card.light;
  const word = s(card.слово);
  const size = Number(card.размер ?? 300);
  return (
    <svg width={W} height={1920} style={{position: 'absolute', inset: 0}}>
      <defs>
        <mask id={id}>
          <rect width={W} height={1920} fill="white" />
          <text x={W / 2} y={Number(card.y ?? 900)} textAnchor="middle" fill="black"
            style={{fontFamily: ctx.style.font.main, fontWeight: 600, fontSize: size, letterSpacing: '-0.03em'}}>{word}</text>
        </mask>
      </defs>
      <rect width={W} height={1920} fill={L.surface} mask={`url(#${id})`} />
      {card.подпись ? (
        <text x={W / 2} y={Number(card.y ?? 900) - size * 0.92} textAnchor="middle" fill={L.muted}
          style={{fontFamily: ctx.style.font.main, fontWeight: 500, fontSize: 40, letterSpacing: '0.18em'}}>{s(card.подпись).toUpperCase()}</text>
      ) : null}
      {card.ниже ? (
        <text x={W / 2} y={Number(card.y ?? 900) + 120} textAnchor="middle" fill={L.accent}
          style={{fontFamily: ctx.style.font.accent, fontStyle: 'italic', fontSize: 96}}>{s(card.ниже)}</text>
      ) : null}
    </svg>
  );
};

/** Экран, залитый цветом, с фразой («полностью залитый цветом экран с фразой»).
 *  Заливка раскрывается кругом из центра, строки проявляются по очереди, фраза чуть-чуть надвигается.
 *  Цвета — «Тёплый свет»: тёмная (Вечер), светлая (Утро), карамель. Текст — в зоне Instagram (поля 110, выше кнопок). */
const SCREENS = {
  'тёмная': {bg: '#2A221D', ink: '#F3EAE0', accent: '#E0BE7A', muted: '#BFAE9E', glow: 'rgba(224,190,122,0.20)'},
  'светлая': {bg: '#F7F2EA', ink: '#3A332E', accent: '#7E5A2E', muted: '#6B5E54', glow: 'rgba(217,179,108,0.30)'},
  'карамель': {bg: '#7E5A2E', ink: '#FBF6EE', accent: '#F6D894', muted: '#E8D3B4', glow: 'rgba(246,216,148,0.22)'},
} as const;
const FullScreen: React.FC<{card: Card; ctx: Ctx; t: number}> = ({card, ctx, t}) => {
  const k = SCREENS[(card.цвет as keyof typeof SCREENS) ?? 'тёмная'] ?? SCREENS['тёмная'];
  const size = Number(card.размер ?? 92);
  const lines = s(card.текст).split('\n');
  const reveal = interpolate(t, [card.с, card.с + 0.45], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const drift = interpolate(t, [card.с, card.по], [1, 1.035], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const line = (i: number): React.CSSProperties => {
    const st = card.с + 0.25 + i * 0.16;
    const p = interpolate(t, [st, st + 0.4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
    return {opacity: p, transform: `translateY(${(1 - p) * 24}px)`, filter: `blur(${(1 - p) * 6}px)`};
  };
  const th = {...ctx.th, accent: k.accent};
  return (
    <AbsoluteFill style={{clipPath: `circle(${reveal * 120}% at 50% 46%)`, background: k.bg}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 44%, ${k.glow}, transparent 62%)`}} />
      <div style={{position: 'absolute', left: 110, width: 860, top: Number(card.y ?? 880), transform: `translateY(-50%) scale(${drift})`,
        textAlign: 'center', fontFamily: ctx.style.font.main, fontWeight: 600, fontSize: size, lineHeight: 1.12, color: k.ink, letterSpacing: '-0.01em'}}>
        {card.подпись ? <div style={{...line(0), fontWeight: 500, fontSize: 32, letterSpacing: '0.18em', textTransform: 'uppercase', color: k.muted, marginBottom: 40}}>{s(card.подпись)}</div> : null}
        {lines.map((ln, i) => <div key={i} style={line(i + 1)}>{rich(ln, {...ctx, th}, size)}</div>)}
      </div>
    </AbsoluteFill>
  );
};

/** Слово на весь экран и экран цветом сами повторяют речь — субтитры в это время прячем. */
export const coversSubtitles = (cards: Card[], t: number) => cards.some((c) => (c.тип === 'слово' || c.тип === 'экран') && c.с <= t && t < c.по);

/** Где стоит карточка. Сверху над головой — если помещается выше макушки (можно чуть уменьшить,
 *  до FIT_ABOVE от обычного размера). Не помещается — правило: карточка встаёт вниз,
 *  на место субтитров, а субтитры на это время убираются («карточка на лбу смотрится некрасиво»).
 *  Решение и размер — одни на всё время карточки: не «дышит» и не прыгает. */
const FIT_ABOVE = 0.85;  // над головой карточку уменьшаем не больше чем до 85% обычного размера
const CROWN_GAP = 16;    // px между низом карточки и макушкой
const CHIN_GAP = 24;     // px между подбородком и карточкой внизу

type Spot = {x: number; y: number; scale: number; low: boolean};

const Placed: React.FC<{style: Style; crown: number | null; chin: number | null; rise: number; top: number;
  onPlace: (low: boolean) => void; children: React.ReactNode}> = ({style, crown, chin, rise, top, onPlace, children}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [handle] = useState(() => delayRender('Размер карточки'));
  // Меряем только когда шрифты догрузились: 5 ноября заголовок «прыгал» — замер шёл, пока шрифт
  // ещё грузился, текст ложился узко в несколько строк и высота выходила почти вдвое больше.
  useLayoutEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive || !ref.current) return;
      const h = ref.current.offsetHeight, w = ref.current.offsetWidth;
      const base = style.card.scale, ig = style.instagram, H = style.canvas.height;
      const room = crown === null ? Infinity : crown - CROWN_GAP - top;
      const above = Math.min(base, room / h);
      let next: Spot;
      if (above >= base * FIT_ABOVE) {
        next = {x: style.canvas.width / 2 - (w * above) / 2, y: top, scale: above, low: false};
      } else {
        // Внизу: нижний край — над ником и подписью Instagram (замер по скриншоту с телефона; запас instagramBottom
        // для субтитров тут слишком велик — карточка выходила мелкой), верх — не выше подбородка,
        // справа — не на кнопках.
        const bottom = H - ig.caption - 20;
        const fitLow = chin === null ? base : Math.min(base, (bottom - chin - CHIN_GAP) / h);
        const k = Math.max(style.card.minScale, fitLow);
        const right = ig.buttonsLeft - 10;
        const cx = Math.max(ig.side + (w * k) / 2, Math.min(style.canvas.width / 2, right - (w * k) / 2));
        next = {x: cx - (w * k) / 2, y: bottom - h * k, scale: k, low: true};
      }
      setSpot(next);
      onPlace(next.low);
    });
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (spot !== null) continueRender(handle); }, [spot, handle]);
  return (
    // пока место не известно, карточку не показываем — иначе кадр мог бы сняться не там
    <div style={{position: 'absolute', left: 0, top: 0, visibility: spot === null ? 'hidden' : 'visible',
      transformOrigin: '0 0', transform: spot ? `translate(${spot.x}px, ${spot.y + rise}px) scale(${spot.scale})` : undefined}}>
      <div ref={ref} style={{width: 'max-content'}}>{children}</div>
    </div>
  );
};

export const Cards: React.FC<{cards: Card[]; t: number; style: Style; faces?: FaceTrack | null; shots?: Shot[]; crown?: CrownTrack | null;
  onPlace?: (i: number, low: boolean) => void}> = ({cards, t, style, faces = null, shots = [], crown = null, onPlace = () => {}}) => {
  const c = style.card;
  return (
    <>
      {cards.map((card, i) => {
        if (t < card.с || t >= card.по || card.тип === 'за спикером') return null;   // его рисует Behind.tsx
        const th = card.тема === 'светлая' ? c.light : c.dark;
        const ease = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)} as const;
        // Серия (overlay.py ставит «продолжение» / «дальше»): плашка и подпись стоят на месте,
        // старые цифра и слово гаснут за SWAP с, новые проявляются как обычно.
        const cont = card.продолжение === true, more = card.дальше === true;
        const swapOut = more ? interpolate(t, [card.по - SWAP, card.по], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
        const enter = (k: number, at?: number): React.CSSProperties => {
          if (cont && k === 0) return {};
          const start = at ?? card.с + (cont ? k - 1 : k) * STAGGER;
          const p = interpolate(t, [start, start + c.appear], [0, 1], ease);
          return {opacity: p * (k > 0 ? swapOut : 1), transform: `translateY(${(1 - p) * PART_RISE}px)`};
        };
        const ctx = {style, th, enter};
        const fadeIn = cont ? 1 : interpolate(t, [card.с, card.с + c.appear], [0, 1], ease);
        // «до_конца» (overlay.py): карточка стоит до последнего кадра и не гаснет — ролик кончается на ней
        const fadeOut = more || card.до_конца === true ? 1 : interpolate(t, [card.по - c.fadeOut, card.по], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const opacity = Math.min(fadeIn, fadeOut);
        if (card.тип === 'экран') return <AbsoluteFill key={i} style={{opacity}}><FullScreen card={card} ctx={ctx} t={t} /></AbsoluteFill>;
        if (card.тип === 'слово') return <AbsoluteFill key={i} style={{opacity}}><FullWord card={card} ctx={ctx} id={`word-${i}`} /></AbsoluteFill>;
        return (
          <AbsoluteFill key={i} style={{opacity}}>
            <Placed style={style} top={Math.max(style.instagram.top, Number(card.y ?? c.top))} rise={(1 - fadeIn) * c.rise}
              crown={crownOnScreen(crown, faces, card.с, card.по, shots)} chin={lowestChin(faces, card.с, card.по, shots)}
              onPlace={(low) => onPlace(i, low)}>
              {body(card, ctx)}
            </Placed>
          </AbsoluteFill>
        );
      })}
    </>
  );
};
