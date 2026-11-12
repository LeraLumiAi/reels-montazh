"""Первая настройка: рабочая папка с видео и проверка, что всё установлено.

Запуск:  python init.py [папка]      (по умолчанию — ./монтаж в текущей папке)
Создаёт папки «Входящие», «исходники», «Рабочие файлы», «Готовые», кладёт «настройки.toml», «прогрев.md»
и «просмотр.html» из шаблонов навыка (уже существующие файлы не трогает).
Потом проверяет: ffmpeg, Node.js, движок Remotion, Python-библиотеки, модель для вырезания человека.
"""
import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path

from paths import MODELS, REMOTION, SKILL


def check(name: str, ok: bool, fix: str) -> bool:
    print(f"  {'✓' if ok else '✗'} {name}" + ("" if ok else f" — {fix}"))
    return ok


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    root = Path(args[0]).expanduser().resolve() if args else Path.cwd() / "монтаж"
    for d in ("Входящие", "исходники", "Рабочие файлы", "Готовые"):
        (root / d).mkdir(parents=True, exist_ok=True)
    for f in ("настройки.toml", "просмотр.html", "прогрев.md", "Как пользоваться.md"):
        if not (root / f).exists():
            shutil.copy2(SKILL / "templates" / f, root / f)
    print(f"Рабочая папка: {root}")

    print("Проверка:")
    good = True
    good &= check("ffmpeg", bool(shutil.which("ffmpeg")), "поставить ffmpeg (см. install/УСТАНОВКА.md)")
    node = shutil.which("node")
    good &= check("Node.js", bool(node), "поставить Node.js 20+ (nodejs.org)")
    good &= check("движок Remotion (node_modules)", (REMOTION / "node_modules" / "remotion").exists(),
                  f"в папке {REMOTION} выполнить: npm ci")
    for mod, pip in (("faster_whisper", "faster-whisper"), ("cv2", "opencv-python-headless"),
                     ("numpy", "numpy"), ("fontTools", "fonttools"), ("brotli", "Brotli"),
                     ("onnxruntime", "onnxruntime")):
        good &= check(f"Python: {pip}", importlib.util.find_spec(mod) is not None,
                      f"pip install -r {SKILL / 'install' / 'requirements.txt'}")
    check("модель для «слова за спикером» (необязательно)", (MODELS / "rvm_mobilenetv3_fp32.onnx").exists(),
          "скачать по ссылке из models/README.md")
    if node:
        v = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip()
        print(f"  Node.js {v}")
    print("Всё готово." if good else "Есть что доставить — см. строки с ✗.")


if __name__ == "__main__":
    main()
