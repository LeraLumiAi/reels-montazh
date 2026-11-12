"""Дубль ролика с другой концовкой (для ТикТока и т. п.): без призыва «напиши в комментариях слово…».

Запуск:  python dub.py <видео> --от <н> [--убрать <н,н>] [--имя ТикТок]
  --от      — номер слова, с которого показывать новую карточку в конце (обычно начало последней фразы перед призывом);
  --убрать  — номера слов «от» у карточек, которые убрать в дубле (если мешают новой карточке);
  --имя     — приписка к названию: «<тема> — ТикТок».
Что делает (оригинал не трогает):
  1. копирует исходник в «исходники/<тема> — <имя>.mp4» и рабочие файлы (правки, подгонка, субтитры, карточки,
     лицо, человек.webm, макушка.json — призыв в конце, вырезка его не сдвигает, маска годится);
  2. в «правки.json» вырезает всё от слова «Пиши/Напиши» до конца;
  3. меняет карточку «призыв» на «Забирайте подарок по ссылке в шапке профиля» (текст — из настроек, превью подарка — как было);
  4. ставит «хвост» 1,5 с — последний кадр с карточкой держится после последнего слова (без него ролик обрывается);
  5. пересобирает чистый ролик, время слов, субтитры. Финал собирает overlay.py.
Важно: последняя фраза перед призывом должна быть законченной без него («Я рассказываю про…» — нет: убрать её тоже).
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path
import tomllib
from paths import ROOT, SRC, WORK

# Подпись автора и текст карточки в конце дубля — из настроек (["автор"] и ["тикток"] в настройки.toml).
_S = tomllib.loads((ROOT / "настройки.toml").read_text(encoding="utf-8"))
SIGN = _S.get("автор", {}).get("подпись", "")
END_TITLE = _S.get("тикток", {}).get("заголовок", "Забирайте *подарок*")
END_BELOW = _S.get("тикток", {}).get("ниже", "по ссылке\nв шапке профиля")

COPY = ["расшифровка.json", "расшифровка.txt", "правки.json", "подгонка.json", "субтитры.json", "карточки.json",
        "лицо.json", "человек.webm", "человек.json", "макушка.json"]


def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


def main() -> None:
    video = Path([a for a in sys.argv[1:] if not a.startswith("--")][0]).resolve()
    topic, name = video.stem, arg("--имя", "ТикТок")
    start = int(arg("--от"))
    drop = {int(x) for x in arg("--убрать", "").split(",") if x}
    new = f"{topic} — {name}"
    src_w, dst_w = WORK / topic, WORK / new
    dst_w.mkdir(exist_ok=True)
    shutil.copy2(video, SRC / f"{new}.mp4")
    for f in COPY:
        if (src_w / f).exists():
            shutil.copy2(src_w / f, dst_w / f)

    words = json.loads((dst_w / "расшифровка.json").read_text(encoding="utf-8"))["слова"]
    call = max(i for i, w in enumerate(words) if w["слово"].lower().strip("«»\"").startswith(("напиши", "пиши")))
    p = dst_w / "правки.json"
    edits = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"вырезать_слова": []}
    edits["вырезать_слова"].append({"с": call, "по": len(words) - 1,
                                    "почему": f"{name}: нет механики «слово в комментарии» — призыв заменён карточкой «Забирайте подарок»"})
    p.write_text(json.dumps(edits, ensure_ascii=False, indent=1), encoding="utf-8")

    c = dst_w / "карточки.json"
    cards = json.loads(c.read_text(encoding="utf-8"))
    old = next(x for x in cards["карточки"] if x["тип"] == "призыв")
    keep = [x for x in cards["карточки"] if x["тип"] != "призыв" and x.get("от") not in drop]
    for x in keep:                        # карточка перед новой — заканчивается до неё
        if x.get("до", 0) >= start:
            x["до"] = start - 1
    keep.append({"тип": "призыв", "от": start, "до": call - 1, "подпись": SIGN,
                 "заголовок": END_TITLE, "ниже": END_BELOW, "гайд": old.get("гайд")})
    cards["карточки"] = keep
    cards["хвост"] = 1.5
    c.write_text(json.dumps(cards, ensure_ascii=False, indent=1), encoding="utf-8")

    v = str(SRC / f"{new}.mp4")
    # fit.py не запускаем: подгонка (вырезки, скорость) берётся как в основном ролике (иначе fit сбрасывает ускорение и вырезки)
    for step in (["cleanup.py", v], ["build.py", v], ["timeline.py", v], ["subtitles.py", v, "--заново"]):
        subprocess.run([sys.executable, str(Path(__file__).with_name(step[0])), *step[1:]], check=True,
                       stdout=subprocess.DEVNULL)
    # чистый ролик новее маски — но маска та же (вырезан только конец): помечаем её свежей, чтобы не считать заново
    for f in ("человек.webm", "макушка.json", "лицо.json"):
        if (dst_w / f).exists():
            (dst_w / f).touch()
    print(f"Дубль готов к сборке: {new} (призыв вырезан со слова {call}, карточка со слова {start})")


if __name__ == "__main__":
    main()
