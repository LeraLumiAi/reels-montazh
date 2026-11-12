"""Разбивка речи на субтитры по 2–4 слова.

Запуск:  python subtitles.py <видео> [--заново]
Нужен «слова_чистые.json» (timeline.py).
Результат: «Рабочие файлы/<имя видео>/субтитры.json» и печать фраз с номерами.

Как устроен файл (его правит Claude по словам человека):
  {"фразы": [{"слова": [{"н": 12, "т": "ручку", "начало": 1.53, "конец": 2.03}, ...],
              "ключ": 12}]}
  «н»    — номер слова в расшифровке (как в phrases.py и правки.json);
  «т»    — как слово написано на экране (можно исправить ошибку расшифровки);
  «ключ» — номер слова, которое выделяется курсивом Playfair золотым цветом; null — без выделения.
  «разрывы» — правки разбивки, которые Claude делает по смыслу (переживают --заново):
     {"перед": [92], "не_перед": [92]} — номера слов, перед которыми фраза обязательно
     начинается / не должна начинаться («примеры наших | учеников» → "не_перед": [92]).
Ключевые слова и правки разрывов выбирает Claude по смыслу, а не программа.

Если файл уже есть, программа его не трогает. С --заново разбивает речь заново,
но сохраняет выбранные ключевые слова и исправленные написания (по номерам слов).
"""
import json
import re
import tomllib
import sys
from pathlib import Path

from textwidth import width
from paths import ROOT, WORK

_settings_file = ROOT / "настройки.toml"
_CAPS = tomllib.loads(_settings_file.read_text(encoding="utf-8")).get("субтитры", {}) if _settings_file.exists() else {}
STEMS = [x.lower() for x in _CAPS.get("с_большой_буквы", [])]
# Пара: ["генеральн", "директор"] — два отдельных слова; ["санкт", "петербург", "через дефис"] — одно слово.
PAIRS = [(pr[0].lower(), pr[1].lower()) for pr in _CAPS.get("пары_с_большой_буквы", [])]
HYPHEN_PAIRS = [(pr[0].lower(), pr[1].lower()) for pr in _CAPS.get("пары_с_большой_буквы", [])
                if len(pr) > 2 and pr[2] == "через дефис"]

SPACE = width(" ")

MAX_WORDS = 4
# Плашка в одну строку: кадр 1080 минус поля 96 по бокам и отступы внутри плашки 40 → 808 px текста
# при размере 64. Ширина меряется по настоящим шрифтам (textwidth.py). Ключевое слово ещё не выбрано,
# поэтому каждое слово меряется «с запасом»: как шире — Onest или курсив Playfair ×1,06.
# Если строка всё же не влезет, плашка при сборке сама чуть уменьшит шрифт (по тем же ширинам).
# Справа внизу кнопки Instagram (лайк, комментарий) — плашка не дальше x = 890,
# слева поле 110 (телефон обрезает края ролика). Совпадает с Subtitles.tsx и профилем стиля.
MAX_WIDTH = (900 - 10) - 110 - 2 * 40
KEY_SCALE = 1.06        # как keyScale в профиле стиля (remotion/src/styles/warmLight.ts)
PAUSE_BREAK = 0.25      # пауза после слова, после которой удобно начать новую фразу (секунды)

# Короткие служебные слова: строка не должна на них заканчиваться (правило переносов из стиля).
WEAK = set("""а и в во с со на к ко не ни о об обо от до по за из у но что как же бы ли то
он она оно они их её ее его ей ему мы я ты вы мне меня тебя тебе нас вас это этот эта эти
для при про без над под или да ну так если чтобы когда где который которая которые чем
там тут вот уже еще ещё очень самый такой такая свой своя свои мой моя твой твоя
через перед после между около вокруг среди ради сквозь вместо кроме""".split())


def bare(word: str) -> str:
    return re.sub(r"[^\w]", "", word.lower())


def cap(text: str) -> str:
    """Первая буква — заглавная (кавычки и знаки впереди не мешают): «москва» → «Москва»."""
    return re.sub(r"[^\W\d_]", lambda m: m.group().upper(), text, count=1)


def honorifics(words: list[dict]) -> None:
    """Слова, которые всегда пишутся с большой буквы, — из настроек (["субтитры"] в настройки.toml):
      "с_большой_буквы"       — начала слов: ["москв"] → Москва, Москвы, Москве…;
      "пары_с_большой_буквы"  — пары слов, обе с большой: [["санкт", "петербург", "через дефис"]] → Санкт-Петербург,
                                [["генеральн", "директор"]] → Генеральный Директор.
    Меняет «т» прямо в списке слов (по всей речи подряд, через границы фраз)."""
    for i, w in enumerate(words):
        parts = w["т"].split("-")
        b0 = bare(parts[0])
        if any(b0.startswith(st) for st in STEMS):
            w["т"] = cap(w["т"])
        if len(parts) == 2 and any(b0.startswith(a) and bare(parts[1]).startswith(b) for a, b in PAIRS):
            w["т"] = "-".join(cap(part) for part in parts)
        elif i > 0 and any(bare(words[i - 1]["т"]).startswith(a) and b0.startswith(b) for a, b in PAIRS):
            w["т"], words[i - 1]["т"] = cap(w["т"]), cap(words[i - 1]["т"])


def screen_text(word: str) -> str:
    """Как слово пишется на экране: без запятых и точек на конце, «?» и «!» остаются."""
    return re.sub(r"[,.;:…]+$", "", word.strip())


def measure(w: dict) -> dict:
    """Ширины слова при размере 64: «ш» — Onest 600, «шк» — курсив Playfair (без увеличения).
    По ним плашка в Remotion точно знает длину строки."""
    return {**w, "ш": round(width(w["т"]), 1), "шк": round(width(w["т"], "Playfair Italic"), 1)}


def length(group: list[dict]) -> float:
    """Ширина фразы в пикселях «с запасом» (любое слово может стать ключевым)."""
    return sum(max(w["ш"], w["шк"] * KEY_SCALE) for w in group) + SPACE * (len(group) - 1)


def join_hyphens(words: list[dict]) -> list[dict]:
    """Whisper пишет «Санкт -Петербург», «очень -очень» двумя словами — склеиваем в одно.
    Пары из настроек («пары_с_большой_буквы», через дефис) склеиваются и без дефиса."""
    res = []
    for w in words:
        pair = res and any(bare(res[-1]["т"]).startswith(a) and bare(w["т"]).startswith(b) for a, b in HYPHEN_PAIRS) \
            and res[-1]["т"][-1:].isalpha()
        if res and (w["слово"].startswith("-") or pair):
            # дефис добавляем, только если его не было (иначе «--»)
            dash = "-" if pair and not w["слово"].startswith("-") else ""
            res[-1] = {**res[-1], "слово": res[-1]["слово"] + dash + w["слово"], "т": res[-1]["т"] + dash + w["т"],
                       "конец": w["конец"]}
        else:
            res.append(w)
    return res


def break_cost(w: dict, nxt: dict) -> tuple[float, float]:
    """Цена разрыва фразы после слова w и цена того, что разрыва тут нет."""
    mark = w["слово"][-1:]
    pause = nxt["начало"] - w["конец"]
    if mark in ".?!…":
        cut, keep = 0.0, 6.0          # конец предложения — почти всегда новая фраза
    elif mark in ",;:—":
        cut, keep = 0.1, 0.8
    elif pause > PAUSE_BREAK:
        cut, keep = 0.3, 0.4
    else:
        cut, keep = 1.2, 0.0
    if bare(w["т"]) in WEAK:
        cut += 4.0                    # строка не заканчивается на «и», «на», «тебе»…
    return cut, keep


def group_cost(g: list[dict]) -> float:
    n = len(g)
    if n == 1:
        cost = 0.6 if len(g[0]["т"]) >= 9 else 2.0   # одно короткое слово на экране — мелькает
    else:
        cost = {2: 0.3, 3: 0.0, 4: 0.2}[n]
    if g[-1]["конец"] - g[0]["начало"] < 0.6:
        cost += 0.5                   # фраза короче 0,6 с не успевает прочитаться
    return cost


def split(words: list[dict], force: set = frozenset(), forbid: set = frozenset()) -> list[list[dict]]:
    """Лучшая разбивка всей речи сразу (а не слово за словом): учитывает знаки препинания,
    паузы, длину строки и правило «не заканчивать строку служебным словом»."""
    n = len(words)
    costs = [break_cost(words[i], words[i + 1]) for i in range(n - 1)]
    for i in range(n - 1):          # правки Claude сильнее любых правил
        if words[i + 1]["н"] in force:
            costs[i] = (0.0, 100.0)
        elif words[i + 1]["н"] in forbid:
            costs[i] = (100.0, 0.0)
    best = [0.0] + [float("inf")] * n     # best[j] — цена лучшей разбивки первых j слов
    prev = [0] * (n + 1)
    for j in range(1, n + 1):
        for k in range(1, MAX_WORDS + 1):
            i = j - k
            if i < 0:
                break
            g = words[i:j]
            if k > 1 and length(g) > MAX_WIDTH and not any(w["н"] in forbid for w in g[1:]):
                break
            inner = sum(costs[t][1] for t in range(i, j - 1))
            edge = costs[j - 1][0] if j < n else 0.0
            c = best[i] + group_cost(g) + inner + edge
            if c < best[j]:
                best[j], prev[j] = c, i
    groups, j = [], n
    while j > 0:
        groups.insert(0, words[prev[j]:j])
        j = prev[j]
    return groups


def main() -> None:
    video = Path([a for a in sys.argv[1:] if not a.startswith("--")][0]).resolve()
    out_dir = WORK / video.stem
    out = out_dir / "субтитры.json"
    if out.exists() and "--заново" not in sys.argv:
        data = json.loads(out.read_text(encoding="utf-8"))
        if "--тихо" not in sys.argv:
            print(f"Субтитры уже есть (с --заново — разбить заново): {out}")
    else:
        clean = json.loads((out_dir / "слова_чистые.json").read_text(encoding="utf-8"))
        old_keys, old_text, breaks = set(), {}, {"перед": [], "не_перед": []}
        if out.exists():   # сохраняем то, что выбрал Claude или поправил человек
            old = json.loads(out.read_text(encoding="utf-8"))
            breaks = old.get("разрывы", breaks)
            for p in old["фразы"]:
                if p.get("ключ") is not None:
                    old_keys.add(p["ключ"])
                old_text.update({w["н"]: w["т"] for w in p["слова"]})
        words = [{"н": w["н"], "слово": w["слово"], "т": screen_text(w["слово"]),
                  "начало": w["начало"], "конец": w["конец"]} for w in clean["слова"]]
        # Сохранённые написания — после склейки: склеенное слово хранится под номером первой половинки.
        # Если слово только что склеилось, старое написание половинки не берём.
        words = [measure({**w, "т": w["т"] if "-" in w["т"] and "-" not in old_text.get(w["н"], "-")
                          else old_text.get(w["н"], w["т"])}) for w in join_hyphens(words)]
        phrases = []
        for g in split(words, set(breaks.get("перед", [])), set(breaks.get("не_перед", []))):
            key = next((w["н"] for w in g if w["н"] in old_keys), None)
            phrases.append({"слова": [{k: w[k] for k in ("н", "т", "начало", "конец", "ш", "шк")} for w in g],
                            "ключ": key})
        data = {"длина": clean["длина"], "разрывы": breaks, "фразы": phrases}
        print(f"Субтитры: {len(phrases)} фраз → {out}")

    # Заглавные буквы (из настроек) и ширины — при каждом запуске:
    # Claude мог поправить написание («нее» → «неё»), а правило должно действовать и на старые файлы.
    honorifics([w for p in data["фразы"] for w in p["слова"]])
    data["пробел"] = round(SPACE, 1)
    for p in data["фразы"]:
        p["слова"] = [measure(w) for w in p["слова"]]
        wide = sum(w["шк"] * KEY_SCALE if w["н"] == p.get("ключ") else w["ш"] for w in p["слова"]) + \
            SPACE * (len(p["слова"]) - 1)
        if wide > MAX_WIDTH:
            print(f"  фраза «{' '.join(w['т'] for w in p['слова'])}» шире плашки на {wide - MAX_WIDTH:.0f} px "
                  f"— шрифт в ней будет чуть мельче; лучше разбить (\"разрывы\" → \"перед\")")
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

    if "--тихо" in sys.argv:      # overlay.py: только обновить ширины и предупредить
        return
    for i, p in enumerate(data["фразы"]):
        text = " ".join(f"*{w['т']}*" if w["н"] == p.get("ключ") else w["т"] for w in p["слова"])
        nums = f"{p['слова'][0]['н']}–{p['слова'][-1]['н']}"
        print(f"{i:3d} [{p['слова'][0]['начало']:6.2f}] ({nums}) {text}")


if __name__ == "__main__":
    main()
