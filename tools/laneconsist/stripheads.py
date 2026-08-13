#!/usr/bin/env python3
"""stripheads.py -- head crops out of a walk STRIP, one per cell, on a shared box.

A strip's cells must stay the same size forever (the engine steps
background-position by one cell), so a per-frame head edit is only safe if the
box it is cut from and pasted back into is identical in every cell. The box is
therefore computed ONCE as the union over all cells, in cell-local coordinates.
"""
import argparse, json
import numpy as np
from PIL import Image

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('outstem')
    ap.add_argument('--cells', type=int, default=4)
    ap.add_argument('--frac', type=float, default=0.30)
    ap.add_argument('--pad', type=int, default=16)
    ap.add_argument('--bg', default='24,28,46')
    ap.add_argument('--scale', type=int, default=2)
    a = ap.parse_args()
    im = Image.open(a.src).convert('RGBA')
    cw = im.width // a.cells
    boxes = []
    for i in range(a.cells):
        c = im.crop((i * cw, 0, (i + 1) * cw, im.height))
        al = np.asarray(c)[..., 3]
        ys, xs = np.where(al > 12)
        y0, y1 = int(ys.min()), int(ys.max())
        hy1 = y0 + int((y1 - y0) * a.frac)
        band = al[y0:hy1]
        bx = np.where(band.max(axis=0) > 12)[0]
        boxes.append((int(bx.min()), y0, int(bx.max()) + 1, hy1))
    x0 = max(0, min(b[0] for b in boxes) - a.pad)
    y0 = max(0, min(b[1] for b in boxes) - a.pad)
    x1 = min(cw, max(b[2] for b in boxes) + a.pad)
    y1 = min(im.height, max(b[3] for b in boxes) + a.pad)
    bg = tuple(int(v) for v in a.bg.split(',')) + (255,)
    rec = {'src': a.src, 'cell_w': cw, 'cells': a.cells, 'box': [x0, y0, x1, y1], 'files': []}
    for i in range(a.cells):
        c = im.crop((i * cw + x0, y0, i * cw + x1, y1))
        flat = Image.new('RGBA', c.size, bg); flat.alpha_composite(c)
        if a.scale > 1:
            flat = flat.resize((flat.width * a.scale, flat.height * a.scale), Image.LANCZOS)
        p = f'{a.outstem}-f{i}.png'
        flat.convert('RGB').save(p)
        rec['files'].append(p)
    json.dump(rec, open(a.outstem + '.json', 'w'), indent=1)
    print(json.dumps(rec))

main()
