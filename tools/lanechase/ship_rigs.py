#!/usr/bin/env python3
"""ship_rigs.py -- land the THREE RIGS as shipped sprites, with their geometry.

CONTENT-full 7.2 #7: "vehicle rigs: hansom, landau, four-wheeler (+ drivers,
horses, wheels, lamp halos)". They were generated raw-first under
assets/raw/book-chase/rigs/ and keyed off the magenta field by the actor lane's
own matte (spill ceiling that holds). This script does the last three things,
the way ship_chase.py does them:

 1. SIZE. Each rig ships at 500 px tall, which is 3.4x the largest it is ever
    drawn (2.9 m * 51.2 px/m = 148 plate px at rail u 0) and covers the gate
    lens (k 1.58) at deviceScaleFactor 2.

 2. GEOMETRY, measured, not guessed. A rig is placed by its REAR WHEEL CONTACT,
    because the art already carries the road's perspective -- the horse's hooves
    sit HIGHER in the picture than the back wheels, exactly as they do on a road
    that recedes up the frame. So the sprite's baseline is the bottom of its own
    alpha, and the rail point it is pinned to is the back of the rig.
    The LAMP ANCHOR is measured too: the warm centroid of the painted lamp
    (high R, high G, low B, bright), in sprite-normalised coordinates, so the
    lamp bloom the set draws hangs on the rig's own lamp bracket instead of on
    air.

 3. THE MANIFEST. Bytes, size, sha, and the geometry a later lane cannot
    re-derive by looking at the picture, appended to MANIFEST-book.json.

    python3 ship_rigs.py [--height 500]
"""
import argparse
import hashlib
import json
import os
import time

import numpy as np
from PIL import Image

ROOT = '/Users/samz/Documents/gaslight-remake'
KEYED = os.path.join(ROOT, 'assets/raw/book-chase/rigs/keyed')
DEST = os.path.join(ROOT, 'site-deploy/living/assets/set/chase')
MANIFEST = os.path.join(ROOT, 'site-deploy/living/assets/MANIFEST-book.json')

# id -> (keyed file, note, metres tall at the top of the art)
#
# HEIGHT_M is the driver's hat crown above the road, which is what the art's
# alpha bbox actually spans. A hansom's box seat puts a man's head at ~2.9 m;
# a landau's box is lower and its coachman sits at ~2.75 m; the growler's
# body is taller than either and its driver's hat crowns at ~3.0 m.
RIGS = {
    'norton': ('rig-norton.png', 2.90,
               "Norton's cab at Briony Lodge (III.1-5) - closed night carriage, "
               "horse in harness, driver on the box, near-side lamp lit"),
    'lead':   ('rig-lead.png', 2.75,
               "Irene's landau (III.5-11) - open four-wheeler, half-hood folded "
               "down, coachman with his coat half-buttoned, near-side lamp lit"),
    'follow': ('rig-follow.png', 3.00,
               "the following four-wheeler, the `cab` gate's target (III.5-11) - "
               "box-bodied growler with its roof rail, shabby horse, lamp lit"),
}


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()[:16]


def despill(rgba, ceiling=8.0):
    """Kill magenta backing that survived the key, WITHOUT eating the blue rim.

    laneassets/matte.py probes spill as (R+B)/2 - G and only inside a 9 px edge
    band. Both are wrong for a carriage: the spill that survives here is on the
    INTERIOR thin geometry -- wheel spokes, harness straps, the roof rail --
    where the backing shone through a one-pixel gap, and (R+B)/2 - G is just as
    large for the cool blue rim light this plate's night actually wants (a blue
    of (50,60,120) scores 25). The probe that separates them is min(R,B) - G:
    magenta needs BOTH red and blue above green, blue rim does not. Where it is
    hot, R and B are pulled toward G proportionally, which lands the excess
    exactly on the ceiling and cannot leave 0..255.
    """
    out = rgba.astype(np.float32)
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    ex = np.minimum(r, b) - g
    hot = ex > ceiling
    if not hot.any():
        return rgba
    k = np.ones_like(ex)
    k[hot] = ceiling / ex[hot]
    out[..., 0] = g + (r - g) * k
    out[..., 2] = g + (b - g) * k
    return np.clip(out, 0, 255).astype(np.uint8)


def lamp_anchor(rgba):
    """the painted carriage lamp: the brightest warm blob inside the alpha.

    Warm excess (min(R,G) - B) is the probe, not luma: the rig is a black
    lacquered body under a blue night key, so its brightest pixels by luma are
    the cool rim highlights on the roof. The lamp is the only thing on the rig
    that is both bright AND amber."""
    a = rgba[..., 3].astype(np.float32) / 255.0
    r, g, b = (rgba[..., i].astype(np.float32) for i in range(3))
    warm = np.minimum(r, g) - b
    score = np.clip(warm, 0, None) * np.clip((r + g) * 0.5 - 60, 0, None) * (a > 0.5)
    if score.max() <= 0:
        return None
    thr = score.max() * 0.55
    ys, xs = np.nonzero(score >= thr)
    w = score[ys, xs]
    return (float((xs * w).sum() / w.sum()), float((ys * w).sum() / w.sum()))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--height', type=int, default=500)
    a = ap.parse_args()

    man = json.load(open(MANIFEST))
    geom = {}
    for rid, (src, height_m, note) in RIGS.items():
        im = Image.open(os.path.join(KEYED, src)).convert('RGBA')
        # recrop to the alpha bbox so the baseline is the art's own ground line
        bbox = Image.fromarray((np.array(im)[..., 3] > 6).astype(np.uint8) * 255).getbbox()
        im = im.crop(bbox)
        s = a.height / im.size[1]
        im = im.resize((max(1, round(im.size[0] * s)), a.height), Image.LANCZOS)
        arr = despill(np.array(im))
        arr[..., :3][arr[..., 3] == 0] = 0          # deflate has nothing to chew on
        im = Image.fromarray(arr)
        out = os.path.join(DEST, 'rig-%s.png' % rid)
        im.save(out, optimize=True)

        lamp = lamp_anchor(arr)
        # the FOOTPRINT: how wide the wheels actually stand on the road, used
        # for the contact shadow. Measured on the bottom eighth of the alpha.
        al = arr[..., 3] > 24
        foot = al[int(a.height * 0.88):, :]
        cols = np.nonzero(foot.any(axis=0))[0]
        geom[rid] = {
            'file': 'set/chase/rig-%s.png' % rid,
            'size': list(im.size),
            'baseline': im.size[1],                 # alpha bottom == road contact
            'height_m': height_m,
            'lamp': [round(lamp[0], 1), round(lamp[1], 1)] if lamp else None,
            'lamp_uv': [round(lamp[0] / im.size[0], 4),
                        round(lamp[1] / im.size[1], 4)] if lamp else None,
            'foot_x': [int(cols[0]), int(cols[-1])] if len(cols) else None,
        }
        man['files']['set/chase/rig-%s.png' % rid] = {
            'bytes': os.path.getsize(out), 'size': list(im.size), 'mode': 'RGBA',
            'sha256': sha(out), 'note': note, 'rig': geom[rid],
        }
        print(json.dumps({rid: geom[rid], 'bytes': os.path.getsize(out)}))

    man['rigs_shipped'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    json.dump(man, open(MANIFEST, 'w'), indent=1)
    json.dump(geom, open(os.path.join(ROOT, 'assets/raw/book-chase/rigs/geom.json'), 'w'),
              indent=1)


if __name__ == '__main__':
    main()
