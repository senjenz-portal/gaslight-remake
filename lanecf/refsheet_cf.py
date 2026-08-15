#!/usr/bin/env python3
"""refsheet_cf.py -- canonical reference sheets for the CHURCH+FINALE fix lane.

Same law as tools/laneactors/refsheet_actors.py (which shipped the accepted
Irene/Norton actors): nbpro_edit.py sends exactly ONE image, and an actor needs
four things locked that no single picture carries, so each sheet is one labelled
contact sheet and the instruction names which panel governs what. The burned-in
captions are load-bearing.

Two sheets this lane needs that the actor lane never built:

  clergyman-altar   The surpliced clergyman is the one Beat IV figure with NO
                    cameo card and NO shipped cut (CONTENT-full 6.3 marks him
                    GAP). His identity lock is therefore THE PLATE'S OWN
                    PAINTED FIGURE -- panel B is a 5x crop of him off
                    church.jpg, so the sprite that replaces him is him.

  irene-portrait    The finale's framed photograph. Panel A is the SHIPPED
                    PAINTED BRIDE -- the same raw family as the cameo, which is
                    what makes this the same woman (CONTENT-full 6.5's same-raw
                    precedent) -- and panel B is the mannequin the frame
                    currently holds, which is the only thing in the repo that
                    states the sitter's pose, scale and sepia.

Deterministic, no network. stdlib + PIL + numpy.

    python3 refsheet_cf.py WHICH /abs/out.png
    WHICH: clergyman-altar | irene-portrait
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = '/Users/samz/Documents/gaslight-remake'
LIVE = os.path.join(ROOT, 'site-deploy/living/assets')
BOOK = os.path.join(ROOT, 'assets/plates/book')

MAGENTA = (255, 0, 255)
FONTS = ['/System/Library/Fonts/Helvetica.ttc',
         '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
         '/Library/Fonts/Arial.ttf']

# read off church.jpg with a coordinate grid (see tools/lanecf/church_geom.py)
CHURCH_CLERGY_BOX = (836, 316, 938, 522)
CHURCH_KNOT_BOX = (680, 320, 940, 540)
# the finale frame's own sitter footprint, measured off photo-irene.jpg
PORTRAIT_SITTER_BOX = (596, 120, 812, 706)


def font(size):
    for f in FONTS:
        if os.path.exists(f):
            try:
                return ImageFont.truetype(f, size)
            except Exception:
                pass
    return ImageFont.load_default()


def _wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ''
    for word in words:
        trial = (cur + ' ' + word).strip()
        if draw.textlength(trial, font=fnt) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def panel(img, box_w, box_h, label, sub=''):
    out = Image.new('RGB', (box_w, box_h), (8, 8, 10))
    d = ImageDraw.Draw(out)
    pad = 12
    f_lab = font(28 if box_w > 600 else 22)
    f_sub = font(20 if box_w > 600 else 17)
    lab_lines = _wrap(d, label, f_lab, box_w - pad * 2)
    sub_lines = _wrap(d, sub, f_sub, box_w - pad * 2) if sub else []
    lh_lab = f_lab.size + 6
    lh_sub = f_sub.size + 4
    cap_h = pad + len(lab_lines) * lh_lab + len(sub_lines) * lh_sub + pad
    inner_h = box_h - cap_h
    im = img.copy()
    im.thumbnail((box_w - 16, inner_h - 16), Image.LANCZOS)
    out.paste(im, ((box_w - im.width) // 2, (inner_h - im.height) // 2 + 8))
    d.rectangle([0, box_h - cap_h, box_w, box_h], fill=(255, 255, 255))
    y = box_h - cap_h + pad
    for ln in lab_lines:
        d.text((pad, y), ln, fill=(0, 0, 0), font=f_lab)
        y += lh_lab
    for ln in sub_lines:
        d.text((pad, y), ln, fill=(70, 70, 70), font=f_sub)
        y += lh_sub
    d.rectangle([0, 0, box_w - 1, box_h - 1], outline=(120, 120, 120))
    return out


def on_magenta(path):
    rgba = Image.open(path).convert('RGBA')
    bg = Image.new('RGB', rgba.size, MAGENTA)
    bg.paste(rgba, (0, 0), rgba)
    return bg


def _open(p):
    return Image.open(p).convert('RGB')


def _upscale(img, k=4):
    return img.resize((img.width * k, img.height * k), Image.LANCZOS)


def build(which, out_path):
    W, H = 1152, 1536
    main_w = 760
    col = W - main_w
    sheet = Image.new('RGB', (W, H), (8, 8, 10))
    church = _open(os.path.join(LIVE, 'set/church/church.jpg'))

    if which == 'clergyman-altar':
        canvas = on_magenta(os.path.join(LIVE, 'actor/norton-groom.png'))
        sheet.paste(panel(canvas, main_w, H,
                          'A / POSE, FRAMING + CANVAS',
                          'the SHIPPED church actor: keep this exact contract - ONE figure, '
                          'head to hem, tall portrait, FLAT MAGENTA ground, empty margin '
                          'above the head and below the feet. Replace the person.'), (0, 0))
        who = _upscale(church.crop(CHURCH_CLERGY_BOX), 5)
        sheet.paste(panel(who, col, 620, 'B / WHO IT IS (identity lock)',
                          'THE PLATE ALREADY PAINTS HIM: elderly, short grey hair, white '
                          'surplice over a black cassock, black stole hanging straight down '
                          'both sides, both arms open'), (main_w, 0))
        sheet.paste(panel(church, col, 420, 'C / SET LIGHT + PALETTE',
                          'candlelit chancel, warm amber key from the RIGHT, cool blue nave '
                          'fill from the LEFT'), (main_w, 620))
        treat = _upscale(church.crop(CHURCH_KNOT_BOX), 3)
        sheet.paste(panel(treat, col, 496, 'D / FIGURE TREATMENT AT DIORAMA SCALE',
                          'how this world paints a standing person: facet size, matte paint, '
                          'soft simplified face'), (main_w, 1040))
    elif which == 'irene-portrait':
        canvas = on_magenta(os.path.join(LIVE, 'actor/irene-bride.png'))
        sheet.paste(panel(canvas, main_w, H,
                          'A / WHO SHE IS + CANVAS (identity lock)',
                          'THIS IS THE WOMAN and this is the output contract: her exact '
                          'painted face, ONE figure head to hem, tall portrait, FLAT MAGENTA '
                          'ground. Change only her clothes and the colour.'), (0, 0))
        photo = _open(os.path.join(LIVE, 'inset/photo-irene.jpg'))
        sitter = _upscale(photo.crop(PORTRAIT_SITTER_BOX), 2)
        sheet.paste(panel(sitter, col, 780, 'B / POSE + COSTUME + SEPIA',
                          'the sitter this replaces: standing square to camera, both arms '
                          'straight down at her sides, high-necked long-sleeved floor-length '
                          'gown, MONOCHROME SEPIA'), (main_w, 0))
        sheet.paste(panel(photo, col, 756, 'C / THE PHOTOGRAPH IT GOES INTO',
                          'a Victorian cabinet photograph: one flat sepia tone, no colour '
                          'anywhere, soft studio light from the front-left'), (main_w, 780))
    else:
        sys.exit('unknown sheet: ' + which)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    sheet.save(out_path)
    return out_path


if __name__ == '__main__':
    print(build(sys.argv[1], sys.argv[2]))
