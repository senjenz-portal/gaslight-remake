#!/usr/bin/env python3
"""church_geom.py -- read the church plate's OWN floor geometry off the picture.

F5. The shipped set carries `AISLE = {x0:470, y0:590, slope:-0.2636}` and claims
four collinear stage-proof points for it. Measured against the plate, that line
is fiction past x ~= 545: the aisle runner it is supposed to follow is HIDDEN
BEHIND THE NEAR PEW BLOCK from there on, so every mark from `lounged` (548)
through `altar` (640) lands on a PEW BACK, which is exactly the floating the
review saw ("BOTH sprites stand on TOP of pew backs").

So the floor is not fitted from a remembered proof, it is measured here, from
three things the plate paints and nothing else:

  the FLOOR MASK      per-pixel: crimson carpet, or pale stone, or pew wood.
                      Everything downstream is "is this point floor".
  the CHANCEL LINE    the three baked figures' own feet. They are the plate's
                      own statement of where a person stands at that altar, so
                      the actors that replace them inherit their marks exactly
                      and the register swap cannot move anybody.
  the AISLE LINE      fitted through the visible crimson runner in the nave,
                      column by column, over the x range where the runner is
                      actually VISIBLE -- and the tool reports that range, so a
                      mark outside it is known to be a guess.

Inputs: the PRE-patch plate (it still paints the three figures, which is what
makes their feet measurable) and the figure mask chancel_patch.py emitted.

    python3 church_geom.py --raw /abs/rawdir [--out /abs/floor.json]
"""
import argparse
import json
import os

import numpy as np
from PIL import Image

ROOT = '/Users/samz/Documents/gaslight-remake'
LIVE = os.path.join(ROOT, 'site-deploy/living/assets/set/church')

# the plate lane's own figure boxes, as sets/church.js carries them
FIGURES = {'bride': (688, 344, 792, 528),
           'groom': (790, 372, 875, 505),
           'clergyman': (848, 328, 925, 510)}
NAVE_BAND = (400, 470, 820, 660)      # where to look for the nave runner
CHANCEL_BAND = (790, 460, 1030, 580)  # where to look for the chancel carpet


def classify(rgb):
    """floor / pew, off the plate's own palette. HSV, so the candle gradient
    across the nave does not move the boundaries."""
    im = Image.fromarray(rgb.round().astype(np.uint8))
    hsv = np.asarray(im.convert('HSV')).astype(np.float64)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    carpet = ((H < 14) | (H > 242)) & (S > 100) & (V > 38) & (V < 195)
    stone = (S < 86) & (V > 78) & (V < 232)
    pew = V < 78
    return {'carpet': carpet, 'stone': stone, 'pew': pew,
            'floor': (carpet | stone) & ~pew}


def figure_feet(pre, mask):
    """each baked figure's own foot mark: the bottom of its silhouette, taken
    over the CENTRAL 40% of its width so a trailing veil or an open sleeve
    cannot pull the mark sideways or down."""
    out = {}
    for name, (x0, y0, x1, y1) in FIGURES.items():
        sub = mask[y0 - 8:y1 + 14, x0 - 6:x1 + 6] > 0.6
        if not sub.any():
            out[name] = None
            continue
        ys, xs = np.nonzero(sub)
        gx0, gx1 = xs.min(), xs.max()
        w = gx1 - gx0
        core = (xs > gx0 + 0.30 * w) & (xs < gx0 + 0.70 * w)
        footy = float(ys[core].max() if core.any() else ys.max()) + y0 - 8
        cx = float((gx0 + gx1) / 2) + x0 - 6
        out[name] = {'x': round(cx, 1), 'footY': round(footy, 1),
                     'bbox': [int(gx0 + x0 - 6), int(ys.min() + y0 - 8),
                              int(gx1 + x0 - 6), int(ys.max() + y0 - 8)],
                     'heightPx': int(ys.max() - ys.min() + 1)}
    return out


def fit_line(pts):
    x = np.array([p[0] for p in pts], float)
    y = np.array([p[1] for p in pts], float)
    A = np.vstack([x, np.ones_like(x)]).T
    m, b = np.linalg.lstsq(A, y, rcond=None)[0]
    resid = np.abs(A @ [m, b] - y)
    return {'slope': round(float(m), 5), 'intercept': round(float(b), 2),
            'n': len(pts), 'maxResid': round(float(resid.max()), 2),
            'rmsResid': round(float(np.sqrt((resid ** 2).mean())), 2)}


def runner_centre(cls, band, min_run=6):
    """column-by-column centre of the widest crimson run inside `band`"""
    x0, y0, x1, y1 = band
    carpet = cls['carpet']
    pts = []
    for x in range(x0, x1):
        col = np.nonzero(carpet[y0:y1, x])[0]
        if len(col) < min_run:
            continue
        runs, s, p = [], col[0], col[0]
        for y in col[1:]:
            if y - p > 3:
                runs.append((s, p))
                s = y
            p = y
        runs.append((s, p))
        best = max(runs, key=lambda r: r[1] - r[0])
        if best[1] - best[0] < min_run:
            continue
        pts.append((x, y0 + (best[0] + best[1]) / 2.0, best[1] - best[0]))
    return pts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', required=True)
    ap.add_argument('--out', default=os.path.join(LIVE, 'floor.json'))
    a = ap.parse_args()

    pre = np.asarray(Image.open(os.path.join(a.raw, 'pre', 'church.jpg'))
                     .convert('RGB')).astype(np.float64)
    post = np.asarray(Image.open(os.path.join(LIVE, 'church.jpg'))
                      .convert('RGB')).astype(np.float64)
    mask = np.asarray(Image.open(os.path.join(a.raw, 'chancel-figure-mask.png'))
                      ).astype(np.float64) / 255.0

    feet = figure_feet(pre, mask)
    chancel = fit_line([(f['x'], f['footY']) for f in feet.values() if f])

    # the aisle, off the EMPTIED plate (the figures no longer sit on the carpet)
    cls = classify(post)
    nave_pts = runner_centre(cls, NAVE_BAND)
    chan_pts = runner_centre(cls, CHANCEL_BAND)
    aisle = fit_line([(p[0], p[1]) for p in nave_pts]) if len(nave_pts) > 8 else None
    visible_x = [int(min(p[0] for p in nave_pts)), int(max(p[0] for p in nave_pts))] \
        if nave_pts else None

    # the SHIPPED line, for the record
    ship = {'x0': 470, 'y0': 590, 'slope': (532 - 590) / (690 - 470)}
    def ship_at(x):
        return ship['y0'] + (x - ship['x0']) * ship['slope']

    probe = {}
    for name in ('back', 'lounged', 'altar'):
        x = {'back': 424, 'lounged': 548, 'altar': 640}[name]
        y = int(round(ship_at(x)))
        probe[name] = {'x': x, 'shippedFloorY': y,
                       'plateIs': ('pew' if cls['pew'][y, x] else
                                   'carpet' if cls['carpet'][y, x] else
                                   'stone' if cls['stone'][y, x] else 'other')}

    out = {
        'plate': [1408, 768],
        'measuredFrom': {'pre': os.path.join(a.raw, 'pre/church.jpg'),
                         'post': os.path.join(LIVE, 'church.jpg'),
                         'mask': os.path.join(a.raw, 'chancel-figure-mask.png')},
        'figureFeet': feet,
        'chancelLine': chancel,
        'aisleLine': aisle,
        'aisleVisibleX': visible_x,
        'aisleSamples': len(nave_pts),
        'chancelCarpetSamples': len(chan_pts),
        'shippedAisle': {'x0': ship['x0'], 'y0': ship['y0'],
                         'slope': round(ship['slope'], 5)},
        'shippedMarkProbe': probe,
        'floorClass': {
            'carpet': 'HSV hue<14 or >242, S>100, 38<V<195',
            'stone': 'S<86, 78<V<232',
            'pew': 'V<78',
        },
    }
    json.dump(out, open(a.out, 'w'), indent=1)
    print(json.dumps(out, indent=1))
    print('wrote ' + a.out)


if __name__ == '__main__':
    main()
