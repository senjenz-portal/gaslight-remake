#!/usr/bin/env python3
"""refsheet_reprise.py -- labelled i2i reference sheets for the REPRISE ACTORS lane.

nbpro_edit.py sends exactly ONE input image, so a generation that must lock
IDENTITY (Holmes' own face), STYLE+LIGHT (the SET he will stand in) and POSE/
FRAMING (full body, isolated, tall) at once gets a single burned-in contact
sheet with the panels telling the model which one governs what. Burned-in labels
are load-bearing -- without them the model averages the panels (the beat-I actor
lane's own finding, tools/laneassets/refsheet.py).

The panels differ from the beat-I sheet in exactly one way: panel C is the SET
THIS ACTOR WILL STAND IN (street.png / church.jpg), not the 221B backdrop,
because a cut-out actor lit for the wrong room reads as a collage the instant it
lands on the plate (CONTENT-full.md 6.2).

Deterministic, no network. stdlib + PIL.

    python3 refsheet_reprise.py street  /abs/out.png
    python3 refsheet_reprise.py church  /abs/out.png
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = '/Users/samz/Documents/gaslight-remake'
P = os.path.join(ROOT, 'assets/plates')
BOOK = os.path.join(P, 'book')

FONTS = ['/System/Library/Fonts/Helvetica.ttc',
         '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
         '/Library/Fonts/Arial.ttf']


def font(size):
    for f in FONTS:
        if os.path.exists(f):
            try:
                return ImageFont.truetype(f, size)
            except Exception:
                pass
    return ImageFont.load_default()


def _wrap(d, text, fnt, width):
    """Greedy wrap so a caption is never clipped mid-word. A clipped instruction
    is an instruction the model never reads."""
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=fnt) <= width or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def panel(img, box_w, box_h, label, sub=''):
    """Letterbox img into box_w x box_h on black, with a burned-in caption bar.
    The caption bar grows to hold every wrapped line -- nothing is clipped."""
    out = Image.new('RGB', (box_w, box_h), (8, 8, 10))
    d = ImageDraw.Draw(out)
    fl = font(max(15, min(30, int(box_w / 30))))
    fs = font(max(13, min(22, int(box_w / 40))))
    lab = _wrap(d, label, fl, box_w - 28)
    subs = _wrap(d, sub, fs, box_w - 28) if sub else []
    lh, sh = fl.size + 6, fs.size + 4
    cap_h = 12 + len(lab) * lh + len(subs) * sh
    inner_h = box_h - cap_h
    im = img.copy()
    im.thumbnail((box_w - 16, max(16, inner_h - 16)), Image.LANCZOS)
    out.paste(im, ((box_w - im.width) // 2, (inner_h - im.height) // 2 + 8))
    d.rectangle([0, box_h - cap_h, box_w, box_h], fill=(255, 255, 255))
    y = box_h - cap_h + 6
    for ln in lab:
        d.text((14, y), ln, fill=(0, 0, 0), font=fl)
        y += lh
    for ln in subs:
        d.text((14, y), ln, fill=(70, 70, 70), font=fs)
        y += sh
    d.rectangle([0, 0, box_w - 1, box_h - 1], outline=(120, 120, 120))
    return out


def holmes_at_scale(zoom=4):
    """The beat-I Holmes cut-out on its own plate navy -- the figure treatment the
    book already ships. He is seen from BEHIND there, so this panel is cited for
    facet size / edge / paint only, never for the face."""
    cut = Image.open(os.path.join(ROOT, 'site-deploy/living/assets/actor/holmes-holmes.png')).convert('RGBA')
    bg = Image.new('RGBA', (cut.width * zoom, cut.height * zoom), (23, 32, 56, 255))
    bg.alpha_composite(cut.resize((cut.width * zoom, cut.height * zoom), Image.LANCZOS))
    return bg.convert('RGB')


def church_figs():
    """The church lane's own painted figures: a standing person at THIS SET's
    scale, in THIS SET's candlelight. The best figure-treatment panel there is."""
    ch = Image.open(os.path.join(BOOK, 'church/church.jpg')).convert('RGB')
    return ch.crop((680, 330, 920, 545)).resize((240 * 3, 215 * 3), Image.LANCZOS)


def who():
    """Identity lock: the cameo bust. Gaunt, hawk-nosed, heavy brows, dark hair
    swept back, clean shaven."""
    im = Image.open(os.path.join(P, 'cameo-holmes.png')).convert('RGB')
    return im.crop((430, 0, 990, 768))


def pose():
    """POSE + FRAMING ONLY. A full-body standing figure, isolated, tall canvas.
    The sheet says in words to ignore this man's face, build and costume."""
    im = Image.open(os.path.join(P, 'king-v2/king2-look.png')).convert('RGB')
    return im.crop((425, 20, 880, 768))


def sheet(which, out_path):
    if which == 'street':
        set_img = Image.open(os.path.join(BOOK, 'street/street.png')).convert('RGB')
        set_sub = ('Serpentine Avenue at night: ONE warm gas-lamp key from the LEFT, '
                   'warm bay-window spill, deep navy fill')
        treat = holmes_at_scale()
        treat_sub = 'the book\'s own Holmes cut-out -- facet size + edge + matte paint (IGNORE his gown and his back view)'
    elif which == 'church':
        set_img = Image.open(os.path.join(BOOK, 'church/church.jpg')).convert('RGB')
        set_sub = ('St Monica\'s at night: warm candle key from the RIGHT (the chancel), '
                   'cool blue window fill from the LEFT')
        treat = church_figs()
        treat_sub = 'standing people painted in THIS set -- match facet size, edge and matte paint exactly'
    else:
        raise SystemExit('which must be street|church')

    W, H = 1152, 1536
    main_w = 760
    s = Image.new('RGB', (W, H), (8, 8, 10))
    s.paste(panel(pose(), main_w, H, 'A / POSE + FRAMING + CANVAS',
                  'keep this full-body head-to-boots framing; REPLACE the man, his face, his build and his costume'),
            (0, 0))
    col = W - main_w
    s.paste(panel(who(), col, 560, 'B / WHO IT IS (identity lock)',
                  'gaunt, hawk nose, heavy brows, dark hair back, clean shaven'), (main_w, 0))
    s.paste(panel(set_img, col, 480, 'C / STYLE + LIGHT (the set he stands in)', set_sub),
            (main_w, 560))
    s.paste(panel(treat, col, 496, 'D / FIGURE TREATMENT AT DIORAMA SCALE', treat_sub),
            (main_w, 1040))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    s.save(out_path)
    return out_path


if __name__ == '__main__':
    print(sheet(sys.argv[1], sys.argv[2]))
