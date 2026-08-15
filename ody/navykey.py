#!/usr/bin/env python3
"""navykey.py -- navy-backing key for the ody pose lanes (task #4 COMMON spec).

Why not laneassets/matte.py: its alpha ramp lo=60..hi=125 is a MAGENTA-backing
law. Against the #1a2038 navy backing the actor's own black beard/hair and the
dark shadow facets sit within ~60 of the backing colour, so the stock ramp
keys the middle of the figure out (measured: 16-29% of shipped pixels were
semi-transparent, beard gone).

Measured facts that shaped this key (probe on the polyphemus lane):
  ring (true backing)  dist p99 ~5-8 of the ring median -- the backing is SOLID
  beard/hair paint     dist p1 as low as 0 -- colour CANNOT fully separate;
                       but the sub-threshold hair pixels are SCATTERED, not
                       contiguous, so a pinhole close absorbs the casualties
  border flood at t=24 bled through the near-navy hair into the beard, and
                       enclosed navy pockets (between a seated figure's legs)
                       stayed opaque -- connectivity alone fails both ways
Law: key on a TIGHT global distance threshold adaptive off the border ring
(t = clamp(ring_p99 + 3, 7..14)). Pure navy keys ANYWHERE (enclosed pockets
included); scattered dark-figure casualties are closed by the 3 px pinhole
pass; the navy-blend fringe dies to the same 2 px erosion + 0.7 px feather the
shipped magenta tool uses. Then the rim-only BLUE-excess clamp
(B - (R+G)/2 <= ceiling), the navy twin of matte_actors' magenta clamp.

    python3 navykey.py IN OUT [--json OUT.json] [--pad 6] [--ceiling 12]
"""
import argparse
import json
import numpy as np
from PIL import Image, ImageFilter


def backing_colour(a):
    ring = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3),
                           a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    return np.median(ring, axis=0)


def key(path, pad=6, ceiling=12.0):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    bg = backing_colour(a)
    dist = np.sqrt(((a - bg) ** 2).sum(-1))

    ring = np.concatenate([dist[:8].ravel(), dist[-8:].ravel(),
                           dist[:, :8].ravel(), dist[:, -8:].ravel()])
    t = float(np.clip(np.percentile(ring, 99) + 3.0, 7.0, 14.0))

    alpha = (dist >= t).astype(np.float32)
    ai = Image.fromarray((alpha * 255).astype(np.uint8))
    # pinhole close: absorb the scattered sub-threshold hair/beard pixels
    ai = ai.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    # de-speckle the backing: kill isolated noise-blocks that beat t
    ai = ai.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    # 2 px erosion (navy-blend fringe) + feather -- the shipped tool's numbers
    ai = ai.filter(ImageFilter.MinFilter(5))
    ai = ai.filter(ImageFilter.GaussianBlur(0.7))
    alpha = np.asarray(ai).astype(np.float32) / 255.0

    # rim-only BLUE-excess clamp: navy spill = blue over the warm channels
    rgbf = a.copy()
    a8 = (alpha * 255).astype(np.uint8)
    interior = np.asarray(Image.fromarray(a8).filter(ImageFilter.MinFilter(9)))
    band = (alpha > 0.02) & (interior < 250)
    r, g, b = rgbf[..., 0], rgbf[..., 1], rgbf[..., 2]
    excess = b - (r + g) * 0.5
    hot = band & (excess > ceiling)
    if hot.any():
        base = (r + g) * 0.5
        k = np.ones_like(excess)
        k[hot] = ceiling / excess[hot]
        rgbf[..., 2] = np.where(hot, base + (b - base) * k, b)

    out = np.dstack([np.clip(rgbf, 0, 255).astype(np.uint8),
                     (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    img = Image.fromarray(out)

    bbox = Image.fromarray((alpha > 0.02).astype(np.uint8) * 255).getbbox()
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(img.width, x1 + pad); y1 = min(img.height, y1 + pad)
    cut = img.crop((x0, y0, x1, y1))
    meta = {'source': path, 'backing_rgb': [round(float(v), 1) for v in bg],
            't_close': round(t, 1), 'ceiling': ceiling,
            'size': list(cut.size), 'src_bbox': [x0, y0, x1, y1],
            'baseline_y': cut.height - pad}
    return cut, meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inp'); ap.add_argument('out')
    ap.add_argument('--json', default=''); ap.add_argument('--pad', type=int, default=6)
    ap.add_argument('--ceiling', type=float, default=12.0)
    a = ap.parse_args()
    cut, meta = key(a.inp, a.pad, a.ceiling)
    cut.save(a.out); meta['out'] = a.out
    print(json.dumps(meta))
    if a.json:
        json.dump(meta, open(a.json, 'w'), indent=1)


if __name__ == '__main__':
    main()
