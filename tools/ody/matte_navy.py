#!/usr/bin/env python3
"""matte_navy.py -- key an odyssey actor off the flat #1a2038 NAVY backing.

laneassets/matte.py (and laneactors/matte_actors.py) were built for a MAGENTA
backing and fail on this book's navy field in two measured ways:

  1. THRESHOLDS. Their alpha band (lo=60, hi=125 colour distance) assumes the
     figure is far from the backing everywhere. Odyssey actors are made of
     dark hair, dark beards and shadowed crimson -- 17..45 from the navy --
     so the head and every shadow facet keyed OUT (verified on the ulysses
     canonical: transparent holes through hair, beard, tunic shadows).
  2. SPILL AXIS. Their despill/clamp attack magenta excess (R+B)/2 - G, which
     is what CRIMSON is made of -- the tunic came out grey. Navy backing
     bleeds BLUE: B above max(R, G). Different axis entirely.

So this tool keys by CONNECTIVITY, not by distance alone: the true backing is
the border-connected region of backing-like pixels (threshold adapted from the
border ring's own noise ceiling -- the JPEG codec cloud is measured, not
guessed). Everything not border-connected is figure and stays fully opaque,
however dark. Spill correction is a rim-only BLUE-excess clamp with the
ceiling taken from the figure's own interior (a night-sea man is allowed to
be as blue as his own chest).

    python3 matte_navy.py IN OUT [--json OUT.json] [--pad 6] [--feather 12]
Prints one-line JSON with size, src_bbox, foot baseline_y, backing rgb.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageFilter


def backing_colour(a, r=12):
    ring = np.concatenate([a[:r].reshape(-1, 3), a[-r:].reshape(-1, 3),
                           a[:, :r].reshape(-1, 3), a[:, -r:].reshape(-1, 3)])
    return np.median(ring, axis=0), ring


def flood_background(bglike):
    """border-connected component of the backing-like mask (4-connected)."""
    h, w = bglike.shape
    seen = np.zeros((h, w), bool)
    stack = []
    for x in range(w):
        for y in (0, h - 1):
            if bglike[y, x] and not seen[y, x]:
                seen[y, x] = True
                stack.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if bglike[y, x] and not seen[y, x]:
                seen[y, x] = True
                stack.append((y, x))
    while stack:
        y, x = stack.pop()
        if y > 0 and bglike[y - 1, x] and not seen[y - 1, x]:
            seen[y - 1, x] = True
            stack.append((y - 1, x))
        if y < h - 1 and bglike[y + 1, x] and not seen[y + 1, x]:
            seen[y + 1, x] = True
            stack.append((y + 1, x))
        if x > 0 and bglike[y, x - 1] and not seen[y, x - 1]:
            seen[y, x - 1] = True
            stack.append((y, x - 1))
        if x < w - 1 and bglike[y, x + 1] and not seen[y, x + 1]:
            seen[y, x + 1] = True
            stack.append((y, x + 1))
    return seen


def key_navy(path, pad_feather=12):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    bg, ring = backing_colour(a)
    ring_d = np.sqrt(((ring - bg) ** 2).sum(axis=1))
    # adaptive: the codec cloud measured off the ring itself, with headroom.
    # The ring may contain FIGURE pixels (a pose that exits the frame), so the
    # cloud is measured only over ring pixels near the median backing -- and
    # the threshold is capped: a figure that bleeds off-frame must not widen
    # the key until the whole canvas reads as backing (the slung-pose lesson).
    true_ring = ring_d[ring_d < 60.0]
    if len(true_ring) < 100:
        true_ring = ring_d
    t = max(12.0, min(48.0, float(np.percentile(true_ring, 99.9)) + 8.0))
    d = np.sqrt(((a - bg) ** 2).sum(axis=2))
    bglike = d < t
    bgconn = flood_background(bglike)
    fig = ~bgconn
    # ENCLOSED backing pockets (hand-on-hip triangle, bowl-handle loops) are
    # backing-like but not border-connected, so the flood keeps them opaque.
    # Clear any enclosed bglike component that is big enough to be a real
    # hole and reads as PURE backing (tight distance), not as dark costume.
    pocket = bglike & ~bgconn
    if pocket.any():
        h, w = pocket.shape
        seen = np.zeros((h, w), bool)
        ys, xs = np.nonzero(pocket)
        for sy, sx in zip(ys, xs):
            if seen[sy, sx]:
                continue
            comp = [(sy, sx)]
            seen[sy, sx] = True
            stack = [(sy, sx)]
            while stack:
                y, x = stack.pop()
                for ny, nx in ((y-1, x), (y+1, x), (y, x-1), (y, x+1)):
                    if 0 <= ny < h and 0 <= nx < w and pocket[ny, nx] \
                            and not seen[ny, nx]:
                        seen[ny, nx] = True
                        comp.append((ny, nx))
                        stack.append((ny, nx))
            if len(comp) >= 80:
                cy = np.array([c[0] for c in comp])
                cx = np.array([c[1] for c in comp])
                if float(d[cy, cx].mean()) < t * 0.7:
                    fig[cy, cx] = False
    # soft edge: signed distance across the boundary via box-blurred mask
    a8 = Image.fromarray((fig * 255).astype(np.uint8))
    # erode 2px (navy-tinted opaque ring -- same lesson as matte.py's shrink)
    a8 = a8.filter(ImageFilter.MinFilter(5))
    a8 = a8.filter(ImageFilter.GaussianBlur(0.7))
    alpha = np.asarray(a8).astype(np.float32) / 255.0
    # rim band = semi-transparent skin + the first opaque inset ring
    interior = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8))
                          .filter(ImageFilter.MinFilter(9))) >= 250
    band = (alpha > 0.02) & ~interior
    rgb = a.copy()
    # rim-only BLUE-excess clamp, ceiling from the figure's own interior
    ex = rgb[..., 2] - np.maximum(rgb[..., 0], rgb[..., 1])
    ceiling = 12.0
    if interior.sum() > 500:
        ceiling = max(12.0, float(np.percentile(ex[interior], 98)))
    hot = band & (ex > ceiling)
    if hot.any():
        # pull B toward max(R,G)+ceiling; convex, cannot leave range
        target = np.maximum(rgb[..., 0], rgb[..., 1]) + ceiling
        rgb[..., 2][hot] = target[hot]
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out), bg, t, round(ceiling, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inp')
    ap.add_argument('out')
    ap.add_argument('--json', default='')
    ap.add_argument('--pad', type=int, default=6)
    args = ap.parse_args()
    img, bg, t, ceiling = key_navy(args.inp)
    al = np.asarray(img)[..., 3]
    ys, xs = np.nonzero(al > 24)
    x0 = max(0, int(xs.min()) - args.pad)
    y0 = max(0, int(ys.min()) - args.pad)
    x1 = min(img.width, int(xs.max()) + 1 + args.pad)
    y1 = min(img.height, int(ys.max()) + 1 + args.pad)
    cut = img.crop((x0, y0, x1, y1))
    cut.save(args.out)
    meta = {'source': os.path.abspath(args.inp),
            'backing_rgb': [round(float(v), 1) for v in bg],
            'threshold': round(t, 1), 'blue_ceiling': ceiling,
            'size': list(cut.size), 'src_bbox': [x0, y0, x1, y1],
            'baseline_y': cut.height - args.pad,
            'out': os.path.abspath(args.out)}
    print(json.dumps(meta))
    if args.json:
        with open(args.json, 'w') as f:
            json.dump(meta, f, indent=1)


if __name__ == '__main__':
    main()
