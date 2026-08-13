#!/usr/bin/env python3
"""palette.py -- the canonical's own colours, as hex, so a prompt can name them.

A prose instruction ("dark hair") is exactly the instruction that produced three
different hair colours in this book. Naming the canonical's measured hex values
in the prompt turns an adjective into a target, and gives the accept gate
something to measure against afterwards.
"""
import sys
import numpy as np
from PIL import Image

def clusters(path, box=None, k=8, sub=2):
    im = Image.open(path).convert('RGB')
    if box: im = im.crop(box)
    a = np.asarray(im).reshape(-1, 3).astype(np.float32)[::sub]
    # drop the flat backing colour
    q = Image.fromarray(np.asarray(im)).quantize(colors=k, method=Image.MEDIANCUT)
    pal = np.array(q.getpalette()[:k*3]).reshape(-1, 3)
    idx = np.asarray(q)
    out = []
    for i in range(k):
        n = int((idx == i).sum())
        if n == 0: continue
        c = pal[i]
        out.append((n, tuple(int(v) for v in c)))
    out.sort(reverse=True)
    tot = sum(n for n, _ in out)
    return [(round(100.0*n/tot, 1), '#%02x%02x%02x' % c, c) for n, c in out]

if __name__ == '__main__':
    p = sys.argv[1]
    box = tuple(int(v) for v in sys.argv[2].split(',')) if len(sys.argv) > 2 else None
    k = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    for pct, hx, c in clusters(p, box, k):
        print(f'{pct:5.1f}%  {hx}  {c}')
