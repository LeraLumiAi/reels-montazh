import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import type {Phrase} from './types';
import type {StyleProfile as Style} from './styles';
import {lowestChin, type FaceTrack} from './face';
import type {Shot} from './camera';

// Все размеры, цвета и тайминги плашки — в профиле стиля (src/styles/).

type Timed = Phrase & {show: number; hide: number; next: number};

export function timing(phrases: Phrase[], style: Style): Timed[] {
  const {holdGap, tail} = style.subtitle;
  return phrases.map((p, i) => {
    const show = p.слова[0].начало;
    const end = p.слова[p.слова.length - 1].конец;
    const next = i + 1 < phrases.length ? phrases[i + 1].слова[0].начало : Infinity;
    const hide = next - end < holdGap ? next : end + tail;
    return {...p, show, hide, next};
  });
}

export const Subtitles: React.FC<{phrases: Timed[]; t0: number; y: number; style: Style; faces: FaceTrack | null; shots: Shot[]; space: number}> = ({phrases, t0, y, style, faces, shots, space}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = t0 + frame / fps;
  const p = phrases.find((x) => x.show <= t && t < x.hide);
  if (!p) return null;

  const s = style.subtitle;
  const fadeIn = interpolate(t, [p.show, p.show + s.appear], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  // Исчезает только если дальше пауза; если сразу следующая фраза — просто сменяется.
  const fadeOut = p.hide === p.next ? 1 : interpolate(t, [p.hide - s.fadeOut, p.hide], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const opacity = Math.min(fadeIn, fadeOut);
  const rise = (1 - fadeIn) * s.rise;

  // Текущее слово — последнее начавшееся: в паузе между словами подсветка не гаснет.
  const current = [...p.слова].reverse().find((w) => w.начало <= t)?.н ?? null;

  // Ширина строки при базовом размере — по настоящим шрифтам (ш/шк из subtitles.py);
  // если их нет — по средней ширине знака. Не влезает — шрифт чуть мельче.
  // Где плашке можно стоять по ширине. Справа внизу — кнопки Instagram (лайк, комментарий…):
  // Субтитры заходили на них. Поэтому правый край не дальше колонки кнопок,
  // а длинная фраза сдвигается влево (короткая остаётся по центру).
  const ig = style.instagram, W = style.canvas.width;
  const left = ig.side, right = ig.buttonsLeft - 10;   // плашка всегда ниже ig.buttonsTop (центр ≥ 1380)
  const maxText = right - left - 2 * s.padX;
  const k = s.size / 64;
  const measured = p.слова.every((w) => w.ш !== undefined && w.шк !== undefined);
  const textWidth = measured
    ? k * (p.слова.reduce((a, w) => a + (w.н === p.ключ ? w.шк! * s.keyScale : w.ш!), 0) + space * (p.слова.length - 1))
    : p.слова.map((w) => w.т).join(' ').length * s.charWidth;
  const size = Math.min(s.size, Math.floor((s.size * maxText) / textWidth));

  // Не заходим в нижнюю зону Instagram (ник, подпись, музыка): нижний край плашки выше неё.
  const half = (size * s.lineHeight + 2 * s.padY) / 2;
  // Лицо снято низко (или приближено) — плашку поднимать не надо, наоборот: опускаем под подбородок,
  // но не ниже зоны Instagram. Высота постоянна на всю фразу, чтобы плашка не прыгала.
  const chin = lowestChin(faces, p.show, p.hide, shots);
  const underChin = chin === null ? y : Math.max(y, chin + s.chinGap + half);
  const safeY = Math.min(underChin, style.canvas.height - style.instagramBottom - half);
  const plateW = (textWidth * size) / s.size + 2 * s.padX;
  const cx = Math.max(left + plateW / 2, Math.min(W / 2, right - plateW / 2));

  return (
    <AbsoluteFill>
      {/* широкая полоса с центром в cx: плашка в ней по центру и не сжимается краем кадра */}
      <div style={{position: 'absolute', left: cx - W, width: 2 * W, top: safeY, display: 'flex', justifyContent: 'center',
        transform: `translateY(calc(-50% + ${rise}px))`, opacity}}>
        <div style={{background: style.color.glass, backdropFilter: `blur(${s.blur}px)`, WebkitBackdropFilter: `blur(${s.blur}px)`,
          border: `1px solid ${style.color.glassEdge}`, borderRadius: s.radius, boxShadow: style.color.shadowSoft,
          padding: `${s.padY}px ${s.padX}px`, maxWidth: right - left,
          fontFamily: style.font.main, fontWeight: s.weight, fontSize: size, lineHeight: s.lineHeight, whiteSpace: 'nowrap'}}>
          {p.слова.map((w, i) => {
            const isKey = w.н === p.ключ;
            const on = w.н === current;
            const st: React.CSSProperties = isKey
              ? {fontFamily: style.font.accent, fontStyle: 'italic', fontWeight: 400, fontSize: size * s.keyScale,
                 color: style.color.accent, opacity: on ? 1 : s.keyIdleOpacity, textShadow: on ? `0 0 ${s.keyGlowBlur}px ${style.color.glow}` : 'none'}
              : {color: on ? style.color.onDark : style.color.muted};
            return <React.Fragment key={w.н}>{i > 0 ? ' ' : ''}<span style={st}>{w.т}</span></React.Fragment>;
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
