"""Оформление: субтитры (и дальше — динамика, карточки) поверх чистого ролика.

Запуск:  python overlay.py <видео> [--тест [с какой секунды]] [--черновик]
Нужны «<тема> — чистый.mp4» (build.py) и «субтитры.json» (subtitles.py).
  --тест      — режим «тест стиля»: 30 секунд (с начала или с указанной секунды)
                → «Рабочие файлы/<тема>/<тема> — тест стиля.mp4»;
  --черновик  — весь ролик в половинном размере, быстро → «<тема> — черновик с оформлением.mp4»;
  без флагов  — финал в полном качестве → «Готовые/<тема>.mp4».
Сборкой занимается Remotion (папка навыка remotion/).
"""
import json
import shutil
import subprocess
import sys
import time
import tomllib
from pathlib import Path
from paths import READY, REMOTION, ROOT, WORK

SETTINGS = tomllib.loads((ROOT / "настройки.toml").read_text(encoding="utf-8"))
TEST_SECONDS = 30
# Цвета, шрифты, размеры и место субтитров — в профиле стиля:
# remotion/src/styles/ (стиль выбирается в настройки.toml).
# Своё место плашки для одного ролика: --субтитры-y 1300 (центр плашки, px по высоте 1920).
# Ниже зоны Instagram плашка всё равно не опустится (Subtitles.tsx).


def arg_after(flag: str):
    if flag in sys.argv:
        i = sys.argv.index(flag)
        if i + 1 < len(sys.argv) and not sys.argv[i + 1].startswith("--"):
            return sys.argv[i + 1]
    return None


HOLD = 0.6        # с: карточка держится после последнего своего слова
GAP_BETWEEN = 0.2 # с: между карточками — чтобы одна успела погаснуть до следующей
SERIES_GAP = 3.0  # с: «шаги» с одной подписью ближе этого — одна серия, плашка между ними не гаснет


def load_cards(work: Path, length: float) -> list:
    """Карточки из «карточки.json»: время задаётся номерами слов (как в phrases.py / субтитры.json),
    чтобы карточка оставалась на своей фразе, даже если вырезки поменялись.
    "от": н — карточка появляется с началом слова; "до": н — держится до конца слова + HOLD.
    У пунктов списка "слово": н — пункт появляется, когда его произносят.
    Можно задать и прямо секундами: "с" / "по"."""
    f = work / "карточки.json"
    if not f.exists():
        return []
    words = {w["н"]: w for w in json.loads((work / "слова_чистые.json").read_text(encoding="utf-8"))["слова"]}

    def word(n, what):
        if n not in words:
            sys.exit(f"Карточка «{what}»: слова №{n} нет в чистом ролике (вырезано?). Поправьте карточки.json.")
        return words[n]

    cards = []
    for c in json.loads(f.read_text(encoding="utf-8"))["карточки"]:
        c = dict(c)
        name = c.get("тип", "?")
        if "от" in c:
            c["с"] = word(c.pop("от"), name)["начало"]
        if "до" in c:
            c["по"] = word(c.pop("до"), name)["конец"] + (0.3 if name in ("слово", "экран") else HOLD)
        for item in c.get("пункты", []):
            if "слово" in item:
                item["с"] = word(item.pop("слово"), name)["начало"]
        if c["по"] >= length - 0.05:     # последняя карточка — стоит до последнего кадра, не гаснет
            c["по"], c["до_конца"] = length, True
        c["по"] = min(c["по"], length)
        cards.append(c)
    cards.sort(key=lambda c: c["с"])
    for a, b in zip(cards, cards[1:]):
        # Серия («Не стоит спрашивать · 1, 2, 3»): плашка не гаснет между карточками — меняются только
        # цифра и слово. Иначе плашка мигает, а если там ещё и смена ракурса — «дёргается».
        if a["тип"] == b["тип"] == "шаг" and a.get("подпись") == b.get("подпись") and b["с"] - a["по"] < SERIES_GAP:
            a["по"], a["дальше"], b["продолжение"] = b["с"], True, True
        else:                            # не накладываются
            a["по"] = min(a["по"], b["с"] - GAP_BETWEEN)
    # Все «шаги» с одной подписью — один размер шрифта и одна ширина плашки (Cards.tsx подбирает размер
    # по самой длинной строке): «1 про другого», «2 про деньги», «3 про путешествие» выглядят одинаково.
    groups: dict = {}
    for c in cards:
        if c["тип"] == "шаг":
            groups.setdefault(c.get("подпись"), []).append(c)
    for group in groups.values():
        texts = [f'{c.get("цифра", "")}  {c.get("слово", "")}' for c in group]
        for c in group:
            c["серия"] = texts
    return cards


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    video = Path(args[0]).resolve()
    topic = video.stem
    work = WORK / topic
    clean = work / f"{topic} — чистый.mp4"
    # subtitles.py без --заново ничего не переразбивает, только обновляет ширины слов
    # (если Claude поправил написание) и предупреждает о слишком длинных фразах.
    subprocess.run([sys.executable, str(Path(__file__).with_name("subtitles.py")), str(video), "--тихо"], check=True)
    subs = json.loads((work / "субтитры.json").read_text(encoding="utf-8"))
    length = subs["длина"]

    test, draft = "--тест" in sys.argv, "--черновик" in sys.argv
    start = float(arg_after("--тест") or 0) if test else 0.0
    duration = min(TEST_SECONDS, length - start) if test else length
    if test:
        out = work / f"{topic} — тест стиля.mp4"
    elif draft:
        out = work / f"{topic} — черновик с оформлением.mp4"
    else:
        READY.mkdir(exist_ok=True)
        out = READY / f"{topic}.mp4"

    # Remotion берёт видео из своей папки public/. Копируем, только если ролик поменялся.
    public = REMOTION / "public" / f"{topic}.mp4"
    if not public.exists() or public.stat().st_size != clean.stat().st_size or \
            public.stat().st_mtime < clean.stat().st_mtime:
        shutil.copy2(clean, public)

    # Где лицо: чтобы плашка не наезжала на подбородок (и для приближений). Считается за секунды.
    subprocess.run([sys.executable, str(Path(__file__).with_name("face.py")), str(video)], check=True)
    faces = json.loads((work / "лицо.json").read_text(encoding="utf-8"))

    cards = load_cards(work, length)
    # Текст за спикером (этап 4): нужен человек без фона. Считается один раз на ролик (matte.py).
    person = crown = person_pieces = None
    if any(c["тип"] == "за спикером" for c in cards):
        # только куски со словом за спикером (9 ноября: в 10–20 раз быстрее, чем весь ролик)
        spans = ",".join(f'{c["с"]:.2f}-{c["по"]:.2f}' for c in cards if c["тип"] == "за спикером")
        subprocess.run([sys.executable, str(Path(__file__).with_name("matte.py")), str(video), "--куски", spans], check=True)
        src, person = work / "человек.webm", REMOTION / "public" / f"{topic} — человек.webm"
        if not person.exists() or person.stat().st_mtime < src.stat().st_mtime:
            shutil.copy2(src, person)
        person = person.name
        crown = json.loads((work / "макушка.json").read_text(encoding="utf-8"))
        person_pieces = json.loads((work / "человек.json").read_text(encoding="utf-8"))["куски"]

    props = {"video": public.name, "person": person, "personPieces": person_pieces, "crown": crown, "phrases": subs["фразы"], "space": subs["пробел"], "length": length,
             "from": start, "duration": duration, "faces": faces,
             "style": SETTINGS["оформление"]["стиль"],
             "subtitleY": float(arg_after("--субтитры-y")) if arg_after("--субтитры-y") else None,
             # склейки — там меняется план (средний ↔ крупный), так задумано
             "cuts": json.loads((work / "слова_чистые.json").read_text(encoding="utf-8"))["склейки"],
             "cards": cards}
    # Раскадровка всегда по тем же файлам, что и ролик, — обновляем её при каждой сборке.
    subprocess.run([sys.executable, str(Path(__file__).with_name("storyboard.py")), str(video)], check=True)
    props_file = work / "оформление.props.json"
    props_file.write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")

    # Remotion пишет во временный файл, потом FFmpeg перепаковывает его «для любого плеера» (см. compat).
    raw = out.with_name(out.stem + " (сборка).mp4")
    cmd = [shutil.which("npx") or "npx", "remotion", "render", "src/index.ts", "Reel", str(raw),
           f"--props={props_file}", "--codec=h264", "--audio-codec=aac", "--log=error",
           # Стандартный цвет для Instagram и телефонов. По умолчанию Remotion писал yuvj420p
           # («полный диапазон»), из-за него на некоторых плеерах цвета чуть плывут.
           "--pixel-format=yuv420p", "--color-space=bt709"]
    # Временный файл — с запасом качества (crf ниже), итоговое сжатие делает compat.
    cmd += ["--scale=0.5", "--crf=24", "--audio-bitrate=96k"] if draft else ["--crf=14", "--audio-bitrate=192k"]
    print(f"Собираю {duration:.0f} с ({'тест стиля' if test else 'черновик' if draft else 'финал'})…", flush=True)
    t = time.time()
    subprocess.run(cmd, cwd=REMOTION, check=True)
    # «хвост» в карточки.json — сколько секунд держать последний кадр (с карточкой) после последнего слова.
    # 5 ноября, дубль для ТикТока: без призыва ролик обрывался прямо на слове — «режешь очень резко».
    cf = work / "карточки.json"
    tail = 0.0 if test else float(json.loads(cf.read_text(encoding="utf-8")).get("хвост", 0)) if cf.exists() else 0.0
    compat(raw, out, draft, tail)
    raw.unlink()
    view = preview(out, work)
    print(f"Готово за {time.time() - t:.0f} с: {out}")
    print(f"Смотреть сбоку (без полос): {view}")


def compat(src: Path, dst: Path, draft: bool, tail: float = 0.0) -> None:
    """Перепаковка «для любого плеера» (на некоторых компьютерах начало ролика «полосит»).
    Remotion (x264 по умолчанию) ставил опорный кадр раз в 8 с и кадры-«двунаправленные» (B-кадры) со сдвигом
    времени в начале файла. Если плеер (здесь — видеокарта AMD) сбивается на первых кадрах, ошибка тянется
    до следующего опорного кадра — первые 8 с идут полосами. Теперь: опорный кадр каждую секунду, без B-кадров
    (нет сдвига в начале), уровень 4.1, стандартный цвет bt709. Instagram всё равно пережимает сам."""
    subprocess.run([shutil.which("ffmpeg") or "ffmpeg", "-y", "-v", "error", "-i", str(src),
                    "-c:v", "libx264", "-preset", "veryfast" if draft else "medium", "-crf", "28" if draft else "18",
                    "-profile:v", "high", "-level:v", "4.1", "-bf", "0", "-g", "30", "-keyint_min", "30", "-sc_threshold", "0",
                    "-pix_fmt", "yuv420p", "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                    *(["-vf", f"tpad=stop_mode=clone:stop_duration={tail}", "-af", f"apad=pad_dur={tail}",
                       "-c:a", "aac", "-b:a", "96k" if draft else "192k"] if tail else ["-c:a", "copy"]),
                    "-movflags", "+faststart", str(tmp_of(dst))], check=True)
    swap_in(dst)


def preview(src: Path, work: Path) -> Path:
    """Копия для просмотра в окне сбоку — в формате webm (VP9).
    На некоторых компьютерах mp4 размером 1080×1920 в окне сбоку «полосит» (видеокарта AMD сбивается на H.264
    такого размера), а тот же кадр в webm и mp4 720×1280 — чистые. В Instagram идёт mp4 из «Готовых»,
    эта копия — только чтобы смотреть. Показывать её: preview_start с file:// адресом."""
    dst = work / f"{src.stem} — для просмотра.webm"
    subprocess.run([shutil.which("ffmpeg") or "ffmpeg", "-y", "-v", "error", "-i", str(src),
                    "-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-deadline", "realtime", "-cpu-used", "8",
                    "-row-mt", "1", "-pix_fmt", "yuv420p", "-c:a", "libopus", "-b:a", "128k", str(tmp_of(dst))], check=True)
    swap_in(dst)
    return dst


def tmp_of(dst: Path) -> Path:
    return dst.with_name(dst.stem + " (запись)" + dst.suffix)


def swap_in(dst: Path) -> None:
    """Готовый файл подменяет старый одним движением, только когда записан целиком.
    Пересборка не должна писать прямо в файл, который человек в это время смотрит в окне сбоку, —
    ролик «поплыл, полосил, обрезался, без субтитров». Теперь недописанный файл никогда не лежит
    под рабочим именем. Если старый файл занят (открыт), новый остаётся рядом с пометкой «(запись)»."""
    tmp = tmp_of(dst)
    try:
        tmp.replace(dst)
    except PermissionError:
        print(f"  ВНИМАНИЕ: «{dst.name}» сейчас открыт — новая версия лежит рядом: «{tmp.name}»")


if __name__ == "__main__":
    main()
