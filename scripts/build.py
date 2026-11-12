"""Сборка чистого ролика по плану чистки.

Запуск:  python build.py <видео> [--черновик]
Нужен готовый «чистка.json» (cleanup.py).
Результат в «Рабочие файлы/<имя видео>/»:
  «<название> — чистый.mp4» — полное качество: 1080×1920, ровно 30 кадров/с, для Instagram;
  с флагом --черновик — «<название> — черновик.mp4» (540×960, быстро и в низком качестве).
"""
import json
import subprocess
import sys
import time
import tomllib
from pathlib import Path
from paths import ROOT, WORK

SETTINGS = tomllib.loads((ROOT / "настройки.toml").read_text(encoding="utf-8"))

# Качество сборки. crf — чем меньше, тем лучше картинка и больше файл (18 — на глаз без потерь).
QUALITY = {
    "черновик": {"scale": 0.5, "preset": "ultrafast", "crf": 30, "audio": "96k"},
    "финал":    {"scale": 1.0, "preset": "slow",      "crf": 18, "audio": "192k"},
}


def speed_of(video: Path) -> float:
    """Скорость из «подгонка.json» (fit.py); 1.0, если подгонки не было."""
    f = WORK / video.stem / "подгонка.json"
    return json.loads(f.read_text(encoding="utf-8")).get("скорость", 1.0) if f.exists() else 1.0


def render(video: Path, keep: list, out: Path, quality: str = "финал", speed: float = 1.0) -> None:
    """Склеивает оставленные куски (с микро-затуханием звука на стыках, чтобы не щёлкало)
    и приводит к вертикальному формату. Телефон пишет с «плавающей» частотой кадров —
    фильтр fps делает её ровно 30, как требует Instagram.
    speed > 1 — равномерное ускорение: atempo ускоряет речь без «мультяшного» голоса."""
    q = QUALITY[quality]
    v = SETTINGS["видео"]
    w, h = int(v["ширина"] * q["scale"]) // 2 * 2, int(v["высота"] * q["scale"]) // 2 * 2
    parts, labels = [], []
    for i, (s, e) in enumerate(keep):
        f = min(0.01, (e - s) / 4)
        parts.append(f"[0:v]trim={s}:{e},setpts=PTS-STARTPTS[v{i}];"
                     f"[0:a]atrim={s}:{e},asetpts=PTS-STARTPTS,aresample=48000,"
                     f"afade=t=in:d={f},afade=t=out:st={e - s - f:.3f}:d={f}[a{i}];")
        labels.append(f"[v{i}][a{i}]")
    tempo_v = f"setpts=PTS/{speed}," if speed != 1 else ""
    tempo_a = f"[a]atempo={speed}[ao];" if speed != 1 else "[a]anull[ao];"
    graph = "".join(parts) + "".join(labels) + f"concat=n={len(keep)}:v=1:a=1[v][a];" + tempo_a + \
        f"[v]{tempo_v}scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos," \
        f"crop={w}:{h},setsar=1,fps={v['кадров_в_секунду']},format=yuv420p[vo]"
    script = out.with_suffix(".filter.txt")
    script.write_text(graph, encoding="utf-8")
    try:
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-stats", "-i", str(video),
                        "-/filter_complex", str(script), "-map", "[vo]", "-map", "[ao]",
                        "-c:v", "libx264", "-preset", q["preset"], "-crf", str(q["crf"]),
                        "-profile:v", "high", "-r", str(v["кадров_в_секунду"]),
                        "-c:a", "aac", "-b:a", q["audio"], "-ar", "48000",
                        "-movflags", "+faststart", str(out)], check=True)
    finally:
        script.unlink(missing_ok=True)


def source_size(video: Path) -> tuple[int, int]:
    """Размер исходника так, как его видит человек (с учётом поворота телефона)."""
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height:stream_side_data=rotation", "-of", "json", str(video)],
                         capture_output=True, text=True, encoding="utf-8").stdout
    s = json.loads(out)["streams"][0]
    rot = next((abs(int(d.get("rotation", 0))) for d in s.get("side_data_list", [])), 0)
    return (s["height"], s["width"]) if rot in (90, 270) else (s["width"], s["height"])


def main() -> None:
    video = Path([a for a in sys.argv[1:] if not a.startswith("--")][0]).resolve()
    w, h = source_size(video)
    v = SETTINGS["видео"]
    if w < v["ширина"] or h < v["высота"]:
        print(f"Внимание: исходник «{video.name}» снят в размере {w}×{h}, меньше нужных "
              f"{v['ширина']}×{v['высота']}. Ролик соберётся, но картинка будет чуть мягче. "
              f"Совет: в настройках камеры телефона выбрать разрешение FHD (1080p).\n")
    out_dir = WORK / video.stem
    keep = json.loads((out_dir / "чистка.json").read_text(encoding="utf-8"))["оставить"]
    draft = "--черновик" in sys.argv
    out = out_dir / f"{video.stem} — {'черновик' if draft else 'чистый'}.mp4"
    t = time.time()
    speed = speed_of(video)
    if speed != 1:
        print(f"Ускорение речи: {speed}")
    render(video, keep, out, "черновик" if draft else "финал", speed)
    print(f"\nГотово за {time.time() - t:.0f} с: {out}")


if __name__ == "__main__":
    main()
