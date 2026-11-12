// Профиль стиля «Тёплый свет», тема «Вечер» (для видео). Описание словами — styles/teplyj-svet.md; свой стиль — reference/svoj-stil.md.
import type {StyleProfile} from './types';

export const warmLight: StyleProfile = {
  name: 'Тёплый свет',
  font: {main: 'Onest', accent: 'Playfair Display'},
  color: {
    background: '#2A221D',  // surface-100 «Вечер»
    onDark: '#F7F2EA',      // on-dark
    muted: '#BFAE9E',       // ink-muted «Вечер»
    accent: '#E0BE7A',      // accent-ink / gold-glow «Вечер»
    caramel: '#D4A983',     // caramel-deep «Вечер» — для видео
    glass: 'rgba(42,34,29,0.55)',          // glass «Вечер»: #2A221D, 55%
    glassEdge: 'rgba(243,234,224,0.16)',   // glass-edge «Вечер»
    shadowSoft: '0 18px 48px rgba(0,0,0,0.35)',
    glow: 'rgba(224,190,122,0.55)',
  },
  subtitle: {
    y: 1380,                // ниже, подальше от лица, но выше зоны Instagram
    size: 64, weight: 600, lineHeight: 1.2, charWidth: 35,   // токен subtitle: Onest 600, 64 px
    padX: 40, padY: 18, radius: 36, blur: 18,                // radius-lg, blur-glass
    keyScale: 1.06, keyIdleOpacity: 0.72, keyGlowBlur: 18,
    appear: 0.18, rise: 10, holdGap: 0.45, tail: 0.25, fadeOut: 0.2,
    chinGap: 30,
  },
  card: {
    top: 270,               // было 130 — плашка закрывала «Reels · Друзья»
    scale: 0.82,            // «плашку уменьшить, шрифт уменьшить»
    minScale: 0.55,         // было 0,8 — на крупном плане плашка не помещалась и сильно заходила на голову
    radius: 20, pad: 40, gap: 16,         // radius-md, space-4, space-2
    appear: 0.35, rise: 16, fadeOut: 0.3,
    // canvas-caption 32, canvas-title 84, canvas-accent 130, canvas-body 46; цифра — крупнее canvas-hook
    size: {caption: 32, title: 84, accent: 130, body: 46, number: 170},
    dark: {                               // тема «Вечер»
      surface: 'rgba(42,34,29,0.94)',     // surface-100, почти плотная — карточка, а не стекло
      glass: 'rgba(42,34,29,0.55)', tile: '#4A3D34',
      line: '#54463C', ink: '#F3EAE0', muted: '#BFAE9E', accent: '#E0BE7A', caramel: '#D4A983',
      edge: 'rgba(243,234,224,0.16)', shadow: '0 18px 48px rgba(0,0,0,0.35)', glow: 'rgba(224,190,122,0.55)',
    },
    light: {                              // тема «Утро»
      surface: '#F7F2EA', glass: 'rgba(252,249,244,0.62)', tile: '#E8DCCB',
      line: '#D8CBB8', ink: '#3A332E', muted: '#6B5E54', accent: '#7E5A2E', caramel: '#8A6446',
      edge: 'rgba(255,255,255,0.7)', shadow: '0 18px 48px rgba(0,0,0,0.10)', glow: 'rgba(217,179,108,0.45)',
    },
  },
  safe: {top: 96, side: 96, bottom: 320},
  instagramBottom: 460,     // в фирменном стиле 320, но подпись с ником в Reels занимает больше
  // плашка заходила под «Reels · Друзья», субтитры — на кнопки справа, слово за спикером —
  // под шапку и за края экрана. Замер по скриншоту: шапка кончается на ~245 px, кнопки — x ≥ 920 с y ≈ 1235,
  // видимая ширина 51…1029.
  instagram: {top: 270, side: 110, buttonsLeft: 900, buttonsTop: 1200, caption: 220},   // ник — с ~1745 px
  canvas: {width: 1080, height: 1920, fps: 30},
};
