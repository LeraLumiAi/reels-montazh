// «Камера» из одного кадра: смена плана на склейках и медленный наезд между ними.
// Решение: на склейке план меняется резко (средний ↔ крупный), как в референсе, —
// это прячет «скачок» головы после вырезанной паузы. Между склейками — очень медленный мягкий наезд.
import type {Face, FaceTrack} from './face';

export const CAMERA = {
  medium: 1.0,         // средний план: кадр как снят
  close: 1.22,         // крупный план
  pushPerSecond: 0.004,// наезд: +0,4% масштаба в секунду…
  pushMax: 0.05,       // …но не больше +5% за план
  minShot: 10,         // с: ракурс меняется не чаще раза в 10 с («слишком часто»);
                       //    на склейках внутри плана ракурс не меняется
  minTail: 3,          // с: последний план не короче этого — иначе смена перед самым концом
  faceAt: 0.40,        // лицо держим на 40% высоты кадра (воздух над головой, место под субтитры)
  chinMax: 1290,       // px: ниже подбородок не опускаем — иначе плашка сядет на лицо
};

export type Shot = {start: number; end: number; scale: number; fx: number; fy: number; fh: number};

const W = 1080, H = 1920, FPS = 30;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Лицо за время плана (медиана: камера стоит, лицо почти не двигается — кадр не дрожит). */
function faceDuring(track: FaceTrack | null, a: number, b: number): {x: number; y: number; h: number} | null {
  if (!track) return null;
  const fs = track.лицо.slice(Math.floor(a / track.шаг), Math.ceil(b / track.шаг) + 1).filter(Boolean) as NonNullable<Face>[];
  if (!fs.length) return null;
  return {x: median(fs.map((f) => f.x)), y: median(fs.map((f) => f.y)), h: median(fs.map((f) => f.h))};
}

// medium — отрезки [с, по], когда план обязан быть средним: слово за спикером.
// На крупном плане макушка почти упирается в шапку Instagram, и голова закрывала середину слова.
export function planShots(cuts: number[], length: number, track: FaceTrack | null, medium: [number, number][] = []): Shot[] {
  // План меняется на первой склейке, до которой от прошлой смены прошло не меньше minShot.
  // Склейка в чистом ролике переключает картинку на ближайшем кадре (фильтр fps в build.py округляет),
  // поэтому и план меняем ровно с кадра round(c·fps) — иначе 1 кадр новой картинки в старом плане (проверено).
  const snap = (c: number) => Math.round(c * FPS) / FPS - 1e-6;
  const bounds = [0];
  for (const c of cuts.map(snap)) if (c - bounds[bounds.length - 1] >= CAMERA.minShot && length - c >= CAMERA.minTail) bounds.push(c);
  bounds.push(length);
  const shots: Shot[] = [];
  let prevClose = true;   // чтобы первый план вышел средним
  for (let i = 0; i + 1 < bounds.length; i++) {
    const [a, b] = [bounds[i], bounds[i + 1]];
    const f = faceDuring(track, a, b);
    // Первый план средний, дальше чередуем. Без лица — только средний (не знаем, куда приближать).
    // Под словом за спикером — средний, а чередование продолжается от него.
    const mustMedium = medium.some(([x, y]) => x < b && y > a);
    const close = !!f && !mustMedium && !prevClose;
    prevClose = close;
    const scale = close ? CAMERA.close : CAMERA.medium;
    shots.push({start: a, end: b, scale, fx: f?.x ?? W / 2, fy: f?.y ?? H * CAMERA.faceAt, fh: f?.h ?? 0});
  }
  return shots;
}

export type View = {s: number; x0: number; y0: number};   // экран = s * (кадр − (x0, y0))

export function viewAt(shots: Shot[], t: number): View {
  const sh = shots.find((x) => t < x.end) ?? shots[shots.length - 1];
  const push = Math.min(CAMERA.pushMax, CAMERA.pushPerSecond * Math.max(0, t - sh.start));
  let s = sh.scale * (1 + push);
  // Подбородок на экране не ниже chinMax: если план слишком крупный — чуть уменьшаем.
  if (sh.fh) {
    const chinOnScreen = (k: number) => H * CAMERA.faceAt + sh.fh * 0.6 * k;
    while (s > 1 && chinOnScreen(s) > CAMERA.chinMax) s -= 0.005;
  }
  s = Math.max(1, s);
  // Окно кадра: лицо по центру по ширине и на faceAt по высоте, но окно не выходит за края (без чёрных полос).
  const vw = W / s, vh = H / s;
  const x0 = Math.min(W - vw, Math.max(0, sh.fx - vw / 2));
  const y0 = Math.min(H - vh, Math.max(0, sh.fy - vh * CAMERA.faceAt));
  return {s, x0, y0};
}

/** Где на экране окажется точка кадра (для подбородка и субтитров). */
export const toScreenY = (v: View, y: number) => v.s * (y - v.y0);
