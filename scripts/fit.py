"""Подгонка под лимит длины.

Запуск:  python fit.py <видео> [--до 60]
Без --до берётся «максимум_секунд» из настроек (0 — без ограничения).
Нужен готовый «чистка.json» (cleanup.py).

Порядок (по ТЗ): сначала равномерное ускорение речи, не больше «предела» из настроек (1,3);
если не хватает — вырезаются самые слабые по смыслу куски. Их выбирает Claude по смыслу
и записывает в «подгонка.json» → "вырезать_слова" (тот же формат, что в «правки.json»),
затем снова запускаются cleanup.py и fit.py.

Результат: «Рабочие файлы/<имя видео>/подгонка.json» — лимит, скорость и вырезки для подгонки.
Его читают cleanup.py (вырезки) и build.py (скорость).
"""
import json
import math
import sys
from pathlib import Path

from cleanup import SETTINGS, WORK

MARGIN = 0.3   # запас, чтобы ролик точно влез в лимит после округлений


def phrases(words: list[dict]) -> list[tuple[int, int]]:
    """Фразы: граница после знака конца фразы или паузы > 0.6 с (как в phrases.py)."""
    out, start = [], 0
    for i, w in enumerate(words):
        nxt = words[i + 1] if i + 1 < len(words) else None
        if nxt is None or w["слово"][-1:] in ".?!…" or nxt["начало"] - w["конец"] > 0.6:
            out.append((start, i))
            start = i + 1
    return out


def kept(a: float, b: float, keep: list) -> float:
    """Сколько секунд отрезка [a, b] исходника осталось в ролике после чистки."""
    return sum(max(0.0, min(b, e) - max(a, s)) for s, e in keep)


def main() -> None:
    args = sys.argv[1:]
    video = Path([a for a in args if not a.startswith("--") and not a.isdigit()][0]).resolve()
    limit = float(args[args.index("--до") + 1]) if "--до" in args else SETTINGS["длина"]["максимум_секунд"]
    if 0 < limit < 60:
        sys.exit("Ролики короче 60 секунд не делаем (правило навыка: сокращаем не короче минуты). Укажите лимит от 60 с.")
    cap = SETTINGS["ускорение"]["предел"]
    out_dir = WORK / video.stem
    p = json.loads((out_dir / "чистка.json").read_text(encoding="utf-8"))
    words = json.loads((out_dir / "расшифровка.json").read_text(encoding="utf-8"))["слова"]

    f = out_dir / "подгонка.json"
    old = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
    cuts = old.get("вырезать_слова", [])
    if cuts and old.get("лимит") != limit:
        print(f"Лимит поменялся ({old.get('лимит')} → {limit} с): прежние вырезки для подгонки сброшены. "
              "Запустите cleanup.py ещё раз, чтобы вернуть эти куски.\n")
        cuts = []

    length = p["стало"]
    target = limit - MARGIN
    if not limit or length <= limit:
        speed = 1.0
        msg = (f"Ролик {length:.1f} с, лимита нет — ничего не сокращаем." if not limit else
               f"Ролик {length:.1f} с — в лимит {limit:.0f} с укладывается, сокращать не нужно.")
        short = 0.0
    else:
        need = length / target
        speed = min(cap, math.ceil(need * 1000) / 1000)
        short = max(0.0, length - target * cap)
        msg = (f"Ролик после чистки {length:.1f} с, лимит {limit:.0f} с.\n"
               f"Ускорение {speed:.3f} → получится {length / speed:.1f} с.")
        if short:
            msg += (f"\nУскорения до {cap} не хватает: надо вырезать ещё примерно {short:.1f} с "
                    f"самых слабых по смыслу кусков (в «подгонка.json» → \"вырезать_слова\").")

    f.write_text(json.dumps({"лимит": limit, "скорость": speed, "вырезать_слова": cuts},
                            ensure_ascii=False, indent=1), encoding="utf-8")
    print(msg)

    if short:
        print("\nФразы (номера слов, сколько секунд занимают в ролике после чистки):")
        for i, j in phrases(words):
            sec = kept(words[i]["начало"], words[j + 1]["начало"] if j + 1 < len(words) else p["было"], p["оставить"])
            if sec < 0.05:
                continue   # уже вырезана
            text = " ".join(w["слово"] for w in words[i:j + 1])
            print(f"  {i:4d}–{j:<4d} {sec:5.1f} с  {text}")


if __name__ == "__main__":
    main()
