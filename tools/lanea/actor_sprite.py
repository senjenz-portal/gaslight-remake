#!/usr/bin/env python3
"""actor_sprite.py -- key a generated walk strip into a usable 4-frame sprite.

The image model returns a wide JPEG of four painted figures on flat green. It
does NOT return four frames that share a height, a centre or a palette, so this
does the unglamorous half:

  1. key the green (chroma distance + despill),
  2. split on the empty columns between figures,
  3. normalise: one common height, feet on one baseline, torso centred,
  4. pull the palette back towards the idle cutout's own mean/std, because
     i2i drifts warm and the actor has to match the plate he walks on,
  5. emit ONE strip of equal cells + a manifest with the cell geometry and the
     per-frame residuals, so the drift is on the record rather than hidden.

stdlib + numpy + PIL. Deterministic. No network.
"""
import argparse
import hashlib
import json
import os
import time

import numpy as np
from PIL import Image, ImageFilter

KEY = np.array([0.0, 177.0, 64.0])


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def key_green(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    greenish = (g - np.maximum(r, b))
    a = np.clip((30.0 - greenish) / 26.0, 0, 1)          # soft chroma key
    dist = np.sqrt(((rgb - KEY) ** 2).sum(-1))
    a = np.minimum(a, np.clip((dist - 55.0) / 45.0, 0, 1))
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8))
                   .filter(ImageFilter.GaussianBlur(0.6)), np.float32) / 255.0
    # despill: green above the mean of the other two is spill, not paint
    out = rgb.copy()
    cap = (out[..., 0] + out[..., 2]) * 0.5 + 12.0
    out[..., 1] = np.minimum(out[..., 1], cap)
    return out, a


def columns(a, thresh=0.35, min_run=6):
    col = (a > thresh).sum(0)
    on = col > 2
    runs, s = [], None
    for i, v in enumerate(on):
        if v and s is None:
            s = i
        elif not v and s is not None:
            if i - s >= min_run:
                runs.append((s, i))
            s = None
    if s is not None and len(on) - s >= min_run:
        runs.append((s, len(on)))
    return runs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--strip', required=True)
    ap.add_argument('--ref', required=True, help='idle cutout, the palette + height truth')
    ap.add_argument('--out', required=True, help='ship path for walk.png')
    ap.add_argument('--manifest', required=True)
    ap.add_argument('--frames', type=int, default=4)
    ap.add_argument('--palette-pull', type=float, default=0.65)
    a = ap.parse_args()

    rgb = np.asarray(Image.open(a.strip).convert('RGB'), np.float32)
    rgb, alpha = key_green(rgb)
    runs = columns(alpha)
    # merge stray slivers into their nearest neighbour until we have N frames
    while len(runs) > a.frames:
        widths = [(r[1] - r[0], i) for i, r in enumerate(runs)]
        widths.sort()
        i = widths[0][1]
        if i == 0:
            runs[1] = (runs[0][0], runs[1][1]); runs.pop(0)
        elif i == len(runs) - 1:
            runs[-2] = (runs[-2][0], runs[-1][1]); runs.pop()
        else:
            left = runs[i][0] - runs[i - 1][1]
            right = runs[i + 1][0] - runs[i][1]
            j = i - 1 if left <= right else i + 1
            lo, hi = min(i, j), max(i, j)
            runs[lo] = (runs[lo][0], runs[hi][1]); runs.pop(hi)
    if len(runs) != a.frames:
        raise SystemExit('found %d figure columns, wanted %d' % (len(runs), a.frames))

    ref = Image.open(a.ref)
    ra = np.asarray(ref, np.float32)
    rmask = ra[..., 3] > 128
    ref_mu = ra[..., :3][rmask].mean(0)
    ref_sd = ra[..., :3][rmask].std(0)
    target_h = ref.height

    cut = []
    for (c0, c1) in runs:
        sub_a = alpha[:, c0:c1]
        ys = np.where((sub_a > 0.35).sum(1) > 1)[0]
        r0, r1 = int(ys.min()), int(ys.max()) + 1
        xs = np.where((sub_a > 0.35).sum(0) > 1)[0]
        k0, k1 = c0 + int(xs.min()), c0 + int(xs.max()) + 1
        cut.append((k0, k1, r0, r1))

    heights = [c[3] - c[2] for c in cut]
    med_h = float(np.median(heights))
    scale = target_h / med_h

    cells, resid = [], []
    for (k0, k1, r0, r1) in cut:
        h = r1 - r0
        s = scale * (med_h / h)                       # every frame to one height
        w = int(round((k1 - k0) * s))
        hh = int(round(h * s))
        im = np.zeros((r1 - r0, k1 - k0, 4), np.uint8)
        im[..., :3] = np.clip(rgb[r0:r1, k0:k1], 0, 255).astype(np.uint8)
        im[..., 3] = np.clip(alpha[r0:r1, k0:k1] * 255, 0, 255).astype(np.uint8)
        pil = Image.fromarray(im).resize((max(1, w), max(1, hh)), Image.LANCZOS)
        arr = np.asarray(pil, np.float32).copy()
        m = arr[..., 3] > 128
        if m.sum() > 50:
            mu, sd = arr[..., :3][m].mean(0), arr[..., :3][m].std(0)
            k = a.palette_pull
            for c in range(3):
                corr = (arr[..., c] - mu[c]) * (ref_sd[c] / max(sd[c], 1e-3)) + ref_mu[c]
                arr[..., c] = arr[..., c] * (1 - k) + corr * k
            resid.append([round(float(v), 1) for v in (mu - ref_mu)])
        cells.append(np.clip(arr, 0, 255).astype(np.uint8))

    # torso centre (top 55% of the figure) is the stable horizontal anchor;
    # the lowest opaque row is the ground contact and goes on the baseline
    anchors = []
    for c in cells:
        al = c[..., 3] > 128
        top = al[:int(al.shape[0] * 0.55)]
        xs = np.where(top.any(0))[0]
        anchors.append(0.5 * (xs.min() + xs.max()))

    cw = int(max(c.shape[1] for c in cells) + 2 * max(
        abs(an - c.shape[1] / 2) for an, c in zip(anchors, cells)) + 8)
    chh = int(max(c.shape[0] for c in cells) + 4)
    strip = np.zeros((chh, cw * len(cells), 4), np.uint8)
    for i, (c, an) in enumerate(zip(cells, anchors)):
        ox = int(round(i * cw + cw / 2 - an))
        oy = chh - 2 - c.shape[0]
        strip[oy:oy + c.shape[0], ox:ox + c.shape[1]] = c

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    Image.fromarray(strip).save(a.out, optimize=True)

    foot = chh - 2
    man = {
        'lane': 'lanea-actors', 'stage': 'sprite',
        'created': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'generator': 'tools/lanea/actor_sprite.py',
        'source': {'strip': os.path.abspath(a.strip), 'sha256': sha(a.strip)},
        'reference': {'cutout': os.path.abspath(a.ref), 'sha256': sha(a.ref),
                      'height': target_h},
        'frames': len(cells), 'cell': [cw, chh],
        'footBaselineY': foot,
        'rawFrameHeightsPx': heights,
        'heightSpreadPctBeforeNormalise': round(
            100.0 * (max(heights) - min(heights)) / med_h, 1),
        'paletteResidualRgbBeforePull': resid,
        'palettePull': a.palette_pull,
        'file': {'path': os.path.abspath(a.out),
                 'bytes': os.path.getsize(a.out), 'sha256': sha(a.out)},
    }
    old = {'lane': 'lanea-actors', 'entries': []}
    if os.path.exists(a.manifest):
        old = json.load(open(a.manifest))
    old.setdefault('entries', []).append(man)
    json.dump(old, open(a.manifest, 'w'), indent=1)
    print(json.dumps({'ok': True, 'frames': len(cells), 'cell': [cw, chh],
                      'foot': foot, 'heights': heights,
                      'spreadPct': man['heightSpreadPctBeforeNormalise'],
                      'out': a.out}))


if __name__ == '__main__':
    main()
