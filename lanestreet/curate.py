#!/usr/bin/env python3
"""curate.py -- take a raw street candidate into PLATE SPACE and measure it.

The API's 1K 16:9 output is 1376x768. Plate space -- the space every asset
manifest, stage.js box and platediff comparison in this book is written in --
is 1408x768. The one transform applied here is a LANCZOS resize of 1376 -> 1408
(a uniform 2.33% horizontal scale). It is chosen over padding because padding
would have to INVENT 32 columns of backdrop; a resize invents no content and
leaves no seam. Everything downstream (the i2i variants, which come back at the
input's own size) is then already in plate space.

It also MEASURES the plate rather than eyeballing it, and writes the numbers
the runtime will need: the warm emissive blobs (gas lamp, bay glass, upper
window, fanlight, terrace panes) as connected components of a warm-and-bright
mask, plus the island's own bounding hull.

    python3 curate.py RAW.png OUT.png [--manifest OUT.json]
"""
import argparse
import hashlib
import json
import os

import numpy as np
from PIL import Image

PLATE_W, PLATE_H = 1408, 768


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def components(mask, min_px=40):
    """4-connected components by iterative label propagation (numpy only)."""
    lab = np.zeros(mask.shape, np.int32)
    lab[mask] = np.arange(1, mask.sum() + 1)
    for _ in range(400):
        prev = lab
        m = lab.copy()
        m[1:, :] = np.maximum(m[1:, :], lab[:-1, :])
        m[:-1, :] = np.maximum(m[:-1, :], lab[1:, :])
        m[:, 1:] = np.maximum(m[:, 1:], lab[:, :-1])
        m[:, :-1] = np.maximum(m[:, :-1], lab[:, 1:])
        m[~mask] = 0
        lab = m
        if np.array_equal(prev, lab):
            break
    out = []
    for v in np.unique(lab):
        if v == 0:
            continue
        ys, xs = np.nonzero(lab == v)
        if len(xs) < min_px:
            continue
        out.append({'px': int(len(xs)),
                    'bbox': [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
                    'centroid': [round(float(xs.mean()), 1), round(float(ys.mean()), 1)]})
    return sorted(out, key=lambda c: -c['px'])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('raw')
    ap.add_argument('out')
    ap.add_argument('--manifest', default='')
    a = ap.parse_args()

    im = Image.open(a.raw).convert('RGB')
    src_size = list(im.size)
    if im.size != (PLATE_W, PLATE_H):
        im = im.resize((PLATE_W, PLATE_H), Image.LANCZOS)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    im.save(a.out, 'PNG', optimize=True)

    v = np.asarray(im).astype(np.float32)
    lum = v[..., 0] * .299 + v[..., 1] * .587 + v[..., 2] * .114
    warm = v[..., 0] - v[..., 2]                    # amber vs the navy field

    emis = components((lum > 120) & (warm > 30), min_px=60)
    lit = components((lum > 70) & (warm > 14), min_px=200)
    # the island: anything that is not the navy backdrop. The backdrop is cool
    # and dark everywhere, so a generous luminance-and-hue floor finds the slab.
    isl = (lum > 26) | (warm > 6)
    ys, xs = np.nonzero(isl)
    hull = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]

    res = {
        'plate_space': [PLATE_W, PLATE_H],
        'source': {'path': os.path.abspath(a.raw), 'size': src_size,
                   'sha256': sha(a.raw)},
        'transform': ('LANCZOS resize %dx%d -> %dx%d (uniform %.2f%% horizontal '
                      'scale); no padding, no crop, no invented pixels'
                      % (src_size[0], src_size[1], PLATE_W, PLATE_H,
                         (PLATE_W / src_size[0] - 1) * 100)),
        'out': {'path': os.path.abspath(a.out), 'sha256': sha(a.out),
                'bytes': os.path.getsize(a.out)},
        'island_bbox': hull,
        'mean_lum': round(float(lum.mean()), 2),
        'backdrop_lum': round(float(lum[~isl].mean()), 2),
        'emissive_cores': emis[:12],
        'lit_regions': lit[:12],
    }
    print(json.dumps(res, indent=1))
    if a.manifest:
        with open(a.manifest, 'w') as f:
            json.dump(res, f, indent=1)


if __name__ == '__main__':
    main()
