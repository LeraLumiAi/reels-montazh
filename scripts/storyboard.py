"""Раскадровка: план ролика по секундам — для человека, на одной странице.

Запуск:  python storyboard.py <видео>
Читает то, по чему собирается ролик:
  карточки.json      — какие карточки и на каких словах (правит Claude по словам человека);
  слова_чистые.json  — что и когда звучит в чистом ролике, где склейки (timeline.py);
  субтитры.json      — фразы и ключевые слова (subtitles.py);
  правки.json, подгонка.json, чистка.json — что вырезано и почему;
  remotion/src/camera.ts — правила смены плана (крупный ↔ средний).
Пишет «Рабочие файлы/<тема>/раскадровка.html». Сам файл ничего не решает:
ролик собирается (overlay.py) из тех же файлов, поэтому раскадровка и ролик всегда совпадают.
"""
import html
import json
import re
import sys
import tomllib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from overlay import load_cards  # noqa: E402
from paths import REMOTION, ROOT, WORK

CAMERA_TS = REMOTION / "src" / "camera.ts"
SETTINGS = tomllib.loads((ROOT / "настройки.toml").read_text(encoding="utf-8"))
FPS = 30

# Как карточки называются для человека (в файле — короткие типы).
NAMES = {"заголовок": "Заголовок в начале", "шаг": "Номер (история, пункт)", "бейдж": "Карточка-досье",
         "цитата": "Цитата", "слово": "Слово на весь экран", "экран": "Экран цветом с фразой", "список": "Список", "дата": "Календарь",
         "призыв": "Призыв в конце", "за спикером": "Слово за спикером"}
# На карточке-календаре месяц стоит отдельно («НОЯБРЬ»), в тексте нужен «11 ноября».
MONTHS = {"январь": "января", "февраль": "февраля", "март": "марта", "апрель": "апреля", "май": "мая", "июнь": "июня",
          "июль": "июля", "август": "августа", "сентябрь": "сентября", "октябрь": "октября", "ноябрь": "ноября", "декабрь": "декабря"}


def load(work: Path, name: str, default=None):
    f = work / name
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else default


def mmss(t: float) -> str:
    t = round(t)
    return f"{t // 60}:{t % 60:02d}"


def rich(text: str) -> str:
    """*курсив* → <em>, перенос строки → пробел."""
    t = html.escape(text.replace("\n", " "))
    return re.sub(r"\*([^*]+)\*", r"<em>\1</em>", t)


def card_text(c: dict) -> str:
    t = c["тип"]
    if t == "заголовок":
        return rich(c.get("текст", ""))
    if t == "шаг":
        return f'{html.escape(c.get("подпись", ""))}: <em>{html.escape(c.get("цифра", ""))} {html.escape(c.get("слово", ""))}</em>'
    if t == "бейдж":
        return f'{html.escape(c.get("подпись", ""))}: {rich(c.get("главное", ""))}, {html.escape(c.get("ниже", ""))}'
    if t == "цитата":
        return f'«{rich(c.get("текст", ""))}»'
    if t == "слово":
        return f'{html.escape(c.get("подпись", ""))} <b>{html.escape(c.get("слово", ""))}</b>'
    if t == "экран":
        return f'{rich(c.get("текст", ""))} — на весь экран, цвет: {html.escape(c.get("цвет", "тёмная"))}'
    if t == "за спикером":
        return f'<b>{html.escape(c.get("слово", "").upper())}</b> — огромное, позади головы'
    if t == "список":
        items = " · ".join(html.escape(i["т"]) for i in c.get("пункты", []))
        return f'{rich(c.get("заголовок", ""))}: {items}'
    if t == "дата":
        month = MONTHS.get(c.get("месяц", "").lower(), c.get("месяц", "").lower())
        return f'{html.escape(c.get("число", ""))} {html.escape(month)} — {rich(c.get("заголовок", ""))}, {html.escape(c.get("ниже", ""))}'
    if t == "призыв":
        return f'{rich(c.get("заголовок", ""))} {rich(c.get("ниже", ""))}'
    return ""


def camera_rules() -> dict:
    """Числа из camera.ts — чтобы раскадровка не расходилась с роликом."""
    src = CAMERA_TS.read_text(encoding="utf-8")
    get = lambda k: float(re.search(rf"\b{k}:\s*([\d.]+)", src).group(1))
    return {"minShot": get("minShot"), "minTail": get("minTail")}


def shot_changes(cuts: list, length: float) -> list:
    """Те же правила, что planShots в camera.ts: план меняется на первой склейке,
    до которой от прошлой смены прошло ≥ minShot, и не позже minTail до конца."""
    r = camera_rules()
    bounds = [0.0]
    for c in cuts:
        c = round(c * FPS) / FPS
        if c - bounds[-1] >= r["minShot"] and length - c >= r["minTail"]:
            bounds.append(c)
    return bounds  # план i: средний для чётных, крупный для нечётных


def main() -> None:
    video = Path(sys.argv[1])
    topic = video.stem
    work = WORK / topic
    words = load(work, "слова_чистые.json")
    length = words["длина"]
    clean_words = words["слова"]
    by_n = {w["н"]: w for w in clean_words}
    subs = load(work, "субтитры.json")
    raw = {w.get("н", i): w for i, w in enumerate(load(work, "расшифровка.json")["слова"])}

    # Карточки — во времени чистого ролика (как в overlay.py: от начала слова «от» до конца слова «до»).
    # Берём ту же функцию, что и сборка, — времена совпадают до сотых.
    timed = [{**c, "№": i} for i, c in enumerate(load_cards(work, length), 1)]

    # Что вырезано по смыслу (паузы — одной строкой в шапке). Место — после последнего оставленного слова перед вырезкой.
    cuts = []
    for src in ("правки.json", "подгонка.json"):
        for cut in (load(work, src, {}) or {}).get("вырезать_слова", []):
            before = [w for w in clean_words if w["н"] < cut["с"]]
            at = before[-1]["конец"] if before else 0.0
            text = " ".join(raw[n]["слово"] for n in range(cut["с"], cut["по"] + 1) if n in raw)
            why = re.sub(r"^(выжимка|просьба|дубль|запинка):?\s*", lambda m: {"выжимка": "", "просьба": "по вашей просьбе: "}.get(m.group(1), m.group(0)), cut["почему"])
            cuts.append({"at": at, "text": text.strip(), "why": why})
    cleanup = load(work, "чистка.json", {})
    pauses_total = (cleanup.get("было", 0) - cleanup.get("стало", 0)) if cleanup else 0
    cut_by_meaning = sum(1 for _ in cuts)

    # Смены плана
    bounds = shot_changes(words["склейки"], length)
    shots = [(bounds[i], i % 2) for i in range(len(bounds))]

    # Строки раскадровки: границы — начала и концы карточек и смены плана, но не короче ~4 с.
    marks = sorted({0.0, length, *[c["с"] for c in timed], *[c["по"] for c in timed], *bounds})
    rows, last = [], 0.0
    for m in marks[1:]:
        if m - last >= 4 or m == length:
            rows.append((last, m))
            last = m
    phrases = subs["фразы"]

    def said(a, b):
        out = []
        for p in phrases:
            t0 = p["слова"][0]["начало"]
            if a <= t0 < b:
                out.append(" ".join(f'<em>{html.escape(w["т"])}</em>' if w["н"] == p.get("ключ") else html.escape(w["т"]) for w in p["слова"]))
        return " / ".join(out)

    style = SETTINGS["оформление"]
    has_title = any(c["тип"] == "заголовок" for c in timed)
    has_cta = any(c["тип"] == "призыв" for c in timed)
    gaps = [b["с"] - a["с"] for a, b in zip(timed, timed[1:])]

    body = []
    for a, b in rows:
        cells_screen = []
        for c in timed:
            if a <= c["с"] < b:
                light = " light" if c.get("тема") == "светлая" else ""
                cells_screen.append(f'<div class="card{light}"><span class="num">{c["№"]}</span><div><div class="kind">{NAMES.get(c["тип"], c["тип"])}'
                                    f' · {mmss(c["с"])}–{mmss(c["по"])}</div><div class="ctext">{card_text(c)}</div></div></div>')
        for t, close in shots:
            if a <= t < b and t > 0:
                cells_screen.append(f'<div class="shot">Ракурс → {"крупный" if close else "средний"} план · {mmss(t)}</div>')
        if a == 0:
            cells_screen.append('<div class="shot">Начало: средний план</div>')
        cut_html = "".join(f'<div class="cut">✂ «{html.escape(c["text"])}»<span>{html.escape(c["why"])}</span></div>'
                           for c in cuts if a <= c["at"] < b or (b == length and c["at"] >= b))
        body.append(f'<tr><td class="time">{mmss(a)}<br><span>–{mmss(b)}</span></td>'
                    f'<td class="said">{said(a, b)}{cut_html}</td><td class="screen">{"".join(cells_screen)}</td></tr>')

    summary = [
        f"Длина ролика <b>{mmss(length)}</b> (запись была {mmss(cleanup.get('было', length))})",
        f"Карточек <b>{len(timed)}</b>" + (f", в среднем раз в {sum(gaps) / len(gaps):.0f} с" if gaps else ""),
        f"Заголовок в начале: <b>{'есть' if has_title else 'нет'}</b>",
        f"Карточка с призывом в конце: <b>{'есть' if has_cta else 'нет'}</b>",
        f"Смен ракурса: <b>{len(bounds) - 1}</b> (не чаще раза в {camera_rules()['minShot']:.0f} с)",
        f"Вырезано: паузы и запинки, всего {pauses_total:.0f} с; по смыслу — {cut_by_meaning} кусков (✂ в тексте)",
    ]
    page = TEMPLATE.replace("{{TOPIC}}", html.escape(topic)).replace("{{SUMMARY}}", "".join(f"<li>{s}</li>" for s in summary)) \
        .replace("{{ROWS}}", "\n".join(body)).replace("{{STYLE}}", html.escape(style["стиль"]))
    out = work / "раскадровка.html"
    out.write_text(page, encoding="utf-8")
    print(f"Раскадровка: {out}")
    print(f"  {len(timed)} карточек, {len(bounds) - 1} смен ракурса, {cut_by_meaning} вырезок по смыслу, {len(rows)} строк")


TEMPLATE = """<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Раскадровка — {{TOPIC}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600&family=Playfair+Display:ital@1&display=swap" rel="stylesheet">
<style>
:root{--bg:#F7F2EA;--bg2:#FCF9F4;--sand:#E8DCCB;--line:#D8CBB8;--ink:#3A332E;--muted:#6B5E54;--accent:#7E5A2E;--caramel:#8A6446;
  --dark:#2A221D;--dark2:#362C26;--on-dark:#F3EAE0;--gold:#E0BE7A;--muted-dark:#BFAE9E}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.5 Onest,system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:40px 24px 80px}
.cap{font-weight:500;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:10px}
.cap:before{content:"";width:8px;height:8px;border-radius:4px;background:#D9B36C;box-shadow:0 0 12px 3px rgba(217,179,108,.45)}
h1{font-weight:600;font-size:36px;line-height:1.15;margin:12px 0 20px}
h1 em,em{font-family:"Playfair Display",serif;font-style:italic;color:var(--accent);font-weight:400}
ul.sum{list-style:none;padding:20px 24px;margin:0 0 28px;background:var(--bg2);border:1px solid var(--line);border-radius:20px;
  display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:8px 24px}
ul.sum b{font-weight:600}
.how{color:var(--muted);margin:0 0 28px}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-weight:500;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);padding:0 12px 10px;border-bottom:1px solid var(--line)}
td{vertical-align:top;padding:16px 12px;border-bottom:1px solid var(--line)}
td.time{width:76px;font-weight:600;white-space:nowrap}
td.time span{font-weight:400;color:var(--muted)}
td.said{width:46%}
td.screen{width:42%}
.card{display:flex;gap:14px;align-items:flex-start;background:var(--dark);color:var(--on-dark);border-radius:14px;padding:14px 16px;margin-bottom:10px}
.card em{color:var(--gold)}
.card.light{background:var(--bg2);color:var(--ink);border:1px solid var(--line)}
.card.light em{color:var(--accent)}
.num{flex:none;width:30px;height:30px;border-radius:15px;background:var(--gold);color:var(--dark);font-weight:600;display:grid;place-items:center;font-size:15px}
.card.light .num{background:var(--sand);color:var(--ink)}
.kind{font-weight:500;font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.75;margin-bottom:4px}
.ctext{font-size:17px;line-height:1.35}
.shot{color:var(--caramel);font-weight:500;font-size:15px;margin:2px 0 8px}
.cut{margin-top:10px;padding:8px 12px;border-left:3px solid var(--line);color:var(--muted);font-size:15px;text-decoration:line-through;text-decoration-color:rgba(107,94,84,.5)}
.cut span{display:block;text-decoration:none;font-size:13px;margin-top:2px}
@media (max-width:720px){
  main{padding:24px 16px 60px} h1{font-size:28px}
  table,tbody,tr,td{display:block;width:100%!important} thead{display:none}
  tr{border-bottom:1px solid var(--line);padding:12px 0} td{border:0;padding:6px 0}
}
</style></head>
<body><main>
<div class="cap">Раскадровка · стиль «{{STYLE}}»</div>
<h1>{{TOPIC}}</h1>
<ul class="sum">{{SUMMARY}}</ul>
<p class="how">Слева — что ты говоришь (курсивом — выделенные слова в субтитрах, зачёркнуто — что вырезано).
Справа — что появляется на экране. Правки пиши словами: «убери карточку 3», «карточку 5 подольше», «верни фразу про волка».</p>
<table><thead><tr><th>Время</th><th>Что ты говоришь</th><th>Что на экране</th></tr></thead>
<tbody>
{{ROWS}}
</tbody></table>
</main></body></html>
"""

if __name__ == "__main__":
    main()
