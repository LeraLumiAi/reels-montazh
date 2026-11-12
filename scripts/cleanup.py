"""Чистка: находит паузы и слова-паразиты и составляет план вырезки.

Запуск:  python cleanup.py <видео> [--черновик]
Нужна готовая расшифровка (transcribe.py).
Результат в «Рабочие файлы/<имя видео>/»:
  чистка.json — что оставить и что вырезать (по нему потом собирается ролик);
  чистка.txt  — то же простыми словами;
  «<название> — черновик.mp4» — с флагом --черновик: быстрый ролик в низком качестве, чтобы послушать.
"""
import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path
from paths import ROOT, WORK

SETTINGS = tomllib.loads((ROOT / "настройки.toml").read_text(encoding="utf-8"))


def norm(word: str) -> str:
    return re.sub(r"[^\w-]", "", word.lower()).replace("ё", "е").strip("-")


def find_silences(video: Path, noise_db: float, min_len: float) -> list[tuple[float, float]]:
    log = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(video), "-vn", "-af",
         f"silencedetect=noise={noise_db}dB:d={min_len}", "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    ).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [(float(e), float(d)) for e, d in re.findall(r"silence_end: ([\d.]+) \| silence_duration: ([\d.]+)", log)]
    result = [(e - d, e) for e, d in ends]
    if len(starts) > len(ends):           # тишина до самого конца файла
        result.append((starts[-1], float("inf")))
    return result


def find_fillers(words: list[dict], fillers: list[str]) -> list[tuple[float, float, str]]:
    patterns = sorted((f.split() for f in fillers), key=len, reverse=True)
    found, i = [], 0
    normed = [norm(w["слово"]) for w in words]
    while i < len(words):
        for p in patterns:
            if normed[i:i + len(p)] == p:
                found.append((words[i]["начало"], words[i + len(p) - 1]["конец"], " ".join(p)))
                i += len(p)
                break
        else:
            i += 1
    return found


def word_edits(video: Path, out_dir: Path, words: list[dict], duration: float, pad: float):
    """Вырезки по номерам слов из «правки.json» (дубли, оговорки, правки человека).

    Формат: {"вырезать_слова": [{"с": 219, "по": 219, "почему": "дубль: ..."}]}
    Необязательно: "от_секунды" / "до_секунды" — точный край вырезки в секундах исходника.
    Whisper неточно ставит границы слов, поэтому края вырезки «прилипают» к ближайшей
    настоящей тишине в звуке, если она есть рядом.
    """
    # правки.json — дубли, оговорки, правки человека; подгонка.json — слабые куски для лимита длины.
    edits = []
    for name, why in (("правки.json", "правка"), ("подгонка.json", "подгонка")):
        f = out_dir / name
        if f.exists():
            edits += [{"почему": why, **ed} for ed in
                      json.loads(f.read_text(encoding="utf-8")).get("вырезать_слова", [])]
    if not edits:
        return []
    fine = find_silences(video, SETTINGS["чистка"]["порог_тишины_дб"], 0.15)
    result = []
    for ed in edits:
        i, j = ed["с"], ed["по"]
        start = words[i]["начало"]
        end = words[j + 1]["начало"] if j + 1 < len(words) else duration
        for s, e in fine:
            if start - 0.35 <= e <= start + 0.3:
                start = s + pad
            if end - 0.3 <= e <= end + 0.35:
                end = e - pad
        # Если рядом нет тишины длиннее 0,15 с, Claude может задать край вручную по графику громкости.
        start = ed.get("от_секунды", start)
        end = ed.get("до_секунды", end)
        text =" ".join(w["слово"] for w in words[i:j + 1])
        result.append((start, end, f"{ed['почему']}: «{text}»"))
    return result


def merge(cuts):
    cuts = sorted(cuts)
    out = []
    for s, e, why in cuts:
        if out and s <= out[-1][1] + 0.05:
            ps, pe, pwhy = out[-1]
            out[-1] = (ps, max(pe, e), pwhy if why == pwhy else f"{pwhy} + {why}")
        else:
            out.append((s, e, why))
    return out


def plan(video: Path) -> dict:
    out_dir = WORK / video.stem
    data = json.loads((out_dir / "расшифровка.json").read_text(encoding="utf-8"))
    duration, words = data["длительность"], data["слова"]
    c = SETTINGS["чистка"]
    pad = c["оставить_тишины"] / 2

    cuts = []
    for s, e in find_silences(video, c["порог_тишины_дб"], c["пауза_больше"]):
        e = min(e, duration)
        if s <= 0.05:
            cuts.append((0.0, max(0.0, e - pad), "тишина в начале"))
        elif e >= duration - 0.05:
            cuts.append((s + pad, duration, "тишина в конце"))
        else:
            cuts.append((s + pad, e - pad, "пауза"))
    for s, e, w in find_fillers(words, c["паразиты"]):
        cuts.append((s, e, f"паразит «{w}»"))
    cuts += word_edits(video, out_dir, words, duration, pad)
    cuts = [(round(s, 2), round(e, 2), why) for s, e, why in merge(cuts) if e - s >= 0.05]

    keep, t = [], 0.0
    for s, e, _ in cuts:
        if s > t:
            keep.append((round(t, 2), s))
        t = max(t, e)
    if t < duration:
        keep.append((round(t, 2), duration))

    return {"видео": str(video), "было": duration,
            "стало": round(sum(e - s for s, e in keep), 2),
            "оставить": keep,
            "вырезать": [{"начало": s, "конец": e, "почему": why} for s, e, why in cuts]}


def readable(p: dict, words: list[dict]) -> str:
    lines = [f"Было {p['было']:.1f} с → стало {p['стало']:.1f} с "
             f"(вырезано {p['было'] - p['стало']:.1f} с, кусков: {len(p['вырезать'])})", "", "Что вырезано:"]
    for c in p["вырезать"]:
        lines.append(f"  {c['начало']:6.2f}–{c['конец']:6.2f}  ({c['конец'] - c['начало']:.2f} с)  {c['почему']}")
    lines += ["", "Текст после чистки ([в скобках] — вырезанные слова):", ""]
    text = []
    for w in words:
        mid = w["начало"] + 0.02   # начало слова надёжнее середины: конец Whisper растягивает
        # Whisper растягивает слова на соседние паузы, поэтому слово считаем вырезанным,
        # только если его убрали как паразит, дубль или правку, а не как паузу.
        # Whisper иногда ставит начало слова раньше настоящего (на тишину перед ним), поэтому
        # слово считается вырезанным, только если вырезка накрывает и его конец (с запасом 0,3 с).
        removed = any(c["начало"] <= mid and mid + 0.15 <= c["конец"] and w["конец"] <= c["конец"] + 0.3 and any(
            not part.startswith(("пауза", "тишина")) for part in c["почему"].split(" + "))
            for c in p["вырезать"])
        text.append(f"[{w['слово']}]" if removed else w["слово"])
    lines.append(" ".join(text))
    return "\n".join(lines)


def draft(video: Path, keep: list, out: Path) -> None:
    """Быстрый черновик 540×960 — та же сборка, что и финал (build.py), только в низком качестве."""
    from build import render, speed_of
    render(video, keep, out, "черновик", speed_of(video))


def main() -> None:
    video = Path([a for a in sys.argv[1:] if not a.startswith("--")][0]).resolve()
    out_dir = WORK / video.stem
    words = json.loads((out_dir / "расшифровка.json").read_text(encoding="utf-8"))["слова"]
    p = plan(video)
    (out_dir / "чистка.json").write_text(json.dumps(p, ensure_ascii=False, indent=1), encoding="utf-8")
    text = readable(p, words)
    (out_dir / "чистка.txt").write_text(text, encoding="utf-8")
    print(text)
    if "--черновик" in sys.argv:
        out = out_dir / f"{video.stem} — черновик.mp4"
        draft(video, p["оставить"], out)
        print(f"\nЧерновик: {out}")


if __name__ == "__main__":
    main()
