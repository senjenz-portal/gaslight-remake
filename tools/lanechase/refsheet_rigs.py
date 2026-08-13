#!/usr/bin/env python3
"""refsheet_rigs.py -- the labelled i2i reference sheet for the THREE RIGS.

Built to tools/laneactors/refsheet_actors.py's pattern, retargeted at vehicles.
nbpro_edit.py sends exactly ONE input image, and a carriage that has to stand on
THIS plate needs four things locked that no single picture carries:

  A  STYLE + LIGHT + SCALE   the shipped chase plate. The rig is lit for the
                             street it will drive down, not for a studio.
  B  THE GROUND + THE VIEW   the near roadway crop with the plate's own kerb,
                             cobbles and lamp, at the size a rig is drawn.
                             It also fixes the CAMERA: the road runs away to
                             the upper right, so a rig on it is seen from
                             BEHIND AND SLIGHTLY TO ITS LEFT.
  C  OUTPUT CONTRACT         a shipped chase actor on flat magenta -- the only
                             thing in the repo that already states the whole
                             output contract (one subject, flat #FF00FF field,
                             clear margin) and it was accepted for this set.

Deterministic, no network. stdlib + PIL.

    python3 refsheet_rigs.py /abs/out.png
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = '/Users/samz/Documents/gaslight-remake'
LIVE = os.path.join(ROOT, 'site-deploy/living/assets')
PLATE = os.path.join(LIVE, 'set/chase/chase.jpg')
ACTOR = os.path.join(LIVE, 'actor/norton-chase.png')

MAGENTA = (255, 0, 255)
FONTS = ['/System/Library/Fonts/Helvetica.ttc',
         '/System/Library/Fonts/Supplemental/Arial Bold.ttf']

# the near roadway, where the following cab stands at rail u 0 (420, 545)
GROUND_BOX = (250, 300, 900, 640)

W = 1560          # sheet width
PAD = 14
CAPH = 84


def font(size):
    for f in FONTS:
        if os.path.exists(f):
            try:
                return ImageFont.truetype(f, size)
            except Exception:
                pass
    return ImageFont.load_default()


def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ''
    for w in words:
        trial = (cur + ' ' + w).strip()
        if draw.textlength(trial, font=fnt) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def panel(img, cap, width):
    """one captioned panel, scaled to `width`."""
    s = width / img.size[0]
    im = img.resize((width, max(1, round(img.size[1] * s))), Image.LANCZOS)
    card = Image.new('RGB', (width, im.size[1] + CAPH), (0, 0, 0))
    card.paste(im, (0, 0))
    d = ImageDraw.Draw(card)
    f = font(21)
    y = im.size[1] + 8
    for line in wrap(d, cap, f, width - 20)[:3]:
        d.text((10, y), line, font=f, fill=(255, 255, 255))
        y += 25
    return card


def main():
    out = sys.argv[1]
    plate = Image.open(PLATE).convert('RGB')
    ground = plate.crop(GROUND_BOX)

    # C: the output contract -- a shipped chase actor alone on flat magenta
    act = Image.open(ACTOR).convert('RGBA')
    cw, ch = act.size[0] * 3, act.size[1] * 2
    canvas = Image.new('RGB', (cw, ch), MAGENTA)
    canvas.paste(act, ((cw - act.size[0]) // 2, (ch - act.size[1]) // 2), act)

    a = panel(plate, 'A  STYLE, LIGHT AND SCALE. The exact night street the new '
              'vehicle must stand in. Copy this render style, this Prussian-blue '
              'night, these warm amber gas-lamp pools, this low-poly facet size.',
              W - 2 * PAD)
    b = panel(ground, 'B  THE GROUND AND THE CAMERA. The near roadway at the '
              'size a carriage is drawn. The road runs AWAY to the upper right, '
              'so a carriage on it is seen FROM BEHIND AND SLIGHTLY TO ITS LEFT.',
              (W - 3 * PAD) // 2)
    c = panel(canvas, 'C  OUTPUT CONTRACT. Exactly like this: ONE subject alone, '
              'centred on a completely flat solid MAGENTA #FF00FF field, clear '
              'magenta margin all round, nothing else in the frame.',
              (W - 3 * PAD) // 2)

    h = PAD + a.size[1] + PAD + max(b.size[1], c.size[1]) + PAD
    sheet = Image.new('RGB', (W, h), (0, 0, 0))
    sheet.paste(a, (PAD, PAD))
    sheet.paste(b, (PAD, PAD + a.size[1] + PAD))
    sheet.paste(c, (PAD + b.size[0] + PAD, PAD + a.size[1] + PAD))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.save(out)
    print(out, sheet.size)


if __name__ == '__main__':
    main()
