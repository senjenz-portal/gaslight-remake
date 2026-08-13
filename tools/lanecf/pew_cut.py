#!/usr/bin/env python3
"""pew_cut.py -- cut the NEAR PEW BLOCK off the church plate as a FOREGROUND
layer, so a figure standing in the nave goes BEHIND the pews instead of on top
of them (F5, second half).

Why the set needs this at all. In this isometric the aisle runner is only
VISIBLE over x 449..522; from there to the chancel it passes behind the near pew
block. A sprite anchored on the true floor line at x 600 therefore has its feet
at a plate point the pews cover -- and with no foreground layer the sprite is
drawn over them, which is the "standing on pew backs" the review saw. The fix is
not to lift the mark off the floor (that is what produced the floating); it is
to give the pews the same treatment `altar.png` already has.

The cut is the plate's own dark pew wood: V < PEW_V inside the nave band, closed
and hole-filled, components under MIN_AREA dropped, and the plate's own RGB
carried through so the layer is the painting and not a silhouette. The alpha is
feathered by one pixel so the occlusion edge is the pew's own edge and not a
staircase.

    python3 pew_cut.py --raw /abs/rawdir [--out /abs/pews.png]
"""
import argparse
import hashlib
import json
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = '/Users/samz/Documents/gaslight-remake'
LIVE = os.path.join(ROOT, 'site-deploy/living/assets/set/church')

BAND = (300, 430, 1020, 690)     # the nave band: the pews and nothing else
PEW_V = 82                       # HSV value below which the plate is pew wood
MIN_AREA = 1500


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for blk in iter(lambda: fh.read(1 << 20), b''):
            h.update(blk)
    return h.hexdigest()


def label(mask):
    """4-connected components, iterative flood fill (no scipy in this env)"""
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    n = 0
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0, x0] or lab[y0, x0]:
                continue
            n += 1
            stack = [(y0, x0)]
            lab[y0, x0] = n
            while stack:
                y, x = stack.pop()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        stack.append((yy, xx))
    return lab, n


def fill_holes(mask):
    """anything not reachable from the border through ~mask is a hole"""
    h, w = mask.shape
    free = ~mask
    seen = np.zeros_like(free)
    stack = []
    for x in range(w):
        for y in (0, h - 1):
            if free[y, x]:
                stack.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if free[y, x]:
                stack.append((y, x))
    for y, x in stack:
        seen[y, x] = True
    while stack:
        y, x = stack.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and free[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True
                stack.append((yy, xx))
    return mask | (free & ~seen)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', required=True)
    ap.add_argument('--out', default=os.path.join(LIVE, 'pews.png'))
    a = ap.parse_args()

    plate = Image.open(os.path.join(LIVE, 'church.jpg')).convert('RGB')
    rgb = np.asarray(plate).astype(np.float64)
    hsv = np.asarray(plate.convert('HSV')).astype(np.float64)
    V = hsv[..., 2]

    x0, y0, x1, y1 = BAND
    m = np.zeros(V.shape, bool)
    m[y0:y1, x0:x1] = V[y0:y1, x0:x1] < PEW_V

    im = Image.fromarray((m * 255).astype(np.uint8))
    im = im.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    m = np.asarray(im) > 127
    m = fill_holes(m)
    lab, n = label(m)
    keep = np.zeros_like(m)
    comps = []
    for i in range(1, n + 1):
        sel = lab == i
        area = int(sel.sum())
        if area < MIN_AREA:
            continue
        ys, xs = np.nonzero(sel)
        comps.append({'area': area, 'bbox': [int(xs.min()), int(ys.min()),
                                             int(xs.max()), int(ys.max())]})
        keep |= sel

    alpha = np.asarray(Image.fromarray((keep * 255).astype(np.uint8))
                       .filter(ImageFilter.GaussianBlur(0.6))).astype(np.float64)
    ys, xs = np.nonzero(alpha > 8)
    bx0, by0, bx1, by1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    arr = np.dstack([rgb[by0:by1, bx0:bx1], alpha[by0:by1, bx0:bx1]])
    Image.fromarray(arr.round().astype(np.uint8), 'RGBA').save(a.out)

    man = {'tool': 'tools/lanecf/pew_cut.py', 'band': BAND, 'pewV': PEW_V,
           'minArea': MIN_AREA, 'components': sorted(comps, key=lambda c: -c['area']),
           'box': [bx0, by0, bx1 - bx0, by1 - by0],
           'alpha_px': int((alpha > 127).sum()),
           'out': a.out, 'sha256': sha256(a.out)}
    json.dump(man, open(os.path.join(a.raw, 'pew_cut.json'), 'w'), indent=1)
    print(json.dumps({k: man[k] for k in ('box', 'alpha_px', 'sha256')}))
    print('components: ' + json.dumps(man['components'][:6]))


if __name__ == '__main__':
    main()
