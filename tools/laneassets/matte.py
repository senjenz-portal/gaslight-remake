#!/usr/bin/env python3
"""matte.py -- key a painted actor off its flat backing colour into clean RGBA.

The generator returns the figure on a flat magenta field (delivered as JPEG, so
the field is NOT a single exact value -- it is a cloud around #FF00FF with codec
ringing along every edge). So:

  1. sample the true backing colour from the border ring, not from a constant;
  2. alpha from a soft distance band, so the ring becomes a real soft edge
     rather than a staircase;
  3. DESPILL: magenta spill shows up as R and B lifted above G. Pull the excess
     down inside the semi-transparent rim, or the cutout keeps a pink halo the
     moment it sits on the navy plate;
  4. trim to the figure and report the foot baseline, because everything
     downstream anchors the actor by its feet on the plate's floor line.

    python3 matte.py IN OUT [--strip N] [--json OUT.json] [--pad 6]
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageFilter


def backing_colour(a):
    """median of the 12px border ring -- robust to a figure touching an edge"""
    h, w = a.shape[:2]
    r = 12
    ring = np.concatenate([a[:r].reshape(-1, 3), a[-r:].reshape(-1, 3),
                           a[:, :r].reshape(-1, 3), a[:, -r:].reshape(-1, 3)])
    return np.median(ring, axis=0)


def alpha_from(a, bg, lo, hi):
    d = np.sqrt(((a - bg) ** 2).sum(axis=2))
    return np.clip((d - lo) / max(1e-6, (hi - lo)), 0, 1)


def despill(rgb, alpha):
    """magenta spill = R and B above G. Clamp the excess where alpha is soft."""
    out = rgb.copy()
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    m = (r + b) * 0.5
    over = np.maximum(0.0, m - g)
    # strongest correction on the rim (alpha between 0 and 1), light inside
    k = (1.0 - np.abs(alpha * 2 - 1)) * 0.9 + 0.10
    out[..., 0] = r - over * k
    out[..., 2] = b - over * k
    return np.clip(out, 0, 255)


def clamp_spill(rgb, ceiling=20.0):
    """Force (R+B)/2 - G below `ceiling` everywhere, by pulling R and B down."""
    out = rgb.copy()
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    excess = np.maximum(0.0, (r + b) * 0.5 - g - ceiling)
    out[..., 0] = r - excess
    out[..., 2] = b - excess
    return np.clip(out, 0, 255)


def key(path, lo=60.0, hi=125.0, shrink=1.0):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    bg = backing_colour(a)
    al = alpha_from(a, bg, lo, hi)
    # close pinholes inside the figure, then feather
    ai = Image.fromarray((al * 255).astype(np.uint8))
    ai = ai.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    if shrink:
        # Erode 2px, not 1. A 1px bite leaves a ring of pixels that are far
        # enough from the backing colour to key as fully opaque but are still
        # magenta-tinted -- invisible on magenta, a pink outline on the navy
        # plate. At the 0.25x the actor ships at, 2px costs nothing visible.
        ai = ai.filter(ImageFilter.MinFilter(5))
    ai = ai.filter(ImageFilter.GaussianBlur(0.7))
    al = np.asarray(ai).astype(np.float32) / 255.0
    # despill the whole silhouette, hardest on the outer band
    rim = np.asarray(Image.fromarray((al * 255).astype(np.uint8))
                     .filter(ImageFilter.MinFilter(9))).astype(np.float32) / 255.0
    edge = np.clip(al - rim, 0, 1)
    rgb = despill(a, np.maximum(al * 0.5, 0.5 - edge * 0.5))
    # Hard ceiling on magenta excess. The JPEG ring reaches further into the
    # figure than any sane erosion, and those pixels key as fully opaque, so a
    # band alone cannot catch them. The costume's own palette never exceeds
    # ~20 of (R+B)/2 - G (blue cloak in shadow is the worst case), while ring
    # pixels run 60-105 -- so clamping the excess is safe and total.
    rgb = clamp_spill(rgb, ceiling=20.0)
    out = np.dstack([rgb, al * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA'), bg


def bbox_of(img, thr=24):
    al = np.asarray(img)[..., 3]
    ys, xs = np.nonzero(al > thr)
    if not len(xs):
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def columns(img, n, thr=24):
    """split a strip into n figures by finding gaps in the alpha column profile"""
    al = np.asarray(img)[..., 3]
    prof = (al > thr).sum(axis=0)
    on = prof > max(2, prof.max() * 0.02)
    runs, s = [], None
    for i, v in enumerate(on):
        if v and s is None:
            s = i
        elif not v and s is not None:
            runs.append((s, i)); s = None
    if s is not None:
        runs.append((s, len(on)))
    runs = [r for r in runs if r[1] - r[0] > al.shape[1] // (n * 8)]
    runs.sort(key=lambda r: r[0] - r[1])          # widest first
    runs = sorted(runs[:n], key=lambda r: r[0])
    return runs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inp')
    ap.add_argument('out')
    ap.add_argument('--strip', type=int, default=0, help='N frames -> uniform sheet')
    ap.add_argument('--json', default='')
    ap.add_argument('--pad', type=int, default=6)
    a = ap.parse_args()

    img, bg = key(a.inp)
    meta = {'source': os.path.abspath(a.inp), 'backing_rgb': [round(float(v), 1) for v in bg]}

    if a.strip:
        runs = columns(img, a.strip)
        meta['frames_found'] = len(runs)
        arr = np.asarray(img)
        boxes = []
        for x0, x1 in runs:
            sub = arr[:, x0:x1, 3]
            ys = np.nonzero((sub > 24).any(axis=1))[0]
            boxes.append((x0, int(ys.min()), x1, int(ys.max()) + 1))
        # uniform cell: widest + tallest, feet aligned on a common baseline
        cw = max(b[2] - b[0] for b in boxes) + a.pad * 2
        ch = max(b[3] - b[1] for b in boxes) + a.pad * 2
        sheet = Image.new('RGBA', (cw * len(boxes), ch), (0, 0, 0, 0))
        for i, (x0, y0, x1, y1) in enumerate(boxes):
            fig = img.crop((x0, y0, x1, y1))
            dx = i * cw + (cw - fig.width) // 2
            dy = ch - a.pad - fig.height            # BASELINE-ALIGNED, not centred
            sheet.paste(fig, (dx, dy))
        sheet.save(a.out)
        meta.update({'cell_w': cw, 'cell_h': ch, 'frames': len(boxes),
                     'sheet': list(sheet.size), 'baseline_y': ch - a.pad,
                     'src_boxes': [list(map(int, b)) for b in boxes]})
    else:
        bb = bbox_of(img)
        x0, y0, x1, y1 = bb
        x0 = max(0, x0 - a.pad); y0 = max(0, y0 - a.pad)
        x1 = min(img.width, x1 + a.pad); y1 = min(img.height, y1 + a.pad)
        cut = img.crop((x0, y0, x1, y1))
        cut.save(a.out)
        meta.update({'size': list(cut.size), 'src_bbox': [x0, y0, x1, y1],
                     'baseline_y': cut.height - a.pad})

    meta['out'] = os.path.abspath(a.out)
    print(json.dumps(meta))
    if a.json:
        with open(a.json, 'w') as f:
            json.dump(meta, f, indent=1)


if __name__ == '__main__':
    main()
