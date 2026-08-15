#!/usr/bin/env python3
"""pew_end.py — put the FRONT PEW'S END STANDARD into the occluder, because that
is the thing the witness's left boot was painted on top of.

WHAT ROUND 3 MISSED. pew_front.py cut the foreground layer at T(x), "the first
bright warm rail pixel with a dark run under it". That finds RAILS. The front
pew's END STANDARD — the upright at the chancel end of the front row, plate
x 648..690 — has no bright top: it is a flat dark violet face (RGB ~46,40,54:
hue 260, sat 26 %, value 52), stepped, with its top edge at y 452 over x 648..668
and at y 485 over x 668..690. Every one of those columns' T therefore fell
through to the NEXT rail at y 530..541, and the standard stayed out of the layer.

The witness's altar mark is x 700 and his boots span 53 plate px, so his LEFT
boot lands at x 671..686 — on that standard, 15 px above its own top edge. He
stands on chancel stone the plate really does paint (x 692..755, y 488..505,
which is why the mark probes floorFrac 0.893 and passes foot_sink.py), but the
left half of his stance is over furniture that is NEARER than the stone, so the
boot has nothing under it. In the ring lens's 3.2x push it hangs in mid-air:
the review's own F5 complaint, alive inside a lap that asserted F5.
tools/lanecf/sole_span.py is the measurement that sees it — per column of the
boot's own alpha instead of one 11x11 patch at the mark.

THE FIX IS THE LAYER, NOT THE MARK. The mark is right: that stone is where a
person stands at this altar, and moving him right far enough to clear the
standard (x >= 721) would plant him in front of the bride and inside the ring
lens's own subject. What was wrong is that the foreground was incomplete. So
T(x) is lowered to the standard's own top edge over its own columns and the
layer is rebuilt from the plate's own pixels below it — the same construction
pew_front.py used, on a contour that now includes the piece of furniture it
missed.

HOW THE CONTOUR IS FOUND, and why it is not a box someone drew: in each column
the pew mask's runs are merged from the BOTTOM up, across gaps of <= GAP px (a
rail highlight or an antialiased edge), and the merged run's top is T'. That
stops exactly where the furniture stops: at x 676 the runs are 458..477 and
488..532 with a 10 px gap, and the tool takes 488 — the standard's top — and not
the dark band above it, which is the chancel step's own shadow, BEHIND anything
standing on the stone. Getting that distinction wrong in the other direction
would hide the witness's shin behind a shadow.

X_MIN is the standard's left edge and it matters: further left the dark mass is
the pew BACKS the walkers pass in the aisle, and their contour is already the
rail pew_front.py measured. A layer that grew there would hide a walker behind
the pew he is standing in front of.

    python3 tools/lanecf/pew_end.py --raw /abs/rawdir [--dry]
"""
import argparse
import datetime as dt
import hashlib
import json
import os

import numpy as np
from PIL import Image

ROOT = '/Users/samz/Documents/gaslight-remake'
LIVE = os.path.join(ROOT, 'site-deploy/living/assets/set/church')
PEWS_BOX = (504, 451, 442, 250)     # sets/church.js PEWS x/y/w/h, as shipped
X_MIN, X_MAX = 648, 690             # the standard's own columns
Y_FOOT = (484, 545)                 # where a chancel sole can land in them
GAP = 4                             # px of rail highlight a merge may cross
VARIANTS = [('church.jpg', 'pews-front.png'),
            ('church-ring.jpg', 'pews-front-ring.png')]


def pew_mask(rgb):
    """the pew furniture's own colour: dark, violet-blue, unlit.

    Measured off this plate: the standard is (46,40,54) — hue 260, value 52; the
    pew backs run down to value 20. The two things it must NOT catch are the
    chancel stone the witness stands on (value 89..118, hue 357..8) and the warm
    wooden aisle floor (value 140, hue 20), and value alone excludes both."""
    r, g, b = [rgb[:, :, i].astype(np.float64) for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    d = np.where(mx == mn, 1, mx - mn)
    h = np.select([mx == r, mx == g], [((g - b) / d) % 6, (b - r) / d + 2], (r - g) / d + 4)
    h = np.where(mx == mn, 240, (h * 60 + 360) % 360)
    return (mx < 80) & (h > 200) & (h < 310)


def contour(mask, x):
    """T'(x): the top of the furniture a sole in this column would stand on.

    Runs are merged upward from the lowest one that reaches the foot band, which
    is what makes this the STANDARD and not the shadow above it."""
    on = np.nonzero(mask[:, x])[0]
    if not len(on):
        return None
    runs = []
    s = p = on[0]
    for v in on[1:]:
        if v > p + 1:
            runs.append((s, p))
            s = v
        p = v
    runs.append((s, p))
    low = [r for r in runs if r[1] >= Y_FOOT[0] and r[0] <= Y_FOOT[1]]
    if not low:
        return None
    # the HIGHEST run that reaches the foot band is the piece of furniture a
    # sole there would stand on; the runs under it are the same piece's own
    # shadowed courses and get swallowed by the fill anyway.
    top, bot = low[0]
    for a, b in reversed(runs):
        if b < top - 1 - GAP:
            break
        top = min(top, a)
    return int(top)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', default=None)
    ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()
    bx, by, bw, bh = PEWS_BOX
    man = {'when': dt.datetime.utcnow().isoformat() + 'Z',
           'tool': 'tools/lanecf/pew_end.py', 'box': list(PEWS_BOX),
           'xRange': [X_MIN, X_MAX], 'gap': GAP, 'footBand': list(Y_FOOT),
           'variants': {}}

    for plate_name, cut_name in VARIANTS:
        plate = np.asarray(Image.open(os.path.join(LIVE, plate_name)).convert('RGB'))
        arr = np.asarray(Image.open(os.path.join(LIVE, cut_name)).convert('RGBA')).copy()
        assert arr.shape[:2] == (bh, bw), f'{cut_name} is not the shipped box'
        mask = pew_mask(plate)
        add = np.zeros((bh, bw), bool)
        tops = {}
        for x in range(X_MIN, X_MAX + 1):
            t = contour(mask, x)
            if t is None:
                continue
            tops[x] = t
            # the layer IS the plate below its contour — pew_front.py's own
            # construction, so the column is filled and can hide nothing partly
            add[max(0, t - by):, x - bx] = True
        add &= arr[:, :, 3] <= 16
        src = plate[by:by + bh, bx:bx + bw]
        arr[:, :, :3] = np.where(add[:, :, None], src, arr[:, :, :3])
        arr[:, :, 3] = np.where(add, 255, arr[:, :, 3])
        info = {'added': int(add.sum()), 'tops': tops,
                'topRange': [min(tops.values()), max(tops.values())]}
        man['variants'][cut_name] = info
        print(f"{cut_name}: +{info['added']} px over x {X_MIN}..{X_MAX}, "
              f"T' {info['topRange'][0]}..{info['topRange'][1]}")
        if not a.dry:
            out = os.path.join(LIVE, cut_name)
            Image.fromarray(arr).save(out)
            info['md5'] = hashlib.md5(open(out, 'rb').read()).hexdigest()
            print(f'  wrote {out}')

    step = man['variants'][VARIANTS[0][1]]['tops']
    print('T\' by column: ' + ' '.join(f'{x}:{step[x]}' for x in sorted(step)
                                      if x % 6 == 0))
    if a.raw and not a.dry:
        os.makedirs(a.raw, exist_ok=True)
        with open(os.path.join(a.raw, 'pew_end.json'), 'w') as f:
            json.dump(man, f, indent=1)
        print('wrote ' + os.path.join(a.raw, 'pew_end.json'))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
