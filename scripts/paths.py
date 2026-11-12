"""Где что лежит.

Навык (скрипты, движок Remotion, модель) и рабочая папка с видео — разные места.

Рабочая папка ищется так:
  1. переменная окружения MONTAZH_WORK, если задана;
  2. иначе — ближайшая папка вверх от текущей, где лежит «настройки.toml»
     (или подпапка «монтаж» с ним);
  3. иначе — «./монтаж» (её создаёт init.py).

Движок Remotion по умолчанию лежит в папке навыка: <навык>/remotion (можно переопределить MONTAZH_REMOTION).
Модель для вырезания человека — <навык>/models (MONTAZH_MODELS).
"""
import os
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent


def _work() -> Path:
    env = os.environ.get("MONTAZH_WORK")
    if env:
        return Path(env).expanduser().resolve()
    here = Path.cwd().resolve()
    for p in [here, *here.parents]:
        if (p / "настройки.toml").exists():
            return p
        if (p / "монтаж" / "настройки.toml").exists():
            return p / "монтаж"
    return here / "монтаж"


ROOT = _work()
WORK = ROOT / "Рабочие файлы"
READY = ROOT / "Готовые"
SRC = ROOT / "исходники"
INBOX = ROOT / "Входящие"
REMOTION = Path(os.environ.get("MONTAZH_REMOTION", SKILL / "remotion")).expanduser()
MODELS = Path(os.environ.get("MONTAZH_MODELS", SKILL / "models")).expanduser()
