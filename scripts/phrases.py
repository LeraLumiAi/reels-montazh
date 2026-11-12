"""Помощник для Claude: расшифровка с номерами слов и подсказки, где могут быть дубли.

Запуск:  python phrases.py <видео>
Печатает фразы с номерами слов (по ним в правки.json указывается, что вырезать)
и список мест, где подряд повторяются одни и те же слова — кандидаты в неудачные дубли.
Решение, дубль это или намеренный повтор («всё хорошо, всё хорошо»), принимает Claude по смыслу.
"""
import json
import sys
from pathlib import Path

from cleanup import WORK, norm


def main() -> None:
    video = Path(sys.argv[1]).resolve()
    words = json.loads((WORK / video.stem / "расшифровка.json").read_text(encoding="utf-8"))["слова"]

    # Фразы: новая строка после знака конца фразы или паузы > 0.6 с.
    line, start = [], 0
    for i, w in enumerate(words):
        if not line:
            start = w["начало"]
        line.append(f"{i}:{w['слово']}")
        nxt = words[i + 1] if i + 1 < len(words) else None
        if nxt is None or w["слово"][-1:] in ".?!…" or nxt["начало"] - w["конец"] > 0.6:
            print(f"[{start:6.2f}] " + " ".join(line))
            line = []

    # Кандидаты: одинаковые цепочки из 2+ слов (или начало фразы из 1 слова + запинка), близко друг к другу.
    n = [norm(w["слово"]) for w in words]
    print("\nВозможные дубли (повтор слов в пределах 15 с):")
    seen = set()
    for size in (5, 4, 3, 2):
        for i in range(len(n) - size):
            a = n[i:i + size]
            if any(not x for x in a):
                continue
            for j in range(i + 1, min(len(n) - size + 1, i + 40)):
                if words[j]["начало"] - words[i]["начало"] > 15:
                    break
                if n[j:j + size] == a and not any(k in seen for k in range(i, i + size)):
                    print(f"  слова {i}–{i + size - 1} ({words[i]['начало']:.2f} с) = "
                          f"{j}–{j + size - 1} ({words[j]['начало']:.2f} с): «{' '.join(a)}»")
                    seen.update(range(i, i + size))
                    break


if __name__ == "__main__":
    main()
