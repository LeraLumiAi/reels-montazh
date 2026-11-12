"""Список звуков, которые есть в remotion/public/sfx/ — для образцов форматов.

Запуск:  python sfx_index.py
Пишет remotion/src/sfx-list.json. Запускать после того, как положили или поменяли звуки.
Звуки, которых нет в списке, при сборке просто пропускаются (ролик не падает).
mp3/m4a образцы не играют одинаково везде — лучше перевести в wav 48 кГц:
  ffmpeg -i "звук.mp3" -ar 48000 "звук.wav"
"""
import json

from paths import REMOTION

SFX = REMOTION / "public" / "sfx"


def main() -> None:
    files = sorted(p.relative_to(SFX).as_posix() for p in SFX.rglob("*")
                   if p.is_file() and p.suffix.lower() in (".wav", ".mp3", ".m4a", ".ogg"))
    out = REMOTION / "src" / "sfx-list.json"
    out.write_text(json.dumps(files, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Звуков найдено: {len(files)} → {out}")


if __name__ == "__main__":
    main()
