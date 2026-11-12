"""Где лицо в кадре чистого ролика.

Запуск:  python face.py <видео>
Нужен «<тема> — чистый.mp4» (build.py).
Результат: «Рабочие файлы/<тема>/лицо.json»:
  {"кадр": [1080, 1920], "шаг": 0.5,
   "лицо": [{"t": 0.0, "x": 540, "y": 760, "w": 380, "h": 380} | null, ...]}
  x, y — центр лица, w, h — размер (в пикселях кадра 1080×1920); null — лицо не нашлось.
Нужно, чтобы субтитры не наезжали на подбородок, а приближения держали лицо в центре.
Если файл уже есть и ролик не менялся, повторно не считает.

Поиск лица — OpenCV (каскад Хаара, встроен в библиотеку, без скачиваний).
Находки сглаживаются по времени: случайные ложные «лица» на шторе выкидываются.
"""
import json
import statistics
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
from paths import ROOT, WORK

STEP = 0.5                  # секунды между проверками
W, H = 1080, 1920
SMALL = 2                   # ищем на кадре 540×960 — вдвое быстрее, точности хватает


def frames(video: Path):
    w, h = W // SMALL, H // SMALL
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(video), "-vf",
                             f"fps={1 / STEP},scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                            stdout=subprocess.PIPE)
    while True:
        buf = proc.stdout.read(w * h)
        if len(buf) < w * h:
            break
        yield np.frombuffer(buf, np.uint8).reshape(h, w)
    proc.wait()


def detect(video: Path) -> list:
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    raw = []
    for img in frames(video):
        img = cv2.equalizeHist(img)
        found = cascade.detectMultiScale(img, scaleFactor=1.1, minNeighbors=6, minSize=(80, 80))
        # Самое крупное лицо — спикер (говорящая голова занимает большую часть кадра).
        best = max(found, key=lambda r: r[2] * r[3], default=None)
        raw.append(None if best is None else
                   {"x": (best[0] + best[2] / 2) * SMALL, "y": (best[1] + best[3] / 2) * SMALL,
                    "w": best[2] * SMALL, "h": best[3] * SMALL})
    return raw


def smooth(raw: list, win: int = 2) -> list:
    """Медиана по соседям (±1 с): убирает скачки рамки и одиночные ложные находки."""
    res = []
    for i in range(len(raw)):
        near = [r for r in raw[max(0, i - win): i + win + 1] if r]
        if not near or raw[i] is None and len(near) < 2:
            res.append(None)
            continue
        # Медиана сама отбрасывает одиночную ложную находку: лицо не прыгает за полсекунды.
        med = {k: statistics.median(r[k] for r in near) for k in ("x", "y", "w", "h")}
        res.append({k: round(v) for k, v in med.items()})
    return res


def main() -> None:
    video = Path(sys.argv[1]).resolve()
    work = WORK / video.stem
    clean = work / f"{video.stem} — чистый.mp4"
    out = work / "лицо.json"
    if out.exists() and out.stat().st_mtime > clean.stat().st_mtime and "--заново" not in sys.argv:
        print(f"Лицо уже найдено: {out}")
        return
    raw = detect(clean)
    faces = smooth(raw)
    data = {"кадр": [W, H], "шаг": STEP,
            "лицо": [dict(t=round(i * STEP, 2), **f) if f else None for i, f in enumerate(faces)]}
    out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    found = [f for f in faces if f]
    if found:
        chin = max(f["y"] + f["h"] * 0.6 for f in found)
        print(f"Лицо найдено в {len(found)} из {len(faces)} проверок. "
              f"Центр по высоте {min(f['y'] for f in found)}–{max(f['y'] for f in found)}, "
              f"подбородок не ниже {chin:.0f} px → {out}")
    else:
        print(f"Лицо не найдено ни разу — субтитры останутся на обычном месте. {out}")


if __name__ == "__main__":
    main()
