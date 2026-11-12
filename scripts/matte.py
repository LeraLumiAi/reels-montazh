"""Вырезание человека из фона — для «текста за спикером» (этап 4).

Запуск:  python matte.py <видео> [--куски 12.3-15.0,40.1-43.2] [--заново]
Нужен «<тема> — чистый.mp4» (build.py).
Результат: «Рабочие файлы/<тема>/человек.webm» — человек без фона (VP9 с альфа-каналом).
Remotion кладёт его поверх крупного слова: фон → слово → человек, — и человек «стоит перед текстом».

--куски (так быстрее): человек вырезается только там, где стоит слово за спикером
(секунды чистого ролика; overlay.py передаёт их сам). К каждому куску — 2 с «разгона» до него
(модель помнит прошлые кадры, без разгона края волос в первые кадры дрожат) и 0,5 с после.
В человек.webm куски идут подряд, их места — в «человек.json»: {"куски": [[от, до, где в webm], …]}
(кадры, 30 в секунду). Ролик на 2 минуты с двумя словами — около минуты вместо ~12.
Без --куски — весь ролик, как раньше.

Модель — Robust Video Matting (mobilenetv3, файл в папке навыка models/). Она сделана для видео:
помнит предыдущие кадры, поэтому края волос не дрожат от кадра к кадру. Работает на процессоре,
примерно 5 кадров в секунду → минута ролика ≈ 6 минут.
"""
import json
import subprocess
import shutil
import sys
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from paths import MODELS, ROOT, WORK

MODEL = MODELS / "rvm_mobilenetv3_fp32.onnx"
W, H, FPS = 1080, 1920, 30
DOWNSAMPLE = 0.25   # модель смотрит на кадр в 4 раза меньше — быстрее и для 1080p рекомендовано авторами
# Края: у модели мягкий переход ~20 px, в нём просвечивает светлая стена — вокруг волос «ореол»
# на тёмных буквах. Сжимаем переход: всё, что прозрачнее 0,45, — фон, плотнее 0,95 — человек
# (проба 4 ноября, «сжатие краёв.png»: ореол уходит, волосы остаются мягкими).
EDGE_LO, EDGE_HI = 0.45, 0.95
WARMUP, AFTER = 2.0, 0.5   # с до и после куска


def ffmpeg() -> str:
    return shutil.which("ffmpeg") or "ffmpeg"


def frame_count(clean: Path) -> int:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets",
                        "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", str(clean)],
                       capture_output=True, text=True, check=True)
    return int(r.stdout.strip())


def pieces_from(arg: str | None, total: int) -> list[list[int]]:
    """«12.3-15,40-43» → куски в кадрах [от, до) с разгоном; перекрывающиеся сливаются."""
    if not arg:
        return [[0, total]]
    raw = []
    for part in arg.split(","):
        a, b = (float(x) for x in part.split("-"))
        raw.append([max(0, int((a - WARMUP) * FPS)), min(total, int(round((b + AFTER) * FPS)) + 1)])
    raw.sort()
    out = [raw[0]]
    for a, b in raw[1:]:
        if a <= out[-1][1]:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out


def matte(clean: Path, out: Path, pieces: list[list[int]]) -> None:
    so = ort.SessionOptions()
    so.intra_op_num_threads = 12
    sess = ort.InferenceSession(str(MODEL), so)
    tmp = out.with_name(out.stem + " (сборка).webm")
    wr = subprocess.Popen([ffmpeg(), "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
                           "-crf", "24", "-b:v", "0", "-deadline", "good", "-cpu-used", "5", "-row-mt", "1",
                           "-auto-alt-ref", "0", "-an", str(tmp)], stdin=subprocess.PIPE)
    ds = np.array([DOWNSAMPLE], np.float32)
    n, t0, bad = 0, time.time(), False
    for fa, fb in pieces:
        # у каждого куска своя «память» модели — разгон в начале куска на экран не попадает
        rec = [np.zeros((1, 1, 1, 1), np.float32)] * 4
        rd = subprocess.Popen([ffmpeg(), "-v", "error", "-ss", f"{fa / FPS:.4f}", "-i", str(clean),
                               "-frames:v", str(fb - fa), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                              stdout=subprocess.PIPE)
        got = 0
        while got < fb - fa:
            buf = rd.stdout.read(W * H * 3)
            if len(buf) < W * H * 3:
                break
            x = (np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32) / 255).transpose(2, 0, 1)[None]
            fgr, pha, *rec = sess.run(None, {"src": x, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3],
                                             "downsample_ratio": ds})
            a = np.clip((pha[0, 0] - EDGE_LO) / (EDGE_HI - EDGE_LO), 0, 1)
            # fgr — цвет человека, из которого модель убрала просвечивающий фон (чище на краях волос)
            rgba = np.concatenate([fgr[0].transpose(1, 2, 0), a[..., None]], axis=2)
            wr.stdin.write((rgba * 255 + 0.5).astype(np.uint8).tobytes())
            n, got = n + 1, got + 1
            if n % (FPS * 10) == 0:
                print(f"  {n / FPS:.0f} с… ({n / (time.time() - t0):.1f} кадров/с)", flush=True)
        rd.stdout.close()
        bad |= rd.wait() != 0 or got != fb - fa
    wr.stdin.close()
    if wr.wait() or bad:
        sys.exit("Не получилось вырезать человека (ошибка FFmpeg).")
    tmp.replace(out)
    print(f"Человек вырезан: {n} кадров за {time.time() - t0:.0f} с → {out}")


CROWN_STEP = 5      # кадров: макушку записываем 6 раз в секунду
CROWN_X = (200, 880)  # ищем голову в средней части кадра (руки по краям не мешают)


def crowns(person: Path, out: Path, pieces: list[list[int]], total: int) -> None:
    """«макушка.json»: где на кадре верх головы (px по высоте 1920), по маске человека, во времени
    чистого ролика (вне кусков — null). Нужен слову за спикером: голова должна закрывать низ букв.
    По рамке лица макушка угадывается плохо (волосы у всех разной высоты), а маска знает точно."""
    sw, sh = W // 4, H // 4
    rd = subprocess.Popen([ffmpeg(), "-v", "error", "-c:v", "libvpx-vp9", "-i", str(person),
                           "-vf", f"alphaextract,scale={sw}:{sh}", "-fps_mode", "passthrough",
                           "-f", "rawvideo", "-pix_fmt", "gray", "-"], stdout=subprocess.PIPE)
    x0, x1 = CROWN_X[0] // 4, CROWN_X[1] // 4
    # время чистого ролика для каждого кадра webm
    src = [f for a, b in pieces for f in range(a, b)]
    ys: list[int | None] = [None] * ((total + CROWN_STEP - 1) // CROWN_STEP)
    k = 0
    while True:
        buf = rd.stdout.read(sw * sh)
        if len(buf) < sw * sh:
            break
        if k < len(src) and src[k] % CROWN_STEP == 0:
            a = np.frombuffer(buf, np.uint8).reshape(sh, sw)[:, x0:x1]
            rows = np.flatnonzero((a > 128).sum(axis=1) >= 3)
            ys[src[k] // CROWN_STEP] = int(rows[0]) * 4 if rows.size else None
        k += 1
    rd.wait()
    out.write_text(json.dumps({"шаг": CROWN_STEP / FPS, "y": ys}), encoding="utf-8")


def main() -> None:
    argv = sys.argv[1:]
    arg = argv[argv.index("--куски") + 1] if "--куски" in argv else None
    video = Path([a for a in argv if not a.startswith("--") and a != arg][0]).resolve()
    work = WORK / video.stem
    clean = work / f"{video.stem} — чистый.mp4"
    out, crown, info = work / "человек.webm", work / "макушка.json", work / "человек.json"
    total = frame_count(clean)
    pieces = pieces_from(arg, total)
    old = json.loads(info.read_text(encoding="utf-8"))["куски"] if info.exists() else None
    # прежний человек.webm без человек.json — это весь ролик
    have = [[a, b] for a, b, _ in old] if old else ([[0, total]] if out.exists() else None)
    covered = have is not None and all(any(a <= fa and fb <= b for a, b in have) for fa, fb in pieces)
    fresh = out.exists() and out.stat().st_mtime > clean.stat().st_mtime
    if not (fresh and covered) or "--заново" in sys.argv:
        print(f"Вырезаю человека из фона: {sum(b - a for a, b in pieces) / FPS:.0f} с ролика "
              "(около 6 минут на минуту)…", flush=True)
        matte(clean, out, pieces)
        have = pieces
    at, mapped = 0, []
    for a, b in have:
        mapped.append([a, b, at])
        at += b - a
    info.write_text(json.dumps({"куски": mapped}), encoding="utf-8")
    if not crown.exists() or crown.stat().st_mtime < out.stat().st_mtime:
        crowns(out, crown, have, total)


if __name__ == "__main__":
    main()
