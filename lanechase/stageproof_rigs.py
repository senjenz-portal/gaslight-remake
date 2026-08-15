#!/usr/bin/env python3
"""stageproof_rigs.py -- composite the rigs onto the chase plate at the STORY
positions, with the exact numbers app/sets/chase.js will use.

A screenshot of the page proves the page; this proves the NUMBERS before the
page is touched. Same rail, same PX_PER_M, same pin law:

    rig height px = height_m * 51.2 * rail.s
    the sprite is pinned by its FOOT CENTRE (measured, not the sprite's middle)
    to the rail point, because the art's own baseline is the back wheels' road
    contact and the horse stands further up the road inside the picture.

    python3 stageproof_rigs.py /abs/out.png
"""
import json
import os
import sys

from PIL import Image, ImageDraw

ROOT = '/Users/samz/Documents/gaslight-remake'
A = os.path.join(ROOT, 'site-deploy/living/assets')
GEOM = json.load(open(os.path.join(ROOT, 'assets/raw/book-chase/rigs/geom.json')))
PX_PER_M = 51.2

RAIL = [[0.000, 420.0, 545.1, 1.0000], [0.050, 461.9, 536.2, 1.0072],
        [0.100, 503.8, 525.5, 0.9756], [0.150, 545.7, 517.6, 1.0025],
        [0.200, 587.6, 509.1, 1.0189], [0.250, 629.5, 498.3, 0.9905],
        [0.300, 671.4, 487.6, 0.9684], [0.350, 713.3, 476.4, 0.9300],
        [0.400, 755.2, 464.2, 0.8568], [0.450, 797.1, 454.3, 0.8322],
        [0.500, 839.0, 444.6, 0.8129], [0.550, 880.9, 435.2, 0.8001],
        [0.600, 922.8, 425.4, 0.7776], [0.650, 964.7, 415.1, 0.7471],
        [0.700, 1006.6, 404.8, 0.7110], [0.750, 1048.5, 394.9, 0.6622],
        [0.800, 1090.4, 386.0, 0.6148], [0.850, 1132.3, 378.3, 0.5318],
        [0.900, 1174.2, 371.2, 0.4285], [0.950, 1216.1, 363.9, 0.3095],
        [1.000, 1258.0, 358.3, 0.2163]]


def rail(u):
    if u <= RAIL[0][0]:
        return RAIL[0]
    for i in range(1, len(RAIL)):
        if u <= RAIL[i][0]:
            a, b = RAIL[i - 1], RAIL[i]
            k = (u - a[0]) / (b[0] - a[0])
            return [u] + [a[j] + (b[j] - a[j]) * k for j in (1, 2, 3)]
    return RAIL[-1]


def foot_cx(g):
    f = g['foot_x']
    return (f[0] + f[1]) / 2.0


def paste_rig(base, rid, u):
    g = GEOM[rid]
    _, x, y, s = rail(u)
    h = g['height_m'] * PX_PER_M * s
    k = h / g['size'][1]
    im = Image.open(os.path.join(A, g['file'])).convert('RGBA')
    w = max(1, round(g['size'][0] * k))
    im = im.resize((w, max(1, round(h))), Image.LANCZOS)
    left = round(x - foot_cx(g) * k)
    top = round(y - g['baseline'] * k)
    base.alpha_composite(im, (left, top))
    return (x, y, s, w, round(h))


def paste_actor(base, f, at, h, size):
    im = Image.open(os.path.join(A, f)).convert('RGBA')
    k = h / size[1]
    im = im.resize((max(1, round(size[0] * k)), max(1, round(h))), Image.LANCZOS)
    base.alpha_composite(im, (round(at[0] - im.size[0] / 2), round(at[1] - im.size[1])))


def frame(shots, label):
    base = Image.open(os.path.join(A, 'set/chase/chase.jpg')).convert('RGBA')
    for rid, u in shots:
        paste_rig(base, rid, u)
    front = Image.open(os.path.join(A, 'set/chase/lamp2-front.png')).convert('RGBA')
    base.alpha_composite(front, (727, 270))
    d = ImageDraw.Draw(base)
    d.text((16, 16), label, fill=(255, 255, 255))
    return base


def main():
    out = sys.argv[1]
    frames = [
        ([('norton', 0.29)], 'III.1 hansom at the lit door (u .29)'),
        ([('norton', 0.62), ('lead', 0.30), ('follow', 0.02)],
         'III.5 chase-intro mid: norton away, landau up the lane, cab enters'),
        ([('lead', 0.620), ('follow', 0.015)], 'III.8 the gate: follow at u .015'),
        ([('lead', 0.984), ('follow', 0.550)], 'III.11 roll end'),
    ]
    ims = [frame(s, l) for s, l in frames]
    W = 1408
    sheet = Image.new('RGB', (W, 768 * len(ims)), (0, 0, 0))
    for i, im in enumerate(ims):
        sheet.paste(im.convert('RGB'), (0, 768 * i))
    sheet.save(out)
    print(out, sheet.size)


if __name__ == '__main__':
    main()
