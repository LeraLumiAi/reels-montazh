// Текст за спикером (этап 4): огромное слово стоит позади человека.
// Слои в Reel.tsx: ролик → это слово → человек без фона (человек.webm, matte.py) → карточки, субтитры.
// Карточка в карточки.json: {"тип": "за спикером", "от": н, "до": н, "слово": "ДУША", "вид": "курсив"}.
import React from 'react';
import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {highestCrown, type FaceTrack} from './face';
import {toScreenY, viewAt, type Shot} from './camera';
import type {StyleProfile as Style} from './styles';
import type {Card} from './Cards';

/** Верх головы по маске человека (matte.py → макушка.json): px кадра, через каждые «шаг» секунд. */
export type CrownTrack = {шаг: number; y: (number | null)[]};

/** Самая высокая макушка на экране за [a, b] (с учётом приближения). По маске, если есть, иначе по лицу. */
export function crownOnScreen(crown: CrownTrack | null, faces: FaceTrack | null, a: number, b: number, shots: Shot[]): number | null {
  if (!crown) return highestCrown(faces, a, b, shots);
  let high: number | null = null, gap = false;
  for (let i = Math.max(0, Math.floor(a / crown.шаг)); i <= Math.min(crown.y.length - 1, Math.ceil(b / crown.шаг)); i++) {
    const y = crown.y[i];
    // 9 ноября: маска теперь только кусками (matte.py --куски) — где её нет, макушку берём по лицу.
    // Иначе «макушки нет» читалось как «места над головой сколько угодно», и карточка вставала на голову.
    if (y == null) { gap = true; continue; }
    // b — конец плана; ровно на нём viewAt уже отдаёт следующий план, поэтому чуть раньше
    const s = shots.length ? toScreenY(viewAt(shots, Math.min(b - 0.01, Math.max(a, i * crown.шаг))), y) : y;
    high = Math.min(high ?? Infinity, s);
  }
  if (gap || high === null) {
    const byFace = highestCrown(faces, a, b, shots);
    if (byFace !== null) high = Math.min(high ?? Infinity, byFace);
  }
  return high;
}

const W = 1080;
// Края — style.instagram.side (при 40 px Instagram обрезал первую и последнюю букву).
const MIN_SIZE = 240;   // px: мельче слово теряет эффект — тогда пусть голова закроет чуть больше букв
const MAX_SIZE = 620;   // px: больше не надо, даже если слово короткое
const APPEAR = 0.5;     // с: проявление
const FADE = 0.4;       // с: угасание
const GROW = 0.04;      // слово медленно «надвигается» на 4% за время показа — живое, но не дёргается
const COVER = 0.4;      // голова закрывает нижние 40% букв посередине: эффект «за спиной» виден, слово читается

export const isBehind = (c: Card) => c.тип === 'за спикером';

function measure(text: string, font: string): number {
  const c2d = document.createElement('canvas').getContext('2d');
  if (!c2d) return text.length * 0.6;
  c2d.font = font;
  return c2d.measureText(text).width;
}

type Look = {family: string; italic: boolean; weight: number; upper: boolean; spacing: number; cap: number};

// Решение: по умолчанию — «Б»: заглавные Onest 600 кремовым. Курсив и контур остались
// как запасные виды ("вид": "курсив" / "контур"), если для ролика захочется другого.
function look(card: Card, style: Style): Look {
  switch (card.вид) {
    case 'курсив': return {family: style.font.accent, italic: true, weight: 400, upper: false, spacing: 0, cap: 0.72};
    default:       return {family: style.font.main, italic: false, weight: 600, upper: true, spacing: -0.02, cap: 0.7};  // капс, контур
  }
}

function color(card: Card, style: Style): string {
  const th = style.card.dark;
  switch (card.цвет ?? (card.вид === 'курсив' || card.вид === 'контур' ? 'золото' : 'кремовый')) {
    case 'золото':   return th.accent;
    case 'карамель': return th.caramel;
    case 'тёмный':   return style.color.background;
    default:         return th.ink;      // кремовый
  }
}

export const BehindWords: React.FC<{cards: Card[]; t: number; style: Style; faces?: FaceTrack | null; shots?: Shot[]; crown?: CrownTrack | null}> = ({cards, t, style, faces = null, shots = [], crown = null}) => (
  <>
    {cards.filter(isBehind).map((card, i) => {
      if (t < card.с || t >= card.по) return null;
      const L = look(card, style);
      const text = L.upper ? String(card.слово ?? '').toUpperCase() : String(card.слово ?? '');
      const font = (size: number) => `${L.italic ? 'italic ' : ''}${L.weight} ${size}px "${L.family}"`;
      const w100 = measure(text, font(100)) + Math.max(0, text.length - 1) * L.spacing * 100;
      const ig = style.instagram;
      const byWidth = Math.min(Number(card.размер ?? MAX_SIZE), Math.floor((100 * (W - 2 * ig.side)) / w100));
      // Низ букв уходит за макушку на COVER высоты букв (от макушки, а не от лба: у длинного слова буквы
      // меньше, и иначе оно целиком «улетало» над головой). Верх букв — не выше безопасной зоны.
      // Место считаем в пределах текущего плана: на смене плана (средний ↔ крупный) весь кадр и так
      // меняется резко, и слово встаёт по новой макушке — иначе на одном из планов оно висит над головой.
      const shot = shots.find((x) => t < x.end) ?? shots[shots.length - 1];
      const a = shot ? Math.max(card.с, shot.start) : card.с, b = shot ? Math.min(card.по, shot.end) : card.по;
      const top = crownOnScreen(crown, faces, a, b, shots) ?? 520;
      // Видимая над головой часть букв (1 − COVER) должна поместиться ниже шапки Instagram
      // («Reels · Друзья») — иначе слово мельче, но не мельче MIN_SIZE.
      const byHead = Math.floor((top - ig.top) / ((1 - COVER) * L.cap));
      const size = Math.max(Math.min(byWidth, MIN_SIZE), Math.min(byWidth, byHead));
      const capH = size * L.cap;
      const base = Math.max(ig.top + capH, top + capH * COVER);
      const ease = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)} as const;
      const p = interpolate(t, [card.с, card.с + APPEAR], [0, 1], ease);
      const out = interpolate(t, [card.по - FADE, card.по], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
      const grow = 1 + GROW * Math.min(1, (t - card.с) / Math.max(1, card.по - card.с));
      const scale = (0.94 + 0.06 * p) * grow;
      const outline = card.вид === 'контур';
      return (
        <AbsoluteFill key={i} style={{opacity: Math.min(p, out)}}>
          {/* SVG: y — ровно линия букв (в HTML строка добавляет свои поля сверху и снизу, и слово «уплывало») */}
          <svg width={W} height={1920} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            <text x={W / 2} y={base} textAnchor="middle" transform={`translate(${W / 2} ${base}) scale(${scale}) translate(${-W / 2} ${-base})`}
              fill={outline ? 'none' : color(card, style)} stroke={outline ? color(card, style) : 'none'} strokeWidth={outline ? 4 : 0}
              style={{fontFamily: L.family, fontStyle: L.italic ? 'italic' : 'normal', fontWeight: L.weight, fontSize: size,
                letterSpacing: `${L.spacing}em`, fontVariantNumeric: 'lining-nums'}}>{text}</text>
            {card.отладка ? <line x1={0} x2={W} y1={top} y2={top} stroke="red" strokeWidth={4} /> : null}
          </svg>
        </AbsoluteFill>
      );
    })}
  </>
);

/** Нужен ли слой «человек без фона» в эту секунду. */
export const behindActive = (cards: Card[], t: number) => cards.some((c) => isBehind(c) && c.с <= t && t < c.по);
