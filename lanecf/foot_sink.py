#!/usr/bin/env python3
"""foot_sink.py -- the F5 CLOSER: is every church mark's foot on FLOOR, or is
its own FOOTWEAR hidden behind the pew?

Round 2 moved the chancel marks off the pew-top band and onto the plate's own
front-pew contour T(x) plus 8 px of hem, and the marriage still read wrong in
one place. The reason is a thing a floor line cannot see. The occluder cuts
every actor at T(x), so what the reader judges is not WHERE the mark is, it is
WHICH PART OF THE ACTOR the cut passes through:

  * a GOWN cut anywhere reads as a gown going behind a pew (the bride, and the
    plate's own painted bride, whose hem it cut at exactly this line);
  * a BOOT cut through its SOLE reads as a boot standing ON the pew rail --
    because the rail's own bright top highlight then sits directly under the
    sole, which is the picture of contact.

The witness was the one figure in that second case: mark 700/516, T(700)=508,
so 8 px of a 21 px boot was hidden and the sole line landed on the highlight.
Norton, 31 px behind his own T, was already right and reads right.

So this tool measures TWO things and joins them into one law.

1. THE FOOTWEAR BLOCK, per cut, from the cut's own alpha. Scan the bottom fifth
   of the silhouette for the widest row -- a standing figure's widest row down
   there is the toe flare -- then walk UP out of that band until the row width
   falls below 60 % of it. That row is the ankle; everything below it is
   footwear. (Holmes 21.0 px, Norton 18.3 px at their drawn heights: both boots,
   and the numbers agree with the cuts' own painted boot tops.)

2. EVERY MARK, against the shipped plate AND the shipped occluder:
     floorFrac  the fraction of a 5 px patch at the mark that the plate paints
                as chancel floor (carpet or stone), same HSV classes as
                church_geom.py
     sink       markY minus the top of the occluder's alpha in that column --
                how much of the actor `pews-front.png` actually swallows

   THE LAW: floorFrac >= 0.60  OR  sink >= footwear. Feet on the floor, or feet
   hidden. Nothing may stand with its sole on a rail.

Reported per mark, and asserted again from the reader's own frame in
tools/living/lap.mjs (the [F5] block), which probes these same two images in the
page and reads the marks out of the set's own snapshot.

    python3 foot_sink.py [--raw /abs/rawdir] [--json]
"""
import argparse
import datetime as dt
import json
import os

import numpy as np
from PIL import Image

ROOT = '/Users/samz/Documents/gaslight-remake'
LIVE = os.path.join(ROOT, 'site-deploy/living/assets')
PLATE = os.path.join(LIVE, 'set/church/church.jpg')
PEWS = os.path.join(LIVE, 'set/church/pews-front.png')
PEWS_BOX = (504, 451)               # the occluder's own left/top, sets/church.js
PX_PER_M = 104.5
FLOOR_MIN = 0.60

# the cuts that stand at the altar, and the height church.js draws each at
CUTS = [
    ('witness', 'actor/holmes-church.png', 1.87),
    ('witness-altar', 'actor/holmes-church-altar.png', 1.87),
    ('groom', 'actor/norton-groom.png', 1.80),
    ('bride', 'actor/irene-bride.png', 1.68),
    ('clergyman', 'actor/clergyman-altar.png', 1.75),
]

# sets/church.js's FLOOR polyline and its standing FEET, as shipped. Keep in
# step with the set: this tool is what says the set's numbers are legal.
FLOOR = [[449, 604], [522, 601], [700, 501], [791, 527.5], [980, 534]]
FEET = {'bride': [728.0, 524.0], 'groom': [790.5, 527.4], 'clergyman': [886.0, 509.0]}
WALK_MARKS = {'back': 478, 'lounged': 508, 'nortonMet': 520, 'altar': 700,
              'nortonDrag': 770, 'nortonHome': 790.5}
# which cut is standing on which mark, for the footwear test
MARK_CUT = {'back': 'witness', 'lounged': 'witness', 'altar': 'witness-altar',
            'nortonMet': 'groom', 'nortonDrag': 'groom', 'nortonHome': 'groom',
            'bride': 'bride', 'groom': 'groom', 'clergyman': 'clergyman'}


def floor_at(x):
    """sets/church.js floorY(), so the marks this tool tests are the marks the
    set actually stands people on."""
    pts = FLOOR
    if x <= pts[0][0]:
        return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


def runs(row):
    """how many separate solid runs this row of alpha has -- two boots are two
    runs, a skirt is one. It is what tells a FOOT from a HEM."""
    on = row > 16
    return int(np.count_nonzero(on[1:] & ~on[:-1]) + (1 if on[0] else 0))


def footwear(path, height_m):
    """the bottom block of a cut that must not be seen standing on anything.

    A cut that ends in FEET gets a block: the toe flare and everything under the
    ankle. A cut that ends in a HEM (the bride's gown, the clergyman's cassock)
    gets ZERO, and that is not a loophole -- it is the whole finding. A hem cut
    by a rail reads as cloth going behind the rail, which is exactly what the
    plate's own painted bride did at this line; a SOLE cut by a rail reads as a
    boot standing on it. Feet are told from cloth by the silhouette itself: two
    boots are two runs of alpha in a row, a skirt is one."""
    a = np.asarray(Image.open(path).convert('RGBA'))
    alpha = a[:, :, 3]
    rows = np.where((alpha > 16).sum(1) > 0)[0]
    y0, y1 = int(rows[0]), int(rows[-1])
    w = (alpha > 16).sum(1)
    band0 = y1 - int(0.20 * (y1 - y0))
    widest = band0 + int(np.argmax(w[band0:y1 + 1]))
    thr = 0.60 * w[widest]
    top = widest
    while top - 1 >= y0 and w[top - 1] >= thr:
        top -= 1
    art_px = y1 - top + 1
    scale = height_m * PX_PER_M / a.shape[0]     # placeSprite draws the whole sheet
    # FOOTED or HEMMED, measured over the bottom tenth of the silhouette
    band = range(y1 - max(4, int(0.10 * (y1 - y0))), y1 - 1)
    multi = sum(1 for y in band if runs(alpha[y]) >= 2)
    footed = multi >= 0.5 * len(list(band))
    return {'file': os.path.relpath(path, LIVE), 'artRows': [y0, y1],
            'widestRow': int(widest), 'ankleRow': int(top), 'footed': bool(footed),
            'footwearArtPx': int(art_px) if footed else 0,
            'footwearPlatePx': round(art_px * scale, 1) if footed else 0.0,
            'blockIfFooted': round(art_px * scale, 1),
            'drawnPlatePx': round(height_m * PX_PER_M, 1)}


def classes(rgb):
    """church_geom.py's own HSV classes: carpet | stone | pew | other."""
    r, g, b = [rgb[:, :, i].astype(np.float64) for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    d = np.where(mx == mn, 1, mx - mn)
    h = np.select([mx == r, mx == g], [((g - b) / d) % 6, (b - r) / d + 2], (r - g) / d + 4)
    h = np.where(mx == mn, 0, ((h * 60 + 360) % 360) * (255 / 360))
    s = np.where(mx == 0, 0, 255 * (mx - mn) / np.maximum(mx, 1))
    carpet = ((h < 14) | (h > 242)) & (s > 100) & (mx > 38) & (mx < 195)
    stone = (s < 86) & (mx > 78) & (mx < 232)
    return carpet | stone


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', default=None)
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()

    boots = {name: footwear(os.path.join(LIVE, rel), h) for name, rel, h in CUTS}

    plate = np.asarray(Image.open(PLATE).convert('RGB'))
    isfloor = classes(plate)
    pews = np.asarray(Image.open(PEWS).convert('RGBA'))[:, :, 3]

    def probe(x, y):
        xi, yi = int(round(x)), int(round(y))
        patch = isfloor[yi - 5:yi + 6, xi - 5:xi + 6]
        frac = float(patch.mean()) if patch.size else 0.0
        # the occluder, in its own coordinates: how far above the mark does the
        # pew's alpha stop? that run is what the layer swallows.
        px, py = xi - PEWS_BOX[0], yi - PEWS_BOX[1]
        sink = 0.0
        if 0 <= px < pews.shape[1] and 0 <= py < pews.shape[0] and pews[py, px] > 16:
            t = py
            while t - 1 >= 0 and pews[t - 1, px] > 16:
                t -= 1
            sink = py - t + 1
        return round(frac, 3), float(sink)

    marks = {}
    for name, x in WALK_MARKS.items():
        y = floor_at(x)
        frac, sink = probe(x, y)
        cut = boots[MARK_CUT[name]]
        marks[name] = {'x': x, 'y': round(y, 1), 'floorFrac': frac, 'sink': sink,
                       'footwear': cut['footwearPlatePx'], 'cut': MARK_CUT[name],
                       'pass': bool(frac >= FLOOR_MIN or sink >= cut['footwearPlatePx'])}
    for name, (x, y) in FEET.items():
        frac, sink = probe(x, y)
        cut = boots[MARK_CUT[name]]
        marks[name] = {'x': x, 'y': y, 'floorFrac': frac, 'sink': sink,
                       'footwear': cut['footwearPlatePx'], 'cut': MARK_CUT[name],
                       'pass': bool(frac >= FLOOR_MIN or sink >= cut['footwearPlatePx'])}

    man = {'when': dt.datetime.utcnow().isoformat() + 'Z', 'tool': 'tools/lanecf/foot_sink.py',
           'floorMin': FLOOR_MIN, 'floor': FLOOR, 'footwear': boots, 'marks': marks,
           'allPass': all(m['pass'] for m in marks.values())}

    if a.json:
        print(json.dumps(man, indent=1))
    else:
        print('FOOTWEAR BLOCKS (the part that may not be seen standing on a rail)')
        for k, v in boots.items():
            print(f"  {k:14} rows {v['ankleRow']}..{v['artRows'][1]}  "
                  f"{v['footwearArtPx']} art px -> {v['footwearPlatePx']} plate px "
                  f"of {v['drawnPlatePx']}")
        print('MARKS (floorFrac >= %.2f  OR  sink >= footwear)' % FLOOR_MIN)
        for k, v in marks.items():
            print(f"  {k:12} ({v['x']}, {v['y']})  floorFrac={v['floorFrac']:.3f}  "
                  f"sink={v['sink']:.1f}  boot={v['footwear']:.1f}  "
                  f"{'PASS' if v['pass'] else 'FAIL'}")
        print('ALL PASS' if man['allPass'] else 'FAILURES ABOVE')

    if a.raw:
        os.makedirs(a.raw, exist_ok=True)
        with open(os.path.join(a.raw, 'foot_sink.json'), 'w') as f:
            json.dump(man, f, indent=1)
        print('wrote ' + os.path.join(a.raw, 'foot_sink.json'))
    return 0 if man['allPass'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
