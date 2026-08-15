#!/usr/bin/env python3
"""strip_slice.py -- slice a 4-up generated sheet into a shippable strip, gated.

PER-SHEET LAWS (PIPELINE-LIVING.md 3.3 + the sherlock anchor law):
  - matte off the flat #1a2038 backing (matte_navy.key_navy -- the odyssey
    keyer; the magenta-era thresholds hole dark hair on navy);
  - SLICE deterministically: equal quarters of the sheet, THEN alpha-trim per
    cell (never a gap-finder -- a swung crook that touches its neighbour must
    fail loudly at the boundary, not merge two frames);
  - repack UNIFORM cells, baseline-aligned at the bottom (matte.py --strip
    precedent: feet on one line, centred horizontally, pad all round);
  - GATE numerically, per cell:
      (a) identity  -- darkest-head-pixel cluster warm/cool (R-B) within +/-20
                       of the canonical's (the bride lesson: a number decides);
      (b) scale     -- trimmed bbox heights within +/-8% of each other;
      (c) anchors   -- centre of the FOOT SPAN in each cell's bottom 20 rows,
                       measured per frame off the cell's own alpha (King law);
      (d) action    -- frame-to-frame changed fraction over the alpha union
                       neither ~0 (static, <3%) nor chaotic (>60%).

    python3 strip_slice.py GEN.png CANON_CUT.png OUT-strip.png \
        --head top|front [--pad 6] [--json OUT.json]
Prints one-line JSON: cell, srcH, anchors, per-gate numbers, verdict.
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from matte_navy import key_navy  # noqa: E402

THR = 24            # alpha threshold for bbox/anchor work (matte.py precedent)
FOOT_ROWS = 20      # the anchor law: bottom 20 rows of the cell
IDENT_TOL = 20.0    # +/- warm/cool tolerance vs canonical
SCALE_TOL = 0.08    # +/- 8% bbox-height drift
DIFF_LO, DIFF_HI = 0.03, 0.60


def largest_component(mask):
    """largest 4-connected component of a boolean mask (numpy-only flood)."""
    h, w = mask.shape
    seen = np.zeros((h, w), bool)
    best = None
    ys, xs = np.nonzero(mask)
    for sy, sx in zip(ys, xs):
        if seen[sy, sx]:
            continue
        comp = [(sy, sx)]
        seen[sy, sx] = True
        stack = [(sy, sx)]
        while stack:
            y, x = stack.pop()
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] \
                        and not seen[ny, nx]:
                    seen[ny, nx] = True
                    comp.append((ny, nx))
                    stack.append((ny, nx))
        if best is None or len(comp) > len(best):
            best = comp
    keep = np.zeros((h, w), bool)
    if best:
        cy = np.array([c[0] for c in best])
        cx = np.array([c[1] for c in best])
        keep[cy, cx] = True
    return keep


def head_region(alpha, mode):
    """bbox-relative head window: 'top' = crown fifth of a biped;
    'front' = leading (left) third x upper half of a left-facing quadruped."""
    ys, xs = np.nonzero(alpha > 200)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    if mode == 'top':
        return (y0, y0 + int((y1 - y0) * 0.22), x0, x1)
    return (y0, y0 + int((y1 - y0) * 0.50), x0, x0 + int((x1 - x0) * 0.34))


def head_warmcool(rgba, mode):
    """mean R-B of the darkest 3% of opaque pixels inside the head window."""
    a = rgba[..., 3].astype(np.float32)
    ry0, ry1, rx0, rx1 = head_region(a, mode)
    reg = rgba[ry0:ry1, rx0:rx1]
    op = reg[..., 3] > 200
    px = reg[op].astype(np.float32)
    lum = px[:, :3].mean(axis=1)
    k = max(50, int(len(px) * 0.03))
    dark = px[np.argsort(lum)[:k]]
    return float(dark[:, 0].mean() - dark[:, 2].mean())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('gen')
    ap.add_argument('canon_cut')
    ap.add_argument('out')
    ap.add_argument('--head', choices=['top', 'front'], required=True)
    ap.add_argument('--pad', type=int, default=6)
    ap.add_argument('--n', type=int, default=4)
    ap.add_argument('--mirror', action='store_true',
                    help='flip each cell horizontally (sheet was authored '
                         'facing the model\'s preferred direction; the set '
                         'needs the other) -- frame ORDER is kept')
    ap.add_argument('--json', default='')
    a = ap.parse_args()

    keyed, bg, t, ceil = key_navy(a.gen)
    arr = np.asarray(keyed)
    H, W = arr.shape[:2]
    qw = W // a.n

    # deterministic equal quarters -> alpha-trim per cell.
    # A CELL HOLDS ONE FIGURE: a neighbour's nose sliced off at the quarter
    # boundary arrives as a small disconnected alpha island -- keep only the
    # largest connected component per quarter and report what was dropped.
    cells, boxes, edge_touch, dropped_px = [], [], [], []
    for i in range(a.n):
        q = arr[:, i * qw:(i + 1) * qw].copy()
        al = q[..., 3]
        keep = largest_component(al > THR)
        stray = (al > THR) & ~keep
        dropped_px.append(int(stray.sum()))
        if stray.any():
            # clear soft skirt around strays too: anything outside a 2px halo
            # of the kept component that has any alpha
            from PIL import ImageFilter as _IF
            halo = np.asarray(Image.fromarray(
                (keep * 255).astype(np.uint8)).filter(_IF.MaxFilter(5))) > 0
            q[..., 3] = np.where(halo, al, 0)
        ys, xs = np.nonzero(q[..., 3] > THR)
        x0, x1 = int(xs.min()), int(xs.max()) + 1
        y0, y1 = int(ys.min()), int(ys.max()) + 1
        boxes.append((x0, y0, x1, y1))
        edge_touch.append(bool(x0 == 0 or x1 == qw))
        cell = q[y0:y1, x0:x1]
        if a.mirror:
            cell = cell[:, ::-1]
        cells.append(cell)

    # uniform cell, baseline-aligned (feet on one line), centred horizontally
    cw = max(c.shape[1] for c in cells) + a.pad * 2
    ch = max(c.shape[0] for c in cells) + a.pad * 2
    strip = np.zeros((ch, cw * a.n, 4), np.uint8)
    for i, c in enumerate(cells):
        h, w = c.shape[:2]
        dx = i * cw + (cw - w) // 2
        dy = ch - a.pad - h
        strip[dy:dy + h, dx:dx + w] = c
    Image.fromarray(strip, 'RGBA').save(a.out)

    # ---- gates -------------------------------------------------------------
    canon = np.asarray(Image.open(a.canon_cut).convert('RGBA'))
    wc_canon = head_warmcool(canon, a.head)
    wc = [head_warmcool(strip[:, i * cw:(i + 1) * cw], a.head)
          for i in range(a.n)]
    ident_d = [round(v - wc_canon, 1) for v in wc]
    ident_ok = all(abs(d) <= IDENT_TOL for d in ident_d)

    hs = [b[3] - b[1] for b in boxes]
    scale_drift = round((max(hs) - min(hs)) / min(hs), 4)
    scale_ok = scale_drift <= SCALE_TOL

    anchors, foot_rows_used = [], []
    for i in range(a.n):
        cell = strip[:, i * cw:(i + 1) * cw]
        band = cell[ch - FOOT_ROWS:, :, 3]
        xs = np.nonzero((band > THR).any(axis=0))[0]
        anchors.append(round((float(xs.min()) + float(xs.max()) + 1) / 2, 1))
        foot_rows_used.append(int((band > THR).any(axis=1).sum()))

    # anchor-aligned diff: the paint law sets left = x - anchors[frame]*ws,
    # so consecutive frames meet the reader aligned ON THEIR FEET -- measuring
    # the change in any other frame of reference counts packing offset as
    # motion. Shift the second cell by the integer anchor delta first.
    diffs = []
    for i in range(a.n):
        j = (i + 1) % a.n
        p = strip[:, i * cw:(i + 1) * cw]
        q = strip[:, j * cw:(j + 1) * cw]
        sh = int(round(anchors[i] - anchors[j]))
        q = np.roll(q, sh, axis=1)
        if sh > 0:
            q[:, :sh] = 0
        elif sh < 0:
            q[:, sh:] = 0
        union = (p[..., 3] > THR) | (q[..., 3] > THR)
        drgb = np.abs(p[..., :3].astype(np.int16)
                      - q[..., :3].astype(np.int16)).max(axis=2)
        dal = np.abs(p[..., 3].astype(np.int16) - q[..., 3].astype(np.int16))
        changed = ((drgb > 30) | (dal > 60)) & union
        diffs.append(round(float(changed.sum()) / max(1, union.sum()), 4))
    action_ok = all(DIFF_LO < d <= DIFF_HI for d in diffs)

    src_h = ch - a.pad          # baseline-aligned: the foot line, exactly
    report = {
        'out': os.path.abspath(a.out), 'sheet': [W, H],
        'backing_rgb': [round(float(v), 1) for v in bg], 'threshold': t,
        'cell': [cw, ch], 'n': a.n, 'srcH': src_h,
        'anchors': anchors, 'foot_rows_with_alpha': foot_rows_used,
        'trim_boxes': [list(map(int, b)) for b in boxes],
        'cell_edge_touch': edge_touch, 'stray_alpha_dropped_px': dropped_px,
        'gates': {
            'identity': {'canon_warmcool': round(wc_canon, 1),
                         'cell_warmcool': [round(v, 1) for v in wc],
                         'delta': ident_d, 'tol': IDENT_TOL, 'ok': ident_ok},
            'scale': {'bbox_heights': hs, 'drift': scale_drift,
                      'tol': SCALE_TOL, 'ok': scale_ok},
            'action': {'pair_diffs_0123_wrap': diffs,
                       'lo': DIFF_LO, 'hi': DIFF_HI, 'ok': action_ok},
        },
        'verdict': 'PASS' if (ident_ok and scale_ok and action_ok) else 'FAIL',
    }
    print(json.dumps(report))
    if a.json:
        with open(a.json, 'w') as f:
            json.dump(report, f, indent=1)


if __name__ == '__main__':
    main()
