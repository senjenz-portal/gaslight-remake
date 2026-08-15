#!/usr/bin/env python3
"""refsheet_actors.py -- labelled reference sheets for the Irene / Norton i2i.

nbpro_edit.py sends exactly ONE input image, and these actors need FOUR things
locked at once that no single picture carries: the framing and the magenta
canvas the living stack expects, WHO the person is, the SET's light, and how a
figure is painted at this diorama's scale. So each sheet is one labelled contact
sheet and the instruction says which panel governs what. The burned-in captions
are load-bearing -- without them the model averages the panels.

Same construction as the sibling laneassets/refsheet.py, retargeted:

  A  POSE + FRAMING + CANVAS   the SHIPPED Beat I actor on flat magenta. It is
                               the only thing in the repo that already states
                               the whole output contract -- full body head to
                               boots, tall portrait, flat magenta ground -- and
                               it was accepted, so it is the safest canvas.
  B  WHO                       the cameo card. The cameo IS the character's
                               published face; the actor must be the same person.
  C  STYLE + LIGHT             the target SET plate, so the figure is lit for
                               the room it will stand in and not for Beat I's.
  D  FIGURE TREATMENT          the church plate's own painted figures, which are
                               the only existing figures painted at the new
                               books' diorama scale. Facet size, edge quality
                               and how much face survives at scale all come from
                               here.

Deterministic, no network. stdlib + PIL.

    python3 refsheet_actors.py WHICH /abs/out.png
    WHICH: irene-street | irene-bride | norton-street | norton-groom
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = '/Users/samz/Documents/gaslight-remake'
P = os.path.join(ROOT, 'assets/plates')
BOOK = os.path.join(P, 'book')
SHIPPED_ACTOR = os.path.join(ROOT, 'site-deploy/living/assets/actor/king-masked.png')

MAGENTA = (255, 0, 255)

FONTS = ['/System/Library/Fonts/Helvetica.ttc',
         '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
         '/Library/Fonts/Arial.ttf']

# tight crops, read off the plates with a coordinate grid (see actor_geom.py)
CAMEO_IRENE_BOX = (430, 10, 920, 768)
CHURCH_BRIDE_BOX = (695, 355, 787, 530)
CHURCH_GROOM_BOX = (778, 368, 848, 516)
CHURCH_KNOT_BOX = (695, 332, 912, 530)


def font(size):
    for f in FONTS:
        if os.path.exists(f):
            try:
                return ImageFont.truetype(f, size)
            except Exception:
                pass
    return ImageFont.load_default()


def _wrap(draw, text, fnt, max_w):
    """greedy word wrap -- the captions are the whole point of the sheet, so a
    caption that runs off the edge of its panel is a silently broken lock."""
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
    """Letterbox img into box_w x box_h on black, with a burned-in caption bar.

    The caption bar grows to fit its wrapped text rather than clipping it.
    """
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


def on_magenta(rgba):
    bg = Image.new('RGB', rgba.size, MAGENTA)
    bg.paste(rgba, (0, 0), rgba)
    return bg


def _open(p):
    return Image.open(p).convert('RGB')


def _upscale(img, k=4):
    return img.resize((img.width * k, img.height * k), Image.LANCZOS)


def bust_crop(cameo, pad=18):
    """Crop a cameo card down to its bust.

    A cameo card is 1408x768 of mostly navy field. Letterboxed whole into a
    392 px sheet column the FACE lands about 90 px wide, which is not an
    identity lock -- it is a smudge. Crop to the bust so panel B spends its
    whole area on the person.
    """
    import numpy as np
    a = np.asarray(cameo).astype(np.float32)
    r = 24
    ring = np.concatenate([a[:r].reshape(-1, 3), a[:, :r].reshape(-1, 3),
                           a[:, -r:].reshape(-1, 3)])
    field = np.median(ring, axis=0)
    m = np.sqrt(((a - field) ** 2).sum(axis=2)) > 42
    ys, xs = np.nonzero(m)
    if not len(xs):
        return cameo
    box = (max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad),
           min(cameo.width, int(xs.max()) + pad),
           min(cameo.height, int(ys.max()) + pad))
    return cameo.crop(box)


def build(which, out_path):
    canvas = on_magenta(Image.open(SHIPPED_ACTOR).convert('RGBA'))

    if which.startswith('irene'):
        who = bust_crop(_open(os.path.join(P, 'cameo-irene.png')))
        who_sub = 'dark upswept hair, straight brows, crimson accent'
    else:
        who = bust_crop(_open(os.path.join(BOOK, 'actors/cameo-norton.png')))
        who_sub = 'black hair, aquiline nose, black moustache, wine-burgundy coat'

    if which.endswith('street'):
        style = _open(os.path.join(BOOK, 'street/street.png'))
        style_sub = 'night street, gas-lamp amber key, deep Prussian-blue shadow'
    else:
        style = _open(os.path.join(BOOK, 'church/church.jpg'))
        style_sub = 'candlelit chancel, warm amber key, cool blue nave shadow'

    if which == 'irene-bride':
        treat = _upscale(_open(os.path.join(BOOK, 'church/church.jpg')).crop(CHURCH_BRIDE_BOX))
        treat_label = 'D / HER COSTUME + FIGURE TREATMENT'
        treat_sub = 'the plate already paints this bride -- match gown, mantle, facets'
    elif which == 'norton-groom':
        treat = _upscale(_open(os.path.join(BOOK, 'church/church.jpg')).crop(CHURCH_GROOM_BOX))
        treat_label = 'D / HIS COSTUME + FIGURE TREATMENT'
        treat_sub = 'the plate already paints this groom -- match coat, facets, scale'
    else:
        treat = _upscale(_open(os.path.join(BOOK, 'church/church.jpg')).crop(CHURCH_KNOT_BOX), 3)
        treat_label = 'D / FIGURE TREATMENT AT DIORAMA SCALE'
        treat_sub = 'how this world paints a standing person: facet size + soft face'

    W, H = 1152, 1536
    main_w = 760
    col = W - main_w
    sheet = Image.new('RGB', (W, H), (8, 8, 10))
    sheet.paste(panel(canvas, main_w, H,
                      'A / POSE, FRAMING + CANVAS',
                      'keep this exact contract: ONE figure, head to boots, tall '
                      'portrait, FLAT MAGENTA ground. Replace the person.'), (0, 0))
    sheet.paste(panel(who, col, 560, 'B / WHO IT IS (identity lock)', who_sub),
                (main_w, 0))
    sheet.paste(panel(style, col, 480, 'C / SET LIGHT + PALETTE', style_sub),
                (main_w, 560))
    sheet.paste(panel(treat, col, 496, treat_label, treat_sub), (main_w, 1040))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    sheet.save(out_path)
    return out_path


if __name__ == '__main__':
    print(build(sys.argv[1], sys.argv[2]))
