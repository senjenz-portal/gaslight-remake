#!/usr/bin/env python3
"""hair.py -- measure a head's OPAQUE colour clusters, background excluded.

Clustering a flattened crop returns the backing navy as the biggest cluster and
buries the thing being measured. Alpha is the mask that already exists.
"""
import sys, json
import numpy as np
from PIL import Image

def head_clusters(master, frac=0.22, k=10):
    im = Image.open(master).convert('RGBA')
    a = np.asarray(im)
    al = a[..., 3]
    ys, xs = np.where(al > 200)
    y0, y1 = ys.min(), ys.max()
    hy1 = y0 + int((y1 - y0) * frac)
    band = a[y0:hy1]
    m = band[..., 3] > 200
    px = band[..., :3][m].astype(np.float32)
    # k-means, 12 iters, deterministic seeding by luminance quantiles
    lum = px @ np.array([0.299, 0.587, 0.114])
    cen = np.stack([px[np.argsort(lum)[int(q * (len(px) - 1))]]
                    for q in np.linspace(0.02, 0.98, k)])
    for _ in range(14):
        d = ((px[:, None, :] - cen[None]) ** 2).sum(2)
        lab = d.argmin(1)
        for i in range(k):
            sel = lab == i
            if sel.any(): cen[i] = px[sel].mean(0)
    out = []
    for i in range(k):
        n = int((lab == i).sum())
        if n < 20: continue
        c = tuple(int(round(v)) for v in cen[i])
        L = 0.299*c[0]+0.587*c[1]+0.114*c[2]
        warm = (c[0] - c[2])
        out.append({'pct': round(100.0*n/len(px), 1), 'hex': '#%02x%02x%02x' % c,
                    'rgb': c, 'lum': round(L, 1), 'warm_r_minus_b': int(warm)})
    out.sort(key=lambda r: -r['pct'])
    return out

for p in sys.argv[1:]:
    print('==', p)
    for r in head_clusters(p):
        print(f"  {r['pct']:5.1f}%  {r['hex']}  lum {r['lum']:5.1f}  R-B {r['warm_r_minus_b']:+4d}")
