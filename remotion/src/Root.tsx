import React from 'react';
import {Composition} from 'remotion';
import {Reel} from './Reel';
import type {ReelProps} from './types';
import {VoiceGraphic, GRAPHIC_DURATION} from './formats/VoiceGraphic';
import {Notebook, NOTEBOOK_DURATION} from './formats/Notebook';
import {Polovina} from './formats/Polovina';
import {Kosmos} from './formats/Kosmos';
import {Neutral} from './formats/Neutral';

const defaults: ReelProps = {video: 'test.mp4', phrases: [], space: 18, length: 10, from: 0, duration: 10, style: 'Тёплый свет', subtitleY: null, faces: null, cuts: []};

// Композиции (id передаётся в `npx remotion render src/index.ts <id> …`):
//   Reel      — основной формат: говорящая голова + субтитры + карточки + слово за спикером (styles/teplyj-svet.md).
//               Собирается scripts/overlay.py, всё задаётся файлами ролика — код под ролик не меняется.
// Остальные — ОБРАЗЦЫ форматов: сцены в них привязаны к номерам слов конкретного ролика.
// Для нового ролика Claude копирует образец и пишет свои сцены под слова (см. styles/*.md).
export const Root: React.FC = () => (
  <>
    <Composition id="Reel" component={Reel} fps={30} width={1080} height={1920} durationInFrames={300}
      defaultProps={defaults}
      calculateMetadata={({props}) => ({durationInFrames: Math.max(1, Math.round(props.duration * 30))})} />
    {/* «Голос и графика», вертикаль: набор приёмов (Reveal, Card, Pill…), его используют и другие образцы */}
    <Composition id="Grafika" component={VoiceGraphic} fps={30} width={1080} height={1920}
      durationInFrames={Math.round(GRAPHIC_DURATION * 30)} defaultProps={{theme: 'Утро' as const}} />
    {/* «Конспект»: спикер сверху, бумага с картинками и схемами от руки */}
    <Composition id="Konspekt" component={Notebook} fps={30} width={1080} height={1920}
      durationInFrames={Math.round(NOTEBOOK_DURATION * 30)}
      defaultProps={{video: 'test.mp4', phrases: [], shift: 330} as React.ComponentProps<typeof Notebook>}
      calculateMetadata={({props}) => ({durationInFrames: Math.round(((props as {length?: number}).length ?? NOTEBOOK_DURATION) * 30)})} />
    {/* «Полэкрана»: спикер сверху, снизу стекло со сценами; props пишет scripts/polovina.py */}
    <Composition id="Polovina" component={Polovina} fps={30} width={1080} height={1920} durationInFrames={300}
      defaultProps={{video: 'test.mp4', phrases: [], space: 17.8, length: 10, words: [], shift: 240, seam: 980}}
      calculateMetadata={({props}) => ({durationInFrames: Math.max(1, Math.round((props.length + (props.tail ?? 0)) * 30))})} />
    {/* «Голос и графика», горизонталь 16:9, линейная светящаяся графика */}
    <Composition id="Kosmos" component={Kosmos} fps={30} width={1920} height={1080} durationInFrames={300}
      defaultProps={{audio: '', words: [], phrases: [], length: 10, tail: 0}}
      calculateMetadata={({props}) => ({durationInFrames: Math.max(1, Math.round((props.length + props.tail) * 30))})} />
    {/* «Редакция»: монохромная типографика, сцена каждые 2–3 с, можно начать с ИИ-клипа (intro) */}
    <Composition id="Neutral" component={Neutral} fps={30} width={1080} height={1920} durationInFrames={300}
      defaultProps={{intro: '', introEnd: 0, audio: '', words: [], length: 10, tail: 0}}
      calculateMetadata={({props}) => ({durationInFrames: Math.max(1, Math.round((props.length + props.tail) * 30))})} />
  </>
);
