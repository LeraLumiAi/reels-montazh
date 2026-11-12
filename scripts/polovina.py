"""Формат «полэкрана, анимация под слова» (сверху спикер, снизу стекло со сценами) — сборка.

Запуск:  python polovina.py <видео> [--черновик] [--тикток] [--сдвиг 150] [--шов 1280]
Нужны чистый ролик, «слова_чистые.json» и «субтитры.json» (build.py → timeline.py → subtitles.py).
Сцены и их привязка к словам — в remotion/src/Polovina.tsx (сцены пишутся под каждый ролик, см. styles/polekrana.md).
Результат: «Готовые/<тема>.mp4» (или «Рабочие файлы/<тема>/<тема> — черновик полэкрана.mp4»)
и копия для окна сбоку «… — для просмотра.webm».
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path
from paths import REMOTION, ROOT, WORK



def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


def main() -> None:
    video = Path([a for a in sys.argv[1:] if not a.startswith("--") and not a.replace(".", "").isdigit()][0]).resolve()
    topic = video.stem
    work = WORK / topic
    draft = "--черновик" in sys.argv
    clean = work / f"{topic} — чистый.mp4"
    public = REMOTION / "public" / "полэкрана" / f"{topic}.mp4"
    public.parent.mkdir(exist_ok=True)
    if not public.exists() or public.stat().st_mtime < clean.stat().st_mtime:
        shutil.copy2(clean, public)
    words = json.loads((work / "слова_чистые.json").read_text(encoding="utf-8"))
    subs = json.loads((work / "субтитры.json").read_text(encoding="utf-8"))
    props = {"video": f"полэкрана/{public.name}", "phrases": subs["фразы"], "space": subs["пробел"],
             "length": words["длина"], "shift": float(arg("--сдвиг", 150)), "seam": float(arg("--шов", 1280)),
             "words": [{"н": w["н"], "начало": w["начало"], "конец": w["конец"]} for w in words["слова"]],
             # --тикток: дубль без призыва (слова призыва вырезаны в правки.json), «Забирайте подарок» + хвост 2,5 с
             "tiktok": "--тикток" in sys.argv, "tail": 2.5 if "--тикток" in sys.argv else 0}
    props_file = work / "полэкрана.props.json"
    props_file.write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")

    out = (work / f"{topic} — черновик полэкрана.mp4") if draft else (ROOT / "Готовые" / f"{topic}.mp4")
    tmp = out.with_name(out.stem + " (сборка).mp4")
    cmd = [shutil.which("npx") or "npx", "remotion", "render", "src/index.ts", "Polovina", str(tmp), f"--props={props_file}",
           "--codec=h264", "--audio-codec=aac", "--log=error",
           # стандартный цвет: без этих флагов выходит yuvj420p, и окно сбоку его не играет (9 ноября)
           "--pixel-format=yuv420p", "--color-space=bt709"]
    cmd += ["--scale=0.5", "--crf=24", "--audio-bitrate=96k"] if draft else ["--crf=14", "--audio-bitrate=192k"]
    print(f"Собираю {words['длина']:.0f} с ({'черновик' if draft else 'финал'})…", flush=True)
    subprocess.run(cmd, cwd=REMOTION, check=True)
    # как в overlay.py: High 4.1, без B-кадров, опорный кадр раз в секунду — без полос на слабых видеокартах
    fixed = out.with_name(out.stem + " (запись).mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-c:v", "libx264", "-profile:v", "high", "-level", "4.1",
                    "-crf", "24" if draft else "16", "-bf", "0", "-g", "30", "-pix_fmt", "yuv420p",
                    "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                    "-c:a", "copy", "-movflags", "+faststart", str(fixed)], check=True)
    tmp.unlink()
    fixed.replace(out)
    view = work / f"{out.stem} — для просмотра.webm"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-vf", "scale=540:-2,format=yuv420p",
                    "-c:v", "libvpx-vp9", "-b:v", "2M", "-deadline", "realtime", "-cpu-used", "8",
                    "-color_range", "tv", "-colorspace", "bt709", "-c:a", "libopus", "-b:a", "96k", str(view)], check=True)
    print(f"Готово: {out}\nСмотреть сбоку: {view}")


if __name__ == "__main__":
    main()
