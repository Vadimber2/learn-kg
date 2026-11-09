#!/usr/bin/env python3
"""og-баннеры 1200×630 для статей блога и общий баннер сайта.

Запуск:  python3 deploy/gen-og.py            # все статьи × ru/en/tr + app/og.png
         python3 deploy/gen-og.py <slug>     # одна статья

Тексты берутся из JSON статьи (title/desc языка) и реестра рубрик — баннер всегда совпадает
с тем, что видит читатель; палитра и композиция — как у общего баннера learn.kg (тёмный фон,
голубая планка, плитка «ө», карточка со словом). Шрифт — системная Helvetica Neue (в ней есть
ө/ү/ң и турецкие буквы); имена файлов — <slug>-<lang>.png, их читает поле og статьи.
Только Pillow, ни одного внешнего запроса. После генерации — прогон npm test: гейт проверяет,
что каждый og:image отдаётся сервером.
"""
import json, os, sys, glob, re
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "app")
OUT = os.path.join(APP, "og")
FONT = "/System/Library/Fonts/HelveticaNeue.ttc"
W, H = 1200, 630
S = 2  # рисуем в 2× и уменьшаем: хинтинг мелкого текста при 1× превращал «е» в «ө»-подобную


class ScaledDraw:
    """Обёртка над ImageDraw: координаты и кегли в единицах 1200×630, рендер в S×."""
    def __init__(self, im): self.d = ImageDraw.Draw(im)
    def _xy(self, xy): return [v * S for v in xy]
    def rectangle(self, box, **kw): self.d.rectangle(self._xy(box), **kw)
    def rounded_rectangle(self, box, radius=0, width=1, **kw):
        self.d.rounded_rectangle(self._xy(box), radius=radius * S, width=width * S, **kw)
    def ellipse(self, box, **kw): self.d.ellipse(self._xy(box), **kw)
    def text(self, xy, txt, font=None, **kw): self.d.text(self._xy(xy), txt, font=font, **kw)
    def textlength(self, txt, font=None): return self.d.textlength(txt, font=font) / S

BG, BAR, TILE, WHITE, GREY, CIRCLE, CARD, CARD_BORDER, PURPLE, CHIP = (
    "#111823", "#38bdf8", "#1e6f8e", "#ffffff", "#a8b4c2", "#141f2d", "#1f2835", "#2a5c74", "#a78bfa", "#cbd5e1")

SECTIONS = {
    "learn": {"ru": "Как учить", "en": "How to learn", "tr": "Nasıl öğrenilir"},
    "vocab": {"ru": "Слова и фразы", "en": "Words and phrases", "tr": "Kelimeler ve ifadeler"},
    "exam":  {"ru": "Экзамен и закон", "en": "Exam and the law", "tr": "Sınav ve yasa"},
    "lang":  {"ru": "О языке", "en": "About the language", "tr": "Dil üzerine"},
}
# Слово на карточке — фразы курса (салам/рахмат) либо имена собственные, ничего сочинённого
CARD_WORD = {"learn": "Салам!", "vocab": "Рахмат!", "exam": "Кыргызтест", "lang": "Кыргыз тили"}
SUBTITLE = {"ru": "курсы кыргызского языка", "en": "Kyrgyz language courses", "tr": "Kırgızca dil kursları"}
SITE_TITLE = {"ru": "Кыргыз тили", "en": "Кыргыз тили", "tr": "Кыргыз тили"}


def font(size, weight="regular"):
    idx = {"regular": 0, "bold": 1, "medium": 10, "light": 7}[weight]
    return ImageFont.truetype(FONT, size * S, index=idx)


def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=fnt) <= max_w or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines


def fit_title(draw, text, max_w, max_lines):
    for size in (56, 52, 48, 44, 40):
        fnt = font(size, "bold")
        lines = wrap(draw, text, fnt, max_w)
        if len(lines) <= max_lines: return fnt, lines, size
    lines = wrap(draw, text, fnt, max_w)[:max_lines]
    lines[-1] = lines[-1].rstrip(".,:;") + "…"
    return fnt, lines, size


def base(draw):
    draw.rectangle([0, 0, W, 6], fill=BAR)
    draw.ellipse([740, -60, 1300, 500], fill=CIRCLE)
    draw.rounded_rectangle([80, 68, 152, 140], radius=14, fill=TILE)
    f = font(48, "bold")
    tw = draw.textlength("ө", font=f)
    draw.text((116 - tw / 2, 78), "ө", font=f, fill=WHITE)


def card(draw, word, caption):
    draw.rounded_rectangle([905, 215, 1125, 355], radius=12, fill=CARD)
    draw.rounded_rectangle([888, 200, 1108, 340], radius=12, fill=CARD)
    draw.rounded_rectangle([870, 185, 1090, 325], radius=12, fill="#1a2330", outline=CARD_BORDER, width=2)
    f = font(28 if len(word) < 9 else 24, "bold")
    draw.text((900, 220), word, font=f, fill=PURPLE)
    draw.rounded_rectangle([900, 272, 1030, 280], radius=4, fill="#2b3644")
    draw.rounded_rectangle([900, 292, 990, 300], radius=4, fill="#2b3644")
    f2 = font(16)
    tw = draw.textlength(caption, font=f2)
    draw.text((max(850, 990 - tw / 2), 395), caption, font=f2, fill=GREY)


def article_banner(post, lang):
    im = Image.new("RGB", (W * S, H * S), BG)
    d = ScaledDraw(im)
    base(d)
    d.text((168, 78), "learn.kg", font=font(24, "bold"), fill=WHITE)
    d.text((168, 112), SUBTITLE[lang], font=font(18), fill=GREY)
    sec = SECTIONS[post["section"]][lang].upper()
    fs = font(18, "medium")
    sw = d.textlength(sec, font=fs) + 28
    d.rounded_rectangle([80, 178, 80 + sw, 212], radius=17, fill="#16283a", outline="#1f4a63", width=1)
    d.text((94, 185), sec, font=fs, fill=BAR)
    t = post["langs"][lang]["title"]
    ft, lines, size = fit_title(d, t, 700, 3)
    y = 236
    for ln in lines:
        d.text((80, y), ln, font=ft, fill=WHITE); y += int(size * 1.18)
    fd = font(24)
    desc_lines = wrap(d, post["langs"][lang]["desc"], fd, 700)[:2]
    if len(wrap(d, post["langs"][lang]["desc"], fd, 700)) > 2:
        desc_lines[-1] = desc_lines[-1].rstrip(".,:;") + "…"
    y += 14
    for ln in desc_lines:
        d.text((80, y), ln, font=fd, fill=GREY); y += 34
    card(d, CARD_WORD[post["section"]], "/blog/" + post["slug"] + "/" + lang)
    d.text((80, 570), {"ru": "Читать на learn.kg", "en": "Read on learn.kg", "tr": "learn.kg'de oku"}[lang],
           font=font(20), fill=GREY)
    return im


def site_banner(facts):
    im = Image.new("RGB", (W * S, H * S), BG)
    d = ScaledDraw(im)
    base(d)
    d.text((168, 78), "learn.kg", font=font(24, "bold"), fill=WHITE)
    d.text((168, 112), SUBTITLE["ru"], font=font(18), fill=GREY)
    d.text((80, 200), "Кыргыз тили", font=font(72, "bold"), fill=WHITE)
    d.text((80, 298), "Учить кыргызский язык онлайн", font=font(34), fill=BAR)
    d.text((80, 364), "Интервальные повторения · звук к каждой фразе", font=font(24), fill=GREY)
    d.text((80, 400), "15–20 минут в день", font=font(24), fill=GREY)
    x = 80
    for txt in ("A1 · A2 · B1", facts["modules"] + " модулей", facts["phrases"] + " фраз"):
        f = font(22, "bold"); tw = d.textlength(txt, font=f) + 44
        d.rounded_rectangle([x, 472, x + tw, 530], radius=29, fill="#1f2835", outline="#2b3644", width=1)
        d.text((x + 22, 488), txt, font=f, fill=CHIP); x += tw + 18
    d.text((80, 568), "Доступ открывает преподаватель · WhatsApp +996 505 854 856", font=font(20), fill=GREY)
    card(d, "Салам!", "1 · 3 · 7 · 16 дней")
    return im


def save(im, path):
    im = im.resize((W, H), Image.LANCZOS)
    im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(path, optimize=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1] if len(sys.argv) > 1 else None
    posts = [json.load(open(f, encoding="utf-8")) for f in sorted(glob.glob(os.path.join(APP, "blog", "*.json")))]
    n = 0
    for p in posts:
        if only and p["slug"] != only: continue
        for lang in ("ru", "en", "tr"):
            save(article_banner(p, lang), os.path.join(OUT, p["slug"] + "-" + lang + ".png")); n += 1
    if not only:
        html = open(os.path.join(APP, "landing.html"), encoding="utf-8").read()
        mods = re.search(r"(\d+) модулей", html).group(1)
        phr = re.search(r"(\d{4}) фраз", html).group(1)
        save(site_banner({"modules": mods, "phrases": phr}), os.path.join(APP, "og.png")); n += 1
    print("og: записано файлов:", n)


if __name__ == "__main__":
    main()
