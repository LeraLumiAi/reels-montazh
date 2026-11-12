// Положение лица по времени (из Рабочие файлы/<тема>/лицо.json, face.py).
import {toScreenY, viewAt, type Shot} from './camera';

export type Face = {t: number; x: number; y: number; w: number; h: number} | null;
export type FaceTrack = {шаг: number; лицо: Face[]};

const CHIN = 0.6;   // подбородок ниже центра лица на 0,6 высоты рамки (проверено по кадрам)

// Верх лба: рамка лица начинается у линии волос; карточке можно зайти на волосы, но не ниже
// верхней части лба (0,42 высоты рамки выше центра).
const BROW = 0.42;

/** Самая высокая (на экране) граница лба за отрезок [a, b] с учётом приближения; null — лица нет.
 *  Карточка сверху не должна опускаться ниже неё. */
export function highestForehead(track: FaceTrack | null, a: number, b: number, shots: Shot[] = []): number | null {
  if (!track) return null;
  const i0 = Math.max(0, Math.floor(a / track.шаг));
  const i1 = Math.min(track.лицо.length - 1, Math.ceil(b / track.шаг));
  let high: number | null = null;
  for (let i = i0; i <= i1; i++) {
    const f = track.лицо[i];
    if (!f) continue;
    const top = f.y - f.h * BROW;
    const y = shots.length ? toScreenY(viewAt(shots, f.t), top) : top;
    high = Math.min(high ?? Infinity, y);
  }
  return high;
}

// Макушка: волосы выше рамки лица ещё примерно на четверть её высоты (0,68 выше центра).
const CROWN = 0.68;

/** Самая высокая (на экране) макушка за отрезок [a, b] — для слова за спикером; null — лица нет. */
export function highestCrown(track: FaceTrack | null, a: number, b: number, shots: Shot[] = []): number | null {
  if (!track) return null;
  const i0 = Math.max(0, Math.floor(a / track.шаг));
  const i1 = Math.min(track.лицо.length - 1, Math.ceil(b / track.шаг));
  let high: number | null = null;
  for (let i = i0; i <= i1; i++) {
    const f = track.лицо[i];
    if (!f) continue;
    const top = f.y - f.h * CROWN;
    high = Math.min(high ?? Infinity, shots.length ? toScreenY(viewAt(shots, f.t), top) : top);
  }
  return high;
}

/** Самый низкий подбородок на экране за отрезок [a, b] с учётом приближения; null — лица нет. */
export function lowestChin(track: FaceTrack | null, a: number, b: number, shots: Shot[] = []): number | null {
  if (!track) return null;
  const i0 = Math.max(0, Math.floor(a / track.шаг));
  const i1 = Math.min(track.лицо.length - 1, Math.ceil(b / track.шаг));
  let low: number | null = null;
  for (let i = i0; i <= i1; i++) {
    const f = track.лицо[i];
    if (!f) continue;
    const chin = f.y + f.h * CHIN;
    const y = shots.length ? toScreenY(viewAt(shots, f.t), chin) : chin;
    low = Math.max(low ?? 0, y);
  }
  return low;
}
