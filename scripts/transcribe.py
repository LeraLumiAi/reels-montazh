"""Расшифровка речи с временем каждого слова.

Запуск:  python transcribe.py <видео>
Результат: «Рабочие файлы/<имя видео>/расшифровка.json» и «расшифровка.txt».
Если расшифровка уже есть, повторно не делается (флаг --заново, чтобы переделать).
"""
import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel
from paths import ROOT, WORK

MODEL = "large-v3-turbo"
# Подсказка, чтобы модель не «причёсывала» речь и записывала паразиты и запинки.
PROMPT = "Э-э, ну, вот, как бы, мм... Ну, я, э, хотела сказать, что, ну, это важно."


def extract_audio(video: Path):
    """Звук из видео: моно, 16 кГц, массив чисел — то, что нужно модели."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    redo = "--заново" in sys.argv
    video = Path(args[0]).resolve()
    out_dir = WORK / video.stem
    out_dir.mkdir(parents=True, exist_ok=True)
    out_json = out_dir / "расшифровка.json"
    if out_json.exists() and not redo:
        print(f"Расшифровка уже есть: {out_json}")
        return

    audio = extract_audio(video)

    t0 = time.time()
    model = WhisperModel(MODEL, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        audio,
        language="ru",
        word_timestamps=True,
        # Сначала находим, где есть речь: запись режется на куски по паузам, а не посреди фразы,
        # и модель не «слышит» несуществующие фразы в тишине.
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500, "speech_pad_ms": 300},
        initial_prompt=PROMPT,
        condition_on_previous_text=False,
        beam_size=5,
    )
    words, lines = [], []
    for seg in segments:
        seg_words = []
        for w in seg.words or []:
            item = {"слово": w.word.strip(), "начало": round(w.start, 2), "конец": round(w.end, 2),
                    "уверенность": round(w.probability, 2)}
            words.append(item)
            seg_words.append(item)
        if seg_words:
            lines.append(f"[{seg.start:6.2f} – {seg.end:6.2f}] {seg.text.strip()}")
        print(lines[-1] if seg_words else "", flush=True)

    data = {"видео": str(video), "длительность": round(info.duration, 2), "модель": MODEL, "слова": words}
    out_json.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    (out_dir / "расшифровка.txt").write_text("\n".join(lines), encoding="utf-8")
    print(f"\nГотово за {time.time() - t0:.0f} с. Видео {info.duration:.0f} с, слов: {len(words)}.")


if __name__ == "__main__":
    main()
