// ш / шк — ширина слова при размере 64: Onest и курсив Playfair (subtitles.py мерит по файлам шрифтов)
export type Word = {н: number; т: string; начало: number; конец: number; ш?: number; шк?: number};
export type Phrase = {слова: Word[]; ключ: number | null};
export type ReelProps = {
  video: string;          // файл в public/
  phrases: Phrase[];
  space: number;          // ширина пробела при размере 64
  length: number;         // длина чистого ролика, с
  from: number;           // для теста стиля: с какой секунды начать
  duration: number;       // сколько секунд собирать
  style: string;          // название стиля из настройки.toml («Тёплый свет»)
  subtitleY: number | null; // своё место плашки для этого ролика, px; null — как в стиле
  faces: import('./face').FaceTrack | null; // где лицо (face.py)
  cuts: number[];         // склейки чистого ролика, с (timeline.py) — там меняется план
  crown?: import('./Behind').CrownTrack | null; // верх головы по маске (matte.py → макушка.json)
  person?: string | null; // человек без фона (matte.py → public/), для «текста за спикером» (этап 4)
  // куски человек.webm (matte.py --куски → человек.json): [первый кадр чистого ролика, конец, где в webm]; null — весь ролик
  personPieces?: [number, number, number][] | null;
  cards?: import('./Cards').Card[]; // графические карточки (этап 3), время — в секундах чистого ролика
};
