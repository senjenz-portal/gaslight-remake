#!/usr/bin/env python3
"""headcrop.py -- the head box of an actor master, measured off its own alpha.

THE CANONICAL SHEET LAW needs one operation above all others: take a pose whose
BODY is already accepted (keyed, palette-pulled to its plate, stage-proofed,
pixel-aligned with its twin) and give it the canonical HEAD. Regenerating the
whole figure would throw all of that away, so the only thing that ever leaves
the file is the head box, and the only thing that ever comes back is the head
box at exactly the same size.

The box is not guessed: it is the alpha bbox's top `frac` plus a pad, so the
same call gives the same box for the same file forever.

    python3 headcrop.py MASTER.png OUT.png [--frac 0.22] [--pad 24] [--json J]
"""
import argparse, json, os
import numpy as np
from PIL import Image

def bbox(im):
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > 12)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1

def head_box(im, frac=0.22, pad=24, cell=None):
    x0, y0, x1, y1 = bbox(im)
    h = y1 - y0
    hy1 = y0 + int(round(h * frac))
    # widen to the alpha of just that band, so a raised arm elsewhere cannot
    # drag the box sideways
    a = np.asarray(im)[y0:hy1, :, 3]
    xs = np.where(a.max(axis=0) > 12)[0]
    bx0, bx1 = int(xs.min()), int(xs.max()) + 1
    return (max(0, bx0 - pad), max(0, y0 - pad),
            min(im.width, bx1 + pad), min(im.height, hy1 + pad))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--frac', type=float, default=0.22)
    ap.add_argument('--pad', type=int, default=24)
    ap.add_argument('--bg', default='24,28,46')
    ap.add_argument('--upscale', type=int, default=2)
    ap.add_argument('--json', default='')
    a = ap.parse_args()
    im = Image.open(a.src).convert('RGBA')
    box = head_box(im, a.frac, a.pad)
    crop = im.crop(box)
    bg = tuple(int(v) for v in a.bg.split(',')) + (255,)
    flat = Image.new('RGBA', crop.size, bg); flat.alpha_composite(crop)
    if a.upscale > 1:
        flat = flat.resize((flat.width * a.upscale, flat.height * a.upscale), Image.LANCZOS)
    flat.convert('RGB').save(a.out)
    rec = {'src': a.src, 'out': a.out, 'box': list(box),
           'crop_size': list(crop.size), 'sent_size': list(flat.size)}
    if a.json:
        json.dump(rec, open(a.json, 'w'), indent=1)
    print(json.dumps(rec))

main()
