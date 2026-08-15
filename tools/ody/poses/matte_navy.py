#!/usr/bin/env python3
"""matte_navy.py -- key a painted odyssey actor off its flat NAVY backing.

The odyssey actor lane generates on a flat #1a2038 dark navy field (JPEG, so a
cloud around that value). The sherlock matte (tools/laneassets/matte.py) keys
by colour distance alone with lo=60 -- correct for magenta, WRONG for navy:
dark hair, hoof shadow and slate-blue cloth sit 35-55 from navy and would key
half-transparent. And its despill/clamp are magenta-specific ((R+B)/2 - G):
on this cast that measure would repaint the crimson chiton -- the one accent
that must survive (ram-great-slung carries THE tableau).

So this tool keys by CONNECTIVITY + a soft rim, and despills BLUE:

  1. backing = median of the 12 px border ring (same as the shipped tool);
  2. hard-backing mask = distance < t_bg; BACKGROUND = only the part of that
     mask CONNECTED TO THE BORDER (iterative dilation flood, no scipy) --
     a navy-dark pixel inside the figure stays opaque;
  3. alpha: interior 1, background 0, softened by the true distance band ONLY
     in a 3 px skin around the boundary (so the edge feathers, the body never
     thins); then 2 px erosion (the JPEG ring bite, same law as sherlock's);
  4. despill NAVY: excess = B - max(R,G), clamped RIM-ONLY toward the
     figure's own interior ceiling (matte_actors.py's costume-aware lesson);
  5. trim to bbox + pad, report the foot baseline.

    python3 matte_navy.py IN OUT [--json OUT.json] [--pad 6] [--tbg 26]
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageFilter


def backing_colour(a):
    h, w = a.shape[:2]
    r = 12
    ring = np.concatenate([a[:r].reshape(-1, 3), a[-r:].reshape(-1, 3),
                           a[:, :r].reshape(-1, 3), a[:, -r:].reshape(-1, 3)])
    return np.median(ring, axis=0)


def flood_from_border(mask):
    """largest border-connected region of `mask`, by iterative dilation."""
    seed = np.zeros_like(mask)
    seed[0, :] = mask[0, :]; seed[-1, :] = mask[-1, :]
    seed[:, 0] = mask[:, 0]; seed[:, -1] = mask[:, -1]
    prev = 0
    while True:
        n = int(seed.sum())
        if n == prev:
            return seed
        prev = n
        im = Image.fromarray((seed * 255).astype(np.uint8))
        # dilate hard (31px) then re-mask; converges in a few rounds
        grown = np.asarray(im.filter(ImageFilter.MaxFilter(31))) > 0
        seed = grown & mask


def enclosed_pockets(d, background, t_pure=9.0, min_area=120):
    """pure-backing regions NOT border-connected (an arm/oar loop encloses a
    patch of the flat field; connectivity alone keeps it opaque -- wrongly).
    Only near-exact backing counts: a costume's own navy-dark shadow sits
    further from the backing than the generator's flat field does."""
    cand = (d < t_pure) & ~background
    out = np.zeros_like(cand)
    if not cand.any():
        return out
    lab = np.zeros(cand.shape, np.int8)   # 0 unvisited, 1 visited
    h, w = cand.shape
    for sy, sx in np.argwhere(cand):
        if lab[sy, sx]:
            continue
        stack, comp = [(sy, sx)], []
        lab[sy, sx] = 1
        while stack:
            y, x = stack.pop()
            comp.append((y, x))
            for ny, nx in ((y-1, x), (y+1, x), (y, x-1), (y, x+1)):
                if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = 1
                    stack.append((ny, nx))
        if len(comp) >= min_area:
            ys, xs = zip(*comp)
            out[list(ys), list(xs)] = True
    return out


def key(path, t_bg=26.0, band_lo=18.0, band_hi=60.0):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    bg = backing_colour(a)
    d = np.sqrt(((a - bg) ** 2).sum(axis=2))
    backingish = d < t_bg
    background = flood_from_border(backingish)
    background = background | enclosed_pockets(d, background)

    al = (~background).astype(np.float32)
    # soften: distance-band alpha, applied only in the 3px skin of the edge
    a8 = Image.fromarray((al * 255).astype(np.uint8))
    inner = np.asarray(a8.filter(ImageFilter.MinFilter(7))) / 255.0
    outer = np.asarray(a8.filter(ImageFilter.MaxFilter(7))) / 255.0
    skin = (outer > 0) & (inner < 1)
    soft = np.clip((d - band_lo) / (band_hi - band_lo), 0, 1)
    al[skin] = np.minimum(al[skin] + (outer[skin] - al[skin]), soft[skin])
    # pinhole close + the sherlock 2px erosion law + feather
    ai = Image.fromarray((al * 255).astype(np.uint8))
    ai = ai.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    ai = ai.filter(ImageFilter.MinFilter(5))
    ai = ai.filter(ImageFilter.GaussianBlur(0.7))
    al = np.asarray(ai).astype(np.float32) / 255.0

    # NAVY despill, rim-only, costume-aware ceiling
    rgb = a.copy()
    a8 = (np.clip(al, 0, 1) * 255).astype(np.uint8)
    interior_m = np.asarray(Image.fromarray(a8).filter(ImageFilter.MinFilter(9))) >= 250
    band = (al > 0.02) & ~interior_m
    ex = rgb[..., 2] - np.maximum(rgb[..., 0], rgb[..., 1])
    ceiling = 12.0
    if interior_m.sum() > 500:
        ceiling = max(12.0, float(np.percentile(ex[interior_m], 98)))
    hot = band & (ex > ceiling)
    if hot.any():
        k = ceiling / ex[hot]
        base = np.maximum(rgb[..., 0], rgb[..., 1])
        rgb[..., 2][hot] = base[hot] + (rgb[..., 2][hot] - base[hot]) * k
    out = np.dstack([np.clip(rgb, 0, 255), al * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA'), bg, round(ceiling, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inp'); ap.add_argument('out')
    ap.add_argument('--json', default=''); ap.add_argument('--pad', type=int, default=6)
    ap.add_argument('--tbg', type=float, default=26.0)
    args = ap.parse_args()
    img, bg, ceiling = key(args.inp, t_bg=args.tbg)
    al = np.asarray(img)[..., 3]
    ys, xs = np.nonzero(al > 24)
    x0, y0 = max(0, xs.min() - args.pad), max(0, ys.min() - args.pad)
    x1 = min(img.width, xs.max() + 1 + args.pad)
    y1 = min(img.height, ys.max() + 1 + args.pad)
    cut = img.crop((x0, y0, x1, y1))
    cut.save(args.out)
    meta = {'source': os.path.abspath(args.inp),
            'backing_rgb': [round(float(v), 1) for v in bg],
            'keyer': 'matte_navy.py (border-flood + rim band; blue despill rim-only)',
            'despill_ceiling': ceiling,
            'size': list(cut.size), 'src_bbox': [int(x0), int(y0), int(x1), int(y1)],
            'baseline_y': cut.height - args.pad,
            'out': os.path.abspath(args.out)}
    print(json.dumps(meta))
    if args.json:
        with open(args.json, 'w') as f:
            json.dump(meta, f, indent=1)


if __name__ == '__main__':
    main()
