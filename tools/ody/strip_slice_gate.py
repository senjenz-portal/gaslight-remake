#!/usr/bin/env python3
"""strip_slice_gate.py -- slice a 4-frame NB PRO sheet into a shippable strip,
numerically gated (STRIPS.md + PIPELINE-LIVING.md 3.3 + the sherlock anchor law).

Deterministic slicing: EQUAL QUARTERS of the sheet width -- never content-found
cells (the crossed-sticks lesson: geometry assumed is geometry wrong; geometry
measured off each cell's own alpha is the law). Each quarter is keyed off the
navy backing with tools/ody/matte_navy.key_navy (the odyssey matte of record),
then all four cells are cropped to the UNION alpha box in cell-local coords --
per-cell trim that keeps the cells EQUAL, because the paint path is
backgroundPosition = -frame*cw and unequal cells cannot ride it.

GATES, per cell, numbers not eyes:
  (a) identity  -- darkest-head-pixel cluster warm/cool (mean R-B of the
      darkest 2% in the top 10% of the figure, INTERIOR pixels only -- the
      opaque mask eroded 3 px, because the keyed rim keeps a navy blend that
      reads cool and contaminated the canonical's own cluster by 23 points;
      top 10%, not 15/25%, because a braced pose raises shoulders and hands
      to head height and a 15% window was measured catching dark CRIMSON
      TUNIC shadow -- RGB (80,25,30), warm +50 -- on a canon-dark head)
      within +-20 of the canonical's, measured by THIS function through the
      same matte path (the bride lesson: a number decides);
  (b) scale     -- cell alpha-bbox heights within +-8% of each other;
  (c) anchors   -- foot-span centre of each cell's bottom 20 alpha rows,
      recorded per frame (the King pattern);
  (d) action    -- frame-to-frame changed-pixel fraction over the union
      silhouette neither ~0 (static, <2%) nor chaotic (>60%). Measured in
      ANCHOR-ALIGNED space: the paint path is `left = x - anchors[frame]*ws`,
      so the reader never sees in-cell translation -- each frame is registered
      on its own foot anchor/baseline before diffing, and only true pose
      change counts. The measure is silhouette XOR over the union silhouette:
      an interior colour diff flips on JPEG/facet repaint noise (measured
      77-89% between visibly near-identical frames) and cannot separate a
      walking man from a static one.

SEATED MODE (--mode seated, the crew-row transposition): a rower's raw bbox
and bottom-20-rows land on the SWEEPING OAR BLADE, not the man -- the blade
tip is the lowest alpha and it moves 100+ px per frame by design, so the
generic measures gate the oar's choreography, not the figure's consistency
(the stake-pin lesson transposed: anchor the fact that must hold still).
Seated measures: scale = head-band man height (columns whose alpha top is
within 12% of the figure top, widened 5%); anchors/baseline = the MAN's feet,
measured in the man's own column band; action = unshifted XOR (the bench is
the static registration fact and cells share the union-crop frame).

DESPECKLE: connected alpha components under 150 px are dropped per cell
before any measurement -- a 13 px JPEG-artifact speck 85 px below the feet
was observed setting a cell's baseline (matte hygiene, not retouching).

    python3 strip_slice_gate.py SHEET OUT_STRIP --ref-warmcool F [--pad 8]
                                [--mode standing|seated]
Prints one-line JSON: gates, anchors, srcH, cell, verdict.
"""
import argparse
import json
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, '/Users/samz/Documents/gaslight-remake/tools/ody')
from matte_navy import key_navy  # noqa: E402

THR = 24  # alpha threshold, same as matte.py bbox_of


def head_warmcool(rgba):
    """mean R-B of the darkest 2% of INTERIOR pixels in the top 10% of the
    figure (the crown -- above shoulders and raised hands in every pose).
    Interior = opaque mask eroded 3 px (MinFilter 7), so the keyed rim's
    navy blend can never join the cluster on either side of the
    comparison."""
    from PIL import ImageFilter
    a = rgba[..., :3].astype(np.float32)
    al = rgba[..., 3]
    ys, xs = np.nonzero(al > THR)
    if not len(ys):
        return None
    m8 = Image.fromarray(((al > 200) * 255).astype(np.uint8))
    inter = np.asarray(m8.filter(ImageFilter.MinFilter(7))) > 128
    top = ys.min()
    h = ys.max() - top + 1
    iy, ix = np.nonzero(inter)
    head = iy < top + 0.10 * h
    hy, hx = iy[head], ix[head]
    if len(hy) < 50:
        return None
    lum = a[hy, hx].mean(axis=1)
    k = max(30, int(0.02 * len(lum)))
    idx = np.argsort(lum)[:k]
    px = a[hy[idx], hx[idx]]
    return float(px[:, 0].mean() - px[:, 2].mean())


def foot_anchor(al):
    """centre of the alpha foot span over the cell's bottom 20 occupied rows."""
    ys, xs = np.nonzero(al > THR)
    if not len(ys):
        return None, None
    y1 = int(ys.max()) + 1
    band = al[max(0, y1 - 20):y1]
    bxs = np.nonzero((band > THR).any(axis=0))[0]
    return float((bxs.min() + bxs.max()) / 2.0), y1


def despeckle(rgba, min_area=150):
    """zero the alpha of connected components smaller than min_area px."""
    al = rgba[..., 3]
    on = al > THR
    h, w = on.shape
    seen = np.zeros((h, w), bool)
    ys, xs = np.nonzero(on)
    for sy, sx in zip(ys, xs):
        if seen[sy, sx]:
            continue
        comp = [(sy, sx)]
        seen[sy, sx] = True
        stack = [(sy, sx)]
        while stack:
            y, x = stack.pop()
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and on[ny, nx] \
                        and not seen[ny, nx]:
                    seen[ny, nx] = True
                    comp.append((ny, nx))
                    stack.append((ny, nx))
        if len(comp) < min_area:
            for y, x in comp:
                rgba[y, x, 3] = 0
    return rgba


def man_band(al):
    """column range of the seated MAN: columns whose alpha top is within 12%
    of the figure top (the head), widened by 5% of the cell width -- the oar
    handle and blade enter lower and never join this band."""
    ys, xs = np.nonzero(al > THR)
    top, h = ys.min(), ys.max() - ys.min() + 1
    heads = [x for x in np.unique(xs) if ys[xs == x].min() < top + 0.12 * h]
    pad = int(0.05 * al.shape[1])
    return max(0, min(heads) - pad), min(al.shape[1], max(heads) + pad)


def seated_measures(cell):
    """(man_height, foot_anchor_x, foot_baseline_y) in the man's own band."""
    al = cell[..., 3]
    x0, x1 = man_band(al)
    sub = al[:, x0:x1]
    ys, xs = np.nonzero(sub > THR)
    man_h = int(ys.max() - ys.min() + 1)
    y1 = int(ys.max()) + 1
    band = sub[max(0, y1 - 20):y1]
    bxs = np.nonzero((band > THR).any(axis=0))[0]
    return man_h, float(x0 + (bxs.min() + bxs.max()) / 2.0), y1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet')
    ap.add_argument('out')
    ap.add_argument('--ref-warmcool', type=float, required=True)
    ap.add_argument('--pad', type=int, default=8)
    ap.add_argument('--n', type=int, default=4)
    ap.add_argument('--mode', choices=['standing', 'seated'],
                    default='standing')
    a = ap.parse_args()

    sheet = Image.open(a.sheet).convert('RGB')
    W, H = sheet.size
    cw = W // a.n

    # 1. equal quarters -> matte each cell off its own navy
    cells = []
    for i in range(a.n):
        q = sheet.crop((i * cw, 0, (i + 1) * cw, H))
        img, bg, t, ceil = key_navy_from_image(q)
        cells.append(despeckle(np.asarray(img).copy()))

    # 2. union alpha box in cell-local coords (equal-cell trim)
    boxes = []
    for c in cells:
        ys, xs = np.nonzero(c[..., 3] > THR)
        if not len(ys):
            print(json.dumps({'ok': False, 'error': 'empty cell'}))
            sys.exit(1)
        boxes.append((int(xs.min()), int(ys.min()),
                      int(xs.max()) + 1, int(ys.max()) + 1))
    x0 = max(0, min(b[0] for b in boxes) - a.pad)
    y0 = max(0, min(b[1] for b in boxes) - a.pad)
    x1 = min(cw, max(b[2] for b in boxes) + a.pad)
    y1 = min(H, max(b[3] for b in boxes) + a.pad)
    cells = [c[y0:y1, x0:x1] for c in cells]
    ch, cwid = cells[0].shape[:2]

    # 3. gates
    ident = [head_warmcool(c) for c in cells]
    dident = [round(v - a.ref_warmcool, 1) for v in ident]
    anchors, baselines = [], []
    if a.mode == 'seated':
        heights = []
        for c in cells:
            mh, ax, by = seated_measures(c)
            heights.append(mh)
            anchors.append(round(ax, 1))
            baselines.append(by)
    else:
        heights = [int(b[3] - b[1]) for b in boxes]
        for c in cells:
            ax, by = foot_anchor(c[..., 3])
            anchors.append(round(ax, 1))
            baselines.append(by)
    hmean = sum(heights) / len(heights)
    drift = (max(heights) - min(heights)) / hmean * 100.0
    diffs = []
    for i in range(len(cells) - 1):
        p, q = cells[i], cells[i + 1]
        # register q onto p's foot anchor/baseline (integer shift; the paint
        # path does exactly this, so this is the diff the reader sees).
        # Seated: no shift -- the bench is static and the union-crop frame
        # already registers the cells; anchor-shifting by the feet would
        # smear the oar's real motion across the bench.
        if a.mode == 'standing':
            dx = int(round(anchors[i] - anchors[i + 1]))
            dy = int(baselines[i] - baselines[i + 1])
            q = np.roll(np.roll(q, dy, axis=0), dx, axis=1)
        pm, qm = p[..., 3] > THR, q[..., 3] > THR
        on = pm | qm
        diffs.append(float((pm != qm).sum()) / max(1, int(on.sum())) * 100.0)

    ok_a = all(abs(v) <= 20 for v in dident)
    ok_b = drift <= 8.0
    ok_c = all(v is not None for v in anchors)
    ok_d = all(2.0 <= v <= 60.0 for v in diffs)

    # 4. pack the strip
    strip = np.concatenate(cells, axis=1)
    Image.fromarray(strip).save(a.out)

    print(json.dumps({
        'ok': bool(ok_a and ok_b and ok_c and ok_d),
        'out': a.out, 'cell': [int(cwid), int(ch)], 'n': a.n,
        'srcH': round(sum(baselines) / len(baselines), 1),
        'anchors': anchors,
        'gates': {
            'identity_warmcool': [round(v, 1) for v in ident],
            'identity_delta': dident, 'identity_ok': ok_a,
            'bbox_heights': heights,
            'scale_drift_pct': round(drift, 2), 'scale_ok': ok_b,
            'anchors_ok': ok_c,
            'frame_diff_pct': [round(v, 1) for v in diffs],
            'action_ok': ok_d,
        },
    }))


def key_navy_from_image(img):
    """key_navy takes a path; route a PIL image through it via a temp file."""
    import os
    import tempfile
    fd, p = tempfile.mkstemp(suffix='.png')
    os.close(fd)
    try:
        img.save(p)
        # key_navy returns the UNCROPPED rgba (cropping is main()'s job there)
        return key_navy(p)
    finally:
        os.unlink(p)


if __name__ == '__main__':
    main()
