#!/usr/bin/env python3
"""build_cameos.py — pixel-art cameo card faces for the HD-2D page.

The masked / unmasked cameo plates are smooth painterly renders; dropped into
an HD-2D frame at sprite scale they read as a photograph glued onto pixel art.
So they get the same treatment the sprite got: crop to the bust, BOX-downscale
to card resolution, quantise with no dither. NearestFilter at runtime keeps the
blocks hard.

No text is baked in -- the card frame is geometry in the page.
"""
import hashlib
import json
import os

import numpy as np
from PIL import Image

SRC = '/Users/samz/Documents/gaslight-remake/site-deploy/king-demo'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sprites')
CARD_W, CARD_H = 96, 132
N_COLORS = 24


def bust_box(path):
    """Tight box around the painted bust, then padded out to the card aspect."""
    a = np.asarray(Image.open(path).convert('RGB')).astype(int)
    bg = a[4, 4]
    dist = np.abs(a - bg).sum(axis=2)
    fg = dist > 38
    ys, xs = np.where(fg)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    # widen to the card aspect around the bust centre, clamped to the plate
    cx = (x0 + x1) / 2
    h = (y1 - y0 + 1) * 1.06
    w = h * CARD_W / CARD_H
    left = max(0, int(cx - w / 2))
    right = min(a.shape[1], int(cx + w / 2))
    top = max(0, int(y0 - h * 0.03))
    bottom = min(a.shape[0], int(top + h))
    return (left, top, right, bottom)


def main():
    os.makedirs(OUT, exist_ok=True)
    entries = []
    for name in ('masked', 'unmasked'):
        src = os.path.join(SRC, 'king2-%s.png' % name)
        box = bust_box(src)
        im = Image.open(src).convert('RGB').crop(box)
        im = im.resize((CARD_W, CARD_H), Image.BOX)
        im = im.quantize(colors=N_COLORS, method=Image.MEDIANCUT,
                         dither=Image.NONE).convert('RGB')
        out = os.path.join(OUT, 'cameo-%s.png' % name)
        im.save(out)
        entries.append({
            'file': out, 'role': name, 'source': src,
            'source_sha256': hashlib.sha256(open(src, 'rb').read()).hexdigest(),
            'crop_box': list(box), 'size': [CARD_W, CARD_H],
            'sha256': hashlib.sha256(open(out, 'rb').read()).hexdigest(),
        })
        print(name, 'crop', box, '->', im.size)

    with open(os.path.join(OUT, 'cameo-manifest.json'), 'w') as f:
        json.dump({'lane': 'hd2d-cameo-cut', 'generator': 'build_cameos.py',
                   'params': {'colors': N_COLORS, 'downscale': 'PIL BOX',
                              'card_px': [CARD_W, CARD_H]},
                   'entries': entries}, f, indent=1)


if __name__ == '__main__':
    main()
