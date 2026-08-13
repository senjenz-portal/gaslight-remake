#!/usr/bin/env python3
"""conform_photo.py -- centre the sitter inside the cabinet card, analytically.

WHY THIS IS NOT A MODEL PASS. Asking the image model to slide her to the middle
worked (photo-irene-d) but it re-lit the whole card on the way: the studio ground
went from lum 39.8 -- both-photo's own value, which photo-irene-c holds to within
2 levels -- to 108.8. The fee plate has to be THE SAME OBJECT as `both-photo`
(same card, same frame, same sepia, her same face), so a re-grade of the ground
is a failure, not a style choice.

The move needs no model:

  1. find the dark card inside the cream ornate frame (scan outward from the
     middle -- there is more dark card OUTSIDE the frame, so scanning inward
     from the image edge finds the wrong line);
  2. find the sitter (she is the only bright thing in the card; the search is
     kept out of the corners because the frame's corner brackets reach in);
  3. rebuild the ground she stands on by interpolating each row ACROSS her band
     -- the studio ground is smooth and vignetted, so a per-row ramp between the
     clean columns either side of her reproduces it, and a plain horizontal roll
     of the whole card does NOT (it would carry a dark vignetted corner into the
     middle of the card);
  4. lift her off that ground as a soft matte, and composite her back at the
     card's centre.

The report measures what changed outside her two footprints, so "nothing else
moved" is a number rather than a claim.

    python3 conform_photo.py IN OUT [--json REPORT]
"""
import argparse
import json

import numpy as np
from PIL import Image, ImageFilter


def interior(a, bright=110.0, y_probe=90, x_probe=250, inset=8):
    """The dark card INSIDE the cream ornate frame; scan outward from the middle."""
    g = a.mean(-1)
    h, w = g.shape
    cx, cy = w // 2, h // 2

    def out(vals, start, step):
        i = start
        while 0 <= i < len(vals):
            if vals[i] > bright:
                return i
            i += step
        return max(0, min(len(vals) - 1, i))
    row, col = g[y_probe], g[:, x_probe]
    return (out(row, cx, -1) + 1 + inset, out(col, cy, -1) + 1 + inset,
            out(row, cx, +1) - inset, out(col, cy, +1) - inset)


def sitter_band(a, box, guard=110, thr=100.0, margin=42):
    """Her x band. Searched inside a guard inset because the frame's corner
    brackets are as bright as her gown and reach a long way into the card."""
    x0, y0, x1, y1 = box
    g = a.mean(-1)[y0 + guard:y1 - guard, x0 + guard:x1 - guard]
    cols = np.nonzero((g > thr).sum(0) > 3)[0]
    if not len(cols):
        raise SystemExit('no sitter found')
    xa = int(cols.min()) + x0 + guard - margin
    xb = int(cols.max()) + x0 + guard + margin
    return max(x0, xa), min(x1, xb)


def ground_fill(a, box, xa, xb, ref=26):
    """Rebuild the ground across [xa,xb) by a per-row ramp between the clean
    columns either side. The ground's only structure is a smooth vignette plus a
    horizontal horizon, and both survive a horizontal ramp exactly."""
    x0, y0, x1, y1 = box
    out = a.copy()
    left = a[y0:y1, max(x0, xa - ref):xa].mean(axis=1)          # (rows,3)
    right = a[y0:y1, xb:min(x1, xb + ref)].mean(axis=1)
    t = np.linspace(0.0, 1.0, xb - xa)[None, :, None]
    out[y0:y1, xa:xb] = left[:, None, :] * (1 - t) + right[:, None, :] * t
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inp')
    ap.add_argument('out')
    ap.add_argument('--json', default='')
    ap.add_argument('--lo', type=float, default=5.0)
    ap.add_argument('--hi', type=float, default=16.0)
    a = ap.parse_args()

    im = Image.open(a.inp).convert('RGB')
    arr = np.asarray(im).astype(np.float32)
    box = interior(arr)
    x0, y0, x1, y1 = box
    xa, xb = sitter_band(arr, box)

    ground = ground_fill(arr, box, xa, xb)
    d = np.abs(arr - ground).mean(-1)
    alpha = np.clip((d - a.lo) / (a.hi - a.lo), 0, 1)
    alpha[:y0] = alpha[y1:] = 0
    alpha[:, :xa] = 0
    alpha[:, xb:] = 0
    alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8))
                       .filter(ImageFilter.MaxFilter(3))
                       .filter(ImageFilter.GaussianBlur(0.8)), np.float32) / 255.0

    ys, xs = np.nonzero(alpha > 0.5)
    sb = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    dx = int(round((x0 + x1) / 2.0 - (sb[0] + sb[2]) / 2.0))

    her = arr * alpha[..., None]
    res = ground.copy()
    al = np.roll(alpha, dx, axis=1)[..., None]
    res = res * (1 - al) + np.roll(her, dx, axis=1)
    res = np.clip(res, 0, 255).astype(np.uint8)
    Image.fromarray(res).save(a.out)

    # what moved, and what did not: everything outside her two footprints
    touched = np.zeros(arr.shape[:2], bool)
    touched[:, max(x0, min(xa, xa + dx)):min(x1, max(xb, xb + dx))] = True
    outside = (np.abs(res.astype(np.float32) - arr).mean(-1) > 3) & ~touched
    rep = {
        'in': a.inp, 'out': a.out, 'interior': list(box),
        'sitter_band_x': [xa, xb], 'sitter_bbox': list(sb),
        'card_centre_x': round((x0 + x1) / 2.0, 1),
        'sitter_centre_x': round((sb[0] + sb[2]) / 2.0, 1),
        'dx': dx,
        'changed_px_outside_footprints': int(outside.sum()),
        'ground_lum_before': round(float(arr[y0:y1, x0:x0 + 200].mean()), 1),
        'ground_lum_after': round(float(res[y0:y1, x0:x0 + 200].mean()), 1),
    }
    rep['verdict'] = ('OK - only the sitter moved' if rep['changed_px_outside_footprints'] == 0
                      else 'LEAK - pixels changed outside the sitter footprints')
    print(json.dumps(rep, indent=1))
    if a.json:
        with open(a.json, 'w') as f:
            json.dump(rep, f, indent=1)


if __name__ == '__main__':
    main()
