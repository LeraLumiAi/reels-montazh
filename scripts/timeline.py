"""Время слов в чистом ролике.

Запуск:  python timeline.py <видео>
Нужны «расшифровка.json» (transcribe.py) и «чистка.json» (cleanup.py).
После вырезок слова сдвигаются: слово, сказанное в исходнике на 40-й секунде,
в чистом ролике звучит, например, на 31-й. Этот файл пересчитывает время каждого слова,
чтобы субтитры (и потом карточки) попадали точно в речь.

Результат в «Рабочие файлы/<имя видео>/слова_чистые.json»:
  «длина»   — длина чистого ролика в секундах (с учётом ускорения);
  «склейки» — моменты стыков в чистом ролике (там можно менять план кадра);
  «слова»   — [{"н": номер слова в расшифровке, "слово", "начало", "конец"}] в секундах чистого ролика.
Вырезанные слова (паразиты, дубли, правки, выжимка) в список не попадают.
"""
import bisect
import json
import re
import subprocess
import sys
from pathlib import Path

from cleanup import SETTINGS, WORK, find_silences


def removed_by_edit(w: dict, cuts: list[dict]) -> bool:
    """То же правило, что в отчёте «чистка.txt»: слово вырезано, если его накрыла вырезка
    не из-за паузы (паразит, дубль, правка), включая конец слова (с запасом 0,3 с)."""
    mid = w["начало"] + 0.02
    return any(c["начало"] <= mid and mid + 0.15 <= c["конец"] and w["конец"] <= c["конец"] + 0.3 and any(
        not part.startswith(("пауза", "тишина")) for part in c["почему"].split(" + ")) for c in cuts)


def snap_to_sound(w: dict, quiet: list) -> dict:
    """Если начало слова попало в тишину, а само слово звучит после неё, — начало переносится
    на конец тишины. Так же конец слова, растянутый на паузу после него, — на её начало."""
    a, b = w["начало"], w["конец"]
    for s, e in quiet:
        if s <= a < e < b:
            a = e
        if a < s < b <= e:
            b = s
    # Тихий вдох или пауза короче 0,15 с тишиной не считаются, а Whisper растягивает на них
    # начало слова («у» на 0,64 с, «Когда» на 1,3 с). Конец слова у Whisper надёжный,
    # поэтому слишком длинное слово укорачиваем с начала: 0,15 с + 0,1 с на букву.
    longest = 0.15 + 0.1 * len(re.sub(r"[^\w]", "", w["слово"]))
    a = max(a, b - longest)
    return {**w, "начало": a, "конец": b}


def segment_lengths(video: Path, keep: list) -> list[tuple[float, float]]:
    """Сколько каждый оставленный кусок длится в собранном ролике: (начало в исходнике, длина).
    Фильтр trim оставляет кадры от первого с временем ≥ начала до последнего с временем < конца,
    а склейка берёт длину по более длинной из дорожек — картинке или звуку."""
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "packet=pts_time", "-of", "csv=p=0", str(video)],
                         capture_output=True, text=True, check=True).stdout
    pts = sorted(float(x) for x in out.split() if x.strip() and x != "N/A")
    step = (pts[-1] - pts[0]) / max(len(pts) - 1, 1)
    res = []
    for s, e in keep:
        i, j = bisect.bisect_left(pts, s), bisect.bisect_left(pts, e)
        picture = (pts[j] if j < len(pts) else pts[-1] + step) - pts[min(i, len(pts) - 1)]
        res.append((s, max(picture, e - s)))
    return res


def to_clean(t: float, keep: list, offsets: list) -> float | None:
    """Секунда исходника → секунда чистого ролика (без ускорения); None, если момент вырезан.
    Внутри куска звук идёт с его начала без сдвига, поэтому достаточно смещения куска."""
    for (s, e), off in zip(keep, offsets):
        if s <= t <= e:
            return off + t - s
    return None


def build(video: Path) -> dict:
    out_dir = WORK / video.stem
    words = json.loads((out_dir / "расшифровка.json").read_text(encoding="utf-8"))["слова"]
    plan = json.loads((out_dir / "чистка.json").read_text(encoding="utf-8"))
    keep, cuts = plan["оставить"], plan["вырезать"]
    fit = out_dir / "подгонка.json"
    speed = json.loads(fit.read_text(encoding="utf-8")).get("скорость", 1.0) if fit.exists() else 1.0

    # Где начинается каждый оставленный кусок в чистом ролике. Звук внутри куска режется точно
    # по секундам, но склейка в build.py (concat) выравнивает кусок по более длинной дорожке:
    # картинка округляется до целых кадров, и звук дополняется крохотной тишиной.
    # Без учёта этого субтитры к концу ролика отстают на 0,1–0,2 с (проверено 4 ноября).
    offsets, total = [], 0.0
    for s, e in segment_lengths(video, keep):
        offsets.append(total)
        total += e

    # Whisper иногда ставит начало слова на тишину перед ним (до 0,7 с раньше настоящего) —
    # тогда подсветка зажглась бы раньше голоса. Сверяем края слов с настоящей тишиной в звуке.
    quiet = find_silences(video, SETTINGS["чистка"]["порог_тишины_дб"], 0.15)

    result, lost = [], []
    for i, w in enumerate(words):
        if removed_by_edit(w, cuts):
            continue
        w = snap_to_sound(w, quiet)
        # Какие части слова остались. Whisper растягивает слово на соседнюю тишину,
        # а тишину cleanup.py вырезал — поэтому слово обрезается по краям оставленных кусков.
        pieces = [(max(s, w["начало"]), min(e, w["конец"])) for s, e in keep
                  if min(e, w["конец"]) - max(s, w["начало"]) > 0.005]
        if not pieces:
            lost.append(f"{i}:{w['слово']}")
            continue
        a, b = to_clean(pieces[0][0], keep, offsets), to_clean(pieces[-1][1], keep, offsets)
        result.append({"н": i, "слово": w["слово"], "начало": round(a / speed, 3), "конец": round(b / speed, 3)})

    if lost:
        print("Внимание: эти слова целиком попали в вырезанную паузу и пропущены в субтитрах: " + ", ".join(lost))
    return {"длина": round(total / speed, 3), "скорость": speed,
            "склейки": [round(o / speed, 3) for o in offsets[1:]], "слова": result}


def main() -> None:
    video = Path(sys.argv[1]).resolve()
    data = build(video)
    out = WORK / video.stem / "слова_чистые.json"
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Чистый ролик {data['длина']:.1f} с, слов {len(data['слова'])}, склеек {len(data['склейки'])}: {out}")


if __name__ == "__main__":
    main()
