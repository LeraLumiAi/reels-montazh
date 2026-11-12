import './fonts';
import React, {useCallback, useMemo, useState} from 'react';
import {AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {ReelProps} from './types';
import {Subtitles, timing} from './Subtitles';
import {planShots, viewAt} from './camera';
import {getStyle} from './styles';
import {Cards, coversSubtitles} from './Cards';
import {BehindWords, behindActive} from './Behind';

export const Reel: React.FC<ReelProps> = ({video, phrases, space, length, from, style: styleName, subtitleY, faces, cuts, cards, person, personPieces, crown}) => {
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const style = getStyle(styleName);
  const timed = useMemo(() => timing(phrases, style), [phrases, style]);
  // под словом за спикером план всегда средний (camera.ts) — над головой есть место для букв
  const behind = useMemo(() => (cards ?? []).filter((c) => c.тип === 'за спикером').map((c) => [c.с, c.по] as [number, number]), [cards]);
  const shots = useMemo(() => planShots(cuts, length, faces, behind), [cuts, length, faces, behind]);
  const t = from + frame / fps;
  const v = viewAt(shots, t);
  const camera: React.CSSProperties = {transformOrigin: '0 0', transform: `scale(${v.s}) translate(${-v.x0}px, ${-v.y0}px)`};
  const all = cards ?? [];
  // Карточки, которым не хватило места над головой, стоят внизу вместо субтитров (Cards.tsx → Placed)
  const [low, setLow] = useState<Record<number, boolean>>({});
  const onPlace = useCallback((i: number, b: boolean) => setLow((p) => (p[i] === b ? p : {...p, [i]: b})), []);
  const cardBelow = all.some((c, i) => low[i] && c.с <= t && t < c.по);
  return (
    <AbsoluteFill style={{backgroundColor: style.color.background, overflow: 'hidden'}}>
      <AbsoluteFill style={camera}>
        <OffthreadVideo src={staticFile(video)} trimBefore={Math.round(from * fps)} />
      </AbsoluteFill>
      {/* Текст за спикером: слово, а поверх — тот же кадр человека без фона, с той же «камерой» */}
      {person && behindActive(all, t) ? (
        <>
          <BehindWords cards={all} t={t} style={style} faces={faces} shots={shots} crown={crown} />
          <AbsoluteFill style={camera}>
            {personPieces ? personPieces.map(([a, b, at], i) => (
              // кусок чистого ролика [a, b) лежит в человек.webm с кадра at (matte.py --куски)
              <Sequence key={i} from={a - Math.round(from * fps)} durationInFrames={b - a} layout="none">
                <OffthreadVideo src={staticFile(person)} transparent muted trimBefore={at || undefined} />
              </Sequence>
            )) : <OffthreadVideo src={staticFile(person)} transparent muted trimBefore={Math.round(from * fps)} />}
          </AbsoluteFill>
        </>
      ) : null}
      <Cards cards={all} t={t} style={style} faces={faces} shots={shots} crown={crown} onPlace={onPlace} />
      {coversSubtitles(all, t) || cardBelow ? null : <Subtitles phrases={timed} t0={from} y={subtitleY ?? style.subtitle.y} style={style} faces={faces} shots={shots} space={space} />}
    </AbsoluteFill>
  );
};
