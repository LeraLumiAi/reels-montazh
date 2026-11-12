// Что задаёт профиль стиля. Новый стиль = новый файл рядом с warmLight.ts с этими же полями
// + строчка в styles/index.ts. Остальную систему трогать не нужно.
export type CardTheme = {surface: string; glass: string; tile: string; line: string; ink: string; muted: string;
  accent: string; caramel: string; edge: string; shadow: string; glow: string};
export type StyleProfile = {
  name: string;                           // как стиль называется в настройки.toml
  font: {main: string; accent: string};   // шрифты подключаются в src/fonts.ts
  color: {
    background: string;                   // фон под видео (виден, только если кадр не закрыт)
    onDark: string;                       // текущее слово субтитра
    muted: string;                        // остальные слова фразы
    accent: string;                       // ключевое слово
    caramel: string;                      // крупные буквы и цифры (этапы 3–4)
    glass: string;                        // подложка плашки
    glassEdge: string;                    // кромка подложки
    shadowSoft: string;                   // тень под плашкой
    glow: string;                         // ореол звучащего ключевого слова
  };
  subtitle: {
    y: number;                            // центр плашки по высоте кадра, px
    size: number; weight: number; lineHeight: number;
    charWidth: number;                    // средняя ширина знака при size (чтобы уменьшить длинную строку)
    padX: number; padY: number; radius: number; blur: number;
    keyScale: number;                     // ключевое слово чуть крупнее (курсив визуально мельче)
    keyIdleOpacity: number;               // ключевое слово, пока не звучит
    keyGlowBlur: number;
    appear: number; rise: number;         // проявление фразы: секунды, px подъёма
    holdGap: number;                      // с: до следующей фразы меньше — держим текущую, без мигания
    tail: number; fadeOut: number;        // с: сколько держать после последнего слова и как гасить
    chinGap: number;                      // px: зазор между подбородком и плашкой
  };
  card: {                                 // графические карточки (этап 3)
    top: number;                          // px: верх карточки в верхней зоне, над головой (не выше instagram.top)
    scale: number;                        // общий масштаб карточек: плашка, шрифт, отступы — всё вместе
    minScale: number;                     // меньше не уменьшаем, даже если над головой совсем мало места
    radius: number; pad: number; gap: number;
    appear: number; rise: number; fadeOut: number;   // с, px, с — мягкое затухание 300–400 мс (ТЗ)
    size: {caption: number; title: number; accent: number; body: number; number: number};
    dark: CardTheme;                      // «Вечер»
    light: CardTheme;                     // «Утро» — светлые карточки
  };
  safe: {top: number; side: number; bottom: number};
  instagramBottom: number;                // px снизу: ник, подпись, музыка в Reels — туда не заходим
  // Интерфейс Instagram поверх ролика (замер по скриншотам с телефона).
  // Телефон вытянутее кадра 9:16 — Instagram обрезает края ролика (~50 px с каждой стороны).
  instagram: {
    top: number;                          // px сверху: часы, «Reels · Друзья», «<» и «+» — сюда ни текста, ни графики
    side: number;                         // px с краёв: что за ними — на части телефонов обрезано
    buttonsLeft: number;                  // px: левый край колонки кнопок справа (лайк, комментарий…)
    buttonsTop: number;                   // px: с какой высоты начинаются эти кнопки
    caption: number;                      // px снизу: тут начинаются ник и подпись (по замеру; instagramBottom — с запасом)
  };
  canvas: {width: number; height: number; fps: number};
};
