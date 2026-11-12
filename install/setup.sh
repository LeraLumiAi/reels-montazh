#!/usr/bin/env bash
# Установка навыка монтажа на macOS / Linux. Запуск из папки навыка:  bash install/setup.sh
# ffmpeg, Python 3.11+ и Node.js 20+ должны быть установлены (см. install/УСТАНОВКА.md, шаг 1).
set -e
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
VENV="${MONTAZH_VENV:-$HOME/.montazh-venv}"
[ -x "$VENV/bin/python" ] || python3 -m venv "$VENV"
"$VENV/bin/python" -m pip install --upgrade pip
"$VENV/bin/python" -m pip install -r "$SKILL/install/requirements.txt"
(cd "$SKILL/remotion" && npm ci)
MODEL="$SKILL/models/rvm_mobilenetv3_fp32.onnx"
[ -f "$MODEL" ] || curl -L -o "$MODEL" https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx
"$VENV/bin/python" "$SKILL/scripts/sfx_index.py"
echo
echo "Готово. Python навыка: $VENV/bin/python"
echo "Дальше: в папке, где будут видео:  \"$VENV/bin/python\" \"$SKILL/scripts/init.py\""
