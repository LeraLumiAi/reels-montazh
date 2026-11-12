"""Настоящая ширина текста по файлам шрифтов (а не «средняя буква»).

Нужна, чтобы фраза субтитра точно влезала в плашку. Особенно это важно для курсива Playfair:
он шире Onest, и «с белоснежными крыльями» с выделенным словом вылезала за край (4 ноября).
Шрифты берутся из проекта Remotion (npm @fontsource), там они разбиты на кириллицу и латиницу.
"""
from functools import lru_cache
from pathlib import Path

from fontTools.ttLib import TTFont
from paths import REMOTION

FILES = REMOTION / "node_modules" / "@fontsource"
FONTS = {
    "Onest 600": [FILES / "onest" / "files" / f"onest-{s}-600-normal.woff2" for s in ("cyrillic", "latin")],
    "Playfair Italic": [FILES / "playfair-display" / "files" / f"playfair-display-{s}-400-italic.woff2"
                        for s in ("cyrillic", "latin")],
}


@lru_cache(maxsize=None)
def _metrics(font: str) -> tuple[dict, float]:
    """{символ: ширина в долях кегля} по всем частям шрифта."""
    widths, upm = {}, 1000
    for f in FONTS[font]:
        tt = TTFont(str(f))
        upm = tt["head"].unitsPerEm
        hmtx = tt["hmtx"]
        for code, glyph in tt.getBestCmap().items():
            widths.setdefault(chr(code), hmtx[glyph][0] / upm)
    avg = sum(widths.values()) / len(widths)
    return widths, avg


def width(text: str, font: str = "Onest 600", size: float = 64) -> float:
    """Ширина строки в пикселях при данном кегле (без кернинга — он даёт доли процента)."""
    widths, avg = _metrics(font)
    return sum(widths.get(ch, avg) for ch in text) * size
