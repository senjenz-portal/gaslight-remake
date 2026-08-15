#!/usr/bin/env python3
"""shoredaygate.py -- acceptance gate for the shore DAY state (relight + goats).

The day state is a WHOLE-PLATE RELIGHT (PIPELINE-LIVING.md 3.1: acceptable
because the state IS a relight) PLUS one object change (goats on the island).
platediff.py's whole-plate numbers therefore cannot gate it alone; this gate
asserts the OBJECT and the GEOMETRY per-region:

  (a) GEOMETRY  self-quantile Sobel edge IoU (platediff's edge_iou_selfq
      measure) restricted to the two landmass regions, where sky-gradient and
      water-sparkle repaint cannot vote. Plus best integer shift must be (0,0).
  (b) GOATS     relight-normalise (smooth local gain field, 31px blur) then
      connected components of the residual inside the island region, sized
      goat-like (60..2600 px). These are NEW blobs: same components measured
      master-vs-master are zero.
  (c) SHIPS     edge IoU in the ship boxes; the hulls/masts/oars must sit on
      the master's own edge pixels.

    python3 shoredaygate.py MASTER CAND [--out report.json]
"""
import argparse
import json

import numpy as np
from PIL import Image, ImageFilter

W, H = 1408, 768

ISLAND = (140, 150, 660, 625)     # goat island incl. crags + camp terrace
MAINLAND = (760, 55, 1245, 365)   # cliff, cave, pens
SHIPS = [(430, 335, 640, 460),    # far ship
         (495, 390, 720, 525)]    # near ship
FIRE = (395, 425, 500, 505)       # campfire ring


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


def blur(g, r):
    im = Image.fromarray(np.clip(g, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r))).astype(np.float32)


def region_edge_iou(eo, ec, box, q=0.97):
    x0, y0, x1, y1 = box
    ro, rc = eo[y0:y1, x0:x1], ec[y0:y1, x0:x1]
    bo = ro > np.quantile(ro, q)
    bc = rc > np.quantile(rc, q)
    return float((bo & bc).sum() / max(1, (bo | bc).sum()))


def label_blobs(mask):
    """4-connected components, stack flood fill; returns list of (size,cx,cy)."""
    lab = np.zeros(mask.shape, np.int32)
    blobs = []
    nxt = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]:
            continue
        nxt += 1
        stack = [(y0, x0)]
        lab[y0, x0] = nxt
        px = []
        while stack:
            y, x = stack.pop()
            px.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx_ = y + dy, x + dx
                if (0 <= ny < mask.shape[0] and 0 <= nx_ < mask.shape[1]
                        and mask[ny, nx_] and not lab[ny, nx_]):
                    lab[ny, nx_] = nxt
                    stack.append((ny, nx_))
        arr = np.array(px)
        blobs.append((len(px), float(arr[:, 1].mean()), float(arr[:, 0].mean())))
    return blobs


def best_shift(a, b, rad=6):
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
    ap.add_argument('master')
    ap.add_argument('cand')
    ap.add_argument('--out', default=None)
    ap.add_argument('--resid-thresh', type=float, default=32.0)
    a = ap.parse_args()

    o, c = load(a.master), load(a.cand)
    lo, lc = lum(o), lum(c)
    eo, ec = sobel(lo), sobel(lc)

    # (a) geometry per landmass region + global shift
    shift, shift_err = best_shift(o, c)
    geom = {
        'island_edge_iou_selfq': round(region_edge_iou(eo, ec, ISLAND), 3),
        'mainland_edge_iou_selfq': round(region_edge_iou(eo, ec, MAINLAND), 3),
        'best_global_shift': {'dx': shift[0], 'dy': shift[1],
                              'resid_mean_abs_lum': round(shift_err, 2)},
    }

    # (b) goats: divide out the smooth relight gain, blob the residual
    gain = (blur(lc, 31) + 4.0) / (blur(lo, 31) + 4.0)
    resid = np.abs(lc - lo * gain)
    x0, y0, x1, y1 = ISLAND
    rmask = np.zeros((H, W), bool)
    rmask[y0:y1, x0:x1] = resid[y0:y1, x0:x1] > a.resid_thresh
    # drop the campfire cells: fire-out is its own scripted change, not a goat
    fx0, fy0, fx1, fy1 = FIRE
    rmask[fy0:fy1, fx0:fx1] = False
    blobs = [b for b in label_blobs(rmask) if 60 <= b[0] <= 2600]
    goats = {
        'residual_thresh': a.resid_thresh,
        'blob_size_range_px': [60, 2600],
        'new_blob_count_island': len(blobs),
        'blobs_size_cx_cy': [[b[0], round(b[1]), round(b[2])] for b in
                             sorted(blobs, reverse=True)],
    }

    # (c) ships: edge IoU per hull box, master-quantile AND self-quantile
    ships = []
    for i, box in enumerate(SHIPS):
        ships.append({
            'box': list(box),
            'edge_iou_selfq': round(region_edge_iou(eo, ec, box), 3),
        })

    # fire region: mean lum in the fire ring (was the glow killed?)
    fx = (slice(fy0, fy1), slice(fx0, fx1))
    fire = {'mean_lum_master': round(float(lo[fx].mean()), 1),
            'mean_lum_cand': round(float(lc[fx].mean()), 1),
            'max_lum_master': round(float(lo[fx].max()), 1),
            'max_lum_cand': round(float(lc[fx].max()), 1)}

    rep = {'master': a.master, 'cand': a.cand,
           'whole_plate_mean_lum': [round(float(lo.mean()), 1),
                                    round(float(lc.mean()), 1)],
           'geometry': geom, 'goats': goats, 'ships': ships, 'fire': fire}
    print(json.dumps(rep, indent=1))
    if a.out:
        with open(a.out, 'w') as f:
            json.dump(rep, f, indent=1)


if __name__ == '__main__':
    main()
