#!/usr/bin/env python3
"""platediff.py -- prove a plate VARIANT changed only what it was allowed to.

A variant is accepted only if the composition is locked: every pixel outside
the intended region must survive. Two independent measures, because the two
variants fail in different ways:

  CHANGE MASK  per-pixel |cand - orig| in Lab-ish space -> % changed, bbox,
               and a 16x8 cell grid so drift shows up as cells that lit up
               far from the intended region.
  EDGE IOU     Sobel edge maps, binarised at a common quantile, intersection
               over union. A relight keeps edges (high IoU) even though every
               pixel moved; a re-render moves the geometry and IoU collapses.

Also reports the best global integer shift (a re-rendered plate is usually
offset/rescaled, and it is only fair to score it after undoing that).

    python3 platediff.py ORIG CAND OUTDIR [--region x0,y0,x1,y1] [--label id]
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageFilter

W, H = 1408, 768


def load(p):
    im = Image.open(p).convert('RGB')
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    return np.asarray(im).astype(np.float32)


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def sobel(g):
    im = Image.fromarray(np.clip(g, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.FIND_EDGES)).astype(np.float32)


def best_shift(a, b, rad=6):
    """integer (dx,dy) minimising mean abs luminance diff, coarse search"""
    ga, gb = lum(a), lum(b)
    best, bd = (0, 0), None
    for dy in range(-rad, rad + 1):
        for dx in range(-rad, rad + 1):
            sa = ga[max(0, dy):H + min(0, dy), max(0, dx):W + min(0, dx)]
            sb = gb[max(0, -dy):H + min(0, -dy), max(0, -dx):W + min(0, -dx)]
            d = float(np.abs(sa - sb).mean())
            if bd is None or d < bd:
                bd, best = d, (dx, dy)
    return best, bd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('orig')
    ap.add_argument('cand')
    ap.add_argument('outdir')
    ap.add_argument('--region', default='', help='x0,y0,x1,y1 intended-change box')
    ap.add_argument('--label', default='cand')
    ap.add_argument('--thresh', type=float, default=18.0)
    a = ap.parse_args()

    os.makedirs(a.outdir, exist_ok=True)
    o, c = load(a.orig), load(a.cand)

    shift, shift_err = best_shift(o, c)
    d = np.abs(o - c).max(axis=2)
    mask = d > a.thresh
    pct = float(mask.mean() * 100)

    ys, xs = np.nonzero(mask)
    bbox = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if len(xs) else None

    # 16 x 8 cell grid of change fraction
    gy, gx = 8, 16
    cells = mask.reshape(gy, H // gy, gx, W // gx).mean(axis=(1, 3))

    # edge structure
    eo, ec = sobel(lum(o)), sobel(lum(c))
    q = float(np.quantile(eo, 0.97))
    bo, bc = eo > q, ec > q
    iou = float((bo & bc).sum() / max(1, (bo | bc).sum()))

    # ...and the same measure made SCALE-INVARIANT, by binarising each plate at
    # ITS OWN 97th percentile. edge_iou above uses the original's ABSOLUTE
    # threshold, which is the right test for a re-render but a false alarm for a
    # DIM variant: a plate that is uniformly 2.3x darker has 2.3x smaller edge
    # magnitudes, so nearly none of them clear the bright plate's bar and the
    # IoU collapses even when the geometry is provably identical. Measured on
    # the chase dim variant, which is the master multiplied by a smooth field
    # and therefore cannot have moved: edge_iou 0.285, edge_iou_selfq 0.93.
    # Read edge_iou for "did it re-render", edge_iou_selfq for "did it move".
    qc = float(np.quantile(ec, 0.97))
    bos, bcs = eo > q, ec > qc
    iou_self = float((bos & bcs).sum() / max(1, (bos | bcs).sum()))

    res = {
        'label': a.label, 'changed_pct': round(pct, 2), 'bbox': bbox,
        'edge_iou': round(iou, 3),
        'edge_iou_selfq': round(iou_self, 3),
        'best_global_shift': {'dx': shift[0], 'dy': shift[1],
                              'resid_mean_abs_lum': round(shift_err, 2)},
        'mean_lum_orig': round(float(lum(o).mean()), 1),
        'mean_lum_cand': round(float(lum(c).mean()), 1),
    }

    if a.region:
        x0, y0, x1, y1 = [int(v) for v in a.region.split(',')]
        inreg = np.zeros_like(mask)
        inreg[y0:y1, x0:x1] = True
        inside = int((mask & inreg).sum())
        outside = int((mask & ~inreg).sum())
        res['intended_region'] = [x0, y0, x1, y1]
        res['changed_px_inside'] = inside
        res['changed_px_outside'] = outside
        res['outside_pct_of_frame'] = round(outside / (W * H) * 100, 2)
        res['leak_ratio'] = round(outside / max(1, inside + outside), 3)

    # visual: red overlay of the change mask on the original
    vis = o.copy()
    vis[mask] = vis[mask] * 0.35 + np.array([255, 40, 40], np.float32) * 0.65
    Image.fromarray(vis.astype(np.uint8)).save(
        os.path.join(a.outdir, '%s-diffmask.png' % a.label))

    # cell grid as text so it reads in a log
    res['cell_grid_pct'] = [[int(round(v * 100)) for v in row] for row in cells]
    print(json.dumps(res, indent=1))
    with open(os.path.join(a.outdir, '%s-diff.json' % a.label), 'w') as f:
        json.dump(res, f, indent=1)


if __name__ == '__main__':
    main()
