#!/usr/bin/env python3
"""nortonmatte.py — F3: Norton's cut, matted and pulled into the scene.

The review's note on 03-01-hansom: "Norton sprite slightly bright vs scene +
faint cut halo". Both halves are measurable in the shipped art, and both are the
same cause — the cut was keyed off a lighter background, so:

    core (alpha >= 250)   luma mean 45.6, p95 130.4, max 254, sat 0.483
    edge (16 < alpha)     luma mean 67.0, p95 145.5,          sat 0.578

The EDGE is 47% brighter than the body it belongs to. Composited over a night
street that is a bright reddish outline around a dark man — the halo. And his
highlights run 20% hotter than the other actor on the same set
(irene-chase.png p95 108.6) on a plate whose own mean luma is 41.9.

TWO PASSES, both deterministic, no generation:

  1. MATTE — colour bleed. Every partially transparent pixel takes the colour of
     the nearest fully opaque pixel (iterative dilation of the core's RGB into
     the edge), so the fringe carries the FIGURE's colour instead of the old
     background's. Alpha is untouched, so his silhouette, his width and his foot
     baseline do not move by one pixel.
  2. PALETTE PULL — his highlights are compressed toward the set's range with a
     soft knee above KNEE, and saturation is pulled by SAT_PULL. A knee, not a
     gain, because a flat multiply would take his shadows below the plate's black.

Gates (all measured, printed, and enforced):
    halo          local luma excess around the cut    <= 2.0   (was +3.09)
    core p95      <= 118                                     (was 130.4)
    hot pixels    luma > 200 inside the core: 0              (was N)
    silhouette    alpha unchanged, exactly

Usage:  python3 tools/living/nortonmatte.py [--install]
"""
import argparse
import hashlib
import json
import os

from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSETS = os.path.join(ROOT, 'site-deploy', 'living', 'assets')
RAW = os.path.join(ROOT, 'assets', 'raw', 'nortonmatte')

TARGET = 'actor/norton-chase.png'
KNEE = 96.0            # above this luma the highlights are compressed
KNEE_CEIL = 118.0      # and they land under here
SAT_PULL = 0.90
HALO_MAX = 2.0         # luma of local excess around the cut
P95_MAX = 118.0
HOT = 200.0


def luma(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


NB8 = ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1))


def rim_of(core):
    """The core pixels that touch the silhouette's boundary."""
    grow = np.zeros_like(core)
    for dy, dx in NB8:
        grow |= np.roll(np.roll(~core, dy, 0), dx, 1)
    return core & grow


def halo(a):
    """THE HALO, MEASURED LOCALLY — the only honest way to measure it.

    For every partially transparent pixel that touches the body, how much
    brighter is it than THE BODY IT TOUCHES? Comparing the whole edge against the
    whole rim only measures that a lit figure has more anti-aliased pixels along
    its lit shoulder than along its dark boot (that read 1.15 on a cut with no
    halo left in it at all). A fringe is a LOCAL excess, so it is measured
    against each pixel's own neighbours:

        halo = mean over edge pixels of ( luma(px) - mean luma(opaque neighbours) )

    Positive is a glow around the cut. It is +3.09 on the shipped sprite and +0.71
    once the body's colour has been bled outward, and lap.mjs's haloOf()
    reproduces it straight off the PNG the reader is served.
    """
    rgb = a[:, :, :3].astype(float)
    al = a[:, :, 3]
    core = al >= 250
    edge = (al > 16) & (al < 250)
    l = luma(rgb)
    acc = np.zeros_like(l)
    num = np.zeros_like(l)
    for dy, dx in NB8:
        acc += np.roll(np.roll(np.where(core, l, 0.0), dy, 0), dx, 1)
        num += np.roll(np.roll(core.astype(float), dy, 0), dx, 1)
    touching = edge & (num > 0)
    if not touching.any():
        return None, 0
    d = l[touching] - acc[touching] / num[touching]
    return round(float(d.mean()), 2), int(touching.sum())


def measure(a):
    rgb = a[:, :, :3].astype(float)
    al = a[:, :, 3]
    core = al >= 250
    edge = (al > 16) & (al < 250)
    l = luma(rgb)
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1.0), 0.0)
    rim = rim_of(core)
    h, hn = halo(a)
    return {
        'halo': h, 'haloPx': hn,
        'corePx': int(core.sum()), 'edgePx': int(edge.sum()),
        'coreLuma': round(float(l[core].mean()), 2),
        'rimLuma': round(float(l[rim].mean()), 2),
        'edgeLuma': round(float(l[edge].mean()), 2) if edge.any() else None,
        'fringe': round(float(l[edge].mean() / l[rim].mean()), 3) if edge.any() else None,
        'coreP95': round(float(np.percentile(l[core], 95)), 2),
        'coreMax': round(float(l[core].max()), 1),
        'hot': int((l[core] > HOT).sum()),
        'coreSat': round(float(sat[core].mean()), 3),
        'edgeSat': round(float(sat[edge].mean()), 3) if edge.any() else None,
        'alphaPx': int((al > 16).sum()),
    }


def bleed(a, rounds=6):
    """Push the CORE's colour outward into every partial pixel."""
    rgb = a[:, :, :3].astype(float).copy()
    al = a[:, :, 3]
    known = (al >= 250)
    out = rgb.copy()
    for _ in range(rounds):
        if known.all():
            break
        src = np.where(known[..., None], out, 0.0)
        cnt = known.astype(float)
        acc = np.zeros_like(src)
        num = np.zeros_like(cnt)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            acc += np.roll(np.roll(src, dy, 0), dx, 1)
            num += np.roll(np.roll(cnt, dy, 0), dx, 1)
        fill = (num > 0) & ~known
        with np.errstate(invalid='ignore', divide='ignore'):
            avg = np.where(num[..., None] > 0, acc / np.maximum(num[..., None], 1e-6), 0.0)
        out[fill] = avg[fill]
        known = known | fill
    return out


def pull(rgb):
    """Soft-knee the highlights and ease the saturation back."""
    l = luma(rgb)
    over = np.maximum(0.0, l - KNEE)
    span = max(1e-6, float(l.max()) - KNEE)
    # a smooth roll-off: everything above KNEE lands between KNEE and KNEE_CEIL
    want = KNEE + (KNEE_CEIL - KNEE) * (1.0 - np.exp(-2.2 * over / span))
    scale = np.where(l > KNEE, want / np.maximum(l, 1e-6), 1.0)
    out = rgb * scale[..., None]
    g = luma(out)
    out = g[..., None] + (out - g[..., None]) * SAT_PULL
    return np.clip(out, 0, 255)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--install', action='store_true')
    a = ap.parse_args()
    os.makedirs(RAW, exist_ok=True)
    src = os.path.join(ASSETS, TARGET)
    orig_copy = os.path.join(RAW, 'norton-chase-orig.png')
    if not os.path.exists(orig_copy):
        Image.open(src).convert('RGBA').save(orig_copy)
    im = Image.open(orig_copy).convert('RGBA')
    arr = np.array(im).astype(int)
    before = measure(arr)

    rgb = bleed(arr)
    rgb = pull(rgb)
    out = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), arr[:, :, 3].astype(np.uint8)])
    dst = os.path.join(RAW, 'norton-chase-matted.png')
    Image.fromarray(out, 'RGBA').save(dst)
    after = measure(out.astype(int))

    ok = (after['halo'] is not None and after['halo'] <= HALO_MAX
          and after['coreP95'] <= P95_MAX and after['hot'] == 0
          and after['alphaPx'] == before['alphaPx'])
    rep = {'file': TARGET, 'before': before, 'after': after,
           'gate': 'PASS' if ok else 'FAIL',
           'sha': hashlib.sha256(open(dst, 'rb').read()).hexdigest()}
    print(json.dumps(rep, indent=1))
    if a.install and ok:
        Image.fromarray(out, 'RGBA').save(src)
        print('installed ' + TARGET)
    elif a.install:
        print('NOT installed (gate FAIL)')
    with open(os.path.join(RAW, 'report.json'), 'w') as f:
        json.dump(rep, f, indent=1)


if __name__ == '__main__':
    main()
