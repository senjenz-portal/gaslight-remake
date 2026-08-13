#!/usr/bin/env python3
"""sole_span.py — the F5 CLOSER'S CLOSER: every column of a sole, not one patch
at the mark.

foot_sink.py stated the right law — *feet on painted floor, or feet hidden* —
and then measured it in the one place it cannot be measured: an 11x11 patch
centred on the MARK. A mark is a point; a pair of boots is 54 plate px wide. At
the altar the two are not the same question, because the thing the witness
stands next to is the NEAR PEW'S BACK, whose dark face runs up to plate x 686
and is nothing at all like floor:

    the shipped mark (700, 501) probes floorFrac 0.893 and PASSES foot_sink,
    and in the reader's own ring-lens frame the left boot hangs in mid-air over
    the pew back with the rail's highlight 7 px below the other one.

That is the review's F5 exactly — a sole with no floor under it — surviving a
lap that asserted F5. So this tool asks the question per COLUMN of the actor's
own footwear block, at that column's own sole row:

    hidden   the occluder `pews-front.png` paints this pixel -> the pew has the
             foot, which is what the plate's own painted figures did
    onPew    the plate paints PEW FURNITURE under this sole and the occluder does
             NOT cover it: the boot is standing on a pew, or floating over one
    floor    anything else: the sole is over floor

THE LAW: onPew == 0 for every standing mark and every walker's stop mark. Not a
fraction: one bare boot over a pew end in a 3.2x push is the defect the review
reported. Asserted per frame from the reader's own DOM in tools/living/lap.mjs
([F5] the sole-span block).

WHY THE TEST IS "NOT ON A PEW" AND NOT "ON FLOOR". Floor is many materials here
and the two the classifier knows (red carpet, chancel stone) are not all of
them: the aisle's own wooden boards read hue 20 / sat 57 % / value 140 and are
neither, so a floor test rejects boots that are standing on painted floorboards —
the walk marks scored 7 and 11 "void" columns on perfectly good floor. What can
be identified without ambiguity is the thing the review actually complained about:
pew furniture is the only dark violet mass in this plate (value < 80, hue
200..310; stone is value 89..118 and the boards 140). So the law names the
defect instead of the remedy, and no floor material can trip it.

WHICH COLUMNS COUNT. A cut's GROUND CONTACT is the columns whose own last
painted row is within BAND art px of the cut's lowest row — both boots of a
standing figure (their soles differ by 13..20 art px in these cuts, the near
foot lower), the bride's whole gown hem, and NOT a beckoning arm or a raised
knee. The ankle-walk foot_sink.py uses cannot do this job here: on
`norton-beckon.png` it puts the ankle at art row 9 and calls 288 of 294 columns
footwear, which tests his outstretched hand against the floor.

    python3 tools/lanecf/sole_span.py [--sweep] [--json OUT]
"""
import argparse
import datetime as dt
import json
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
LIVE = os.path.join(ROOT, 'site-deploy/living/assets')
PX_PER_M = 104.5
PEWS_BOX = (504, 451)               # sets/church.js PEWS x/y

# sets/church.js, as shipped. This tool is what says these numbers are legal.
FLOOR = [[449, 604], [522, 601], [700, 501], [791, 527.5], [980, 534]]
FEET = {'bride': (728.0, 524.0), 'groom': (790.5, 527.4), 'clergyman': (886.0, 509.0)}
MARK = {'back': 478, 'lounged': 508, 'nortonMet': 474, 'altar': 704,
        'nortonDrag': 770, 'nortonHome': 790.5}
# cut -> (file, drawn height in m, declared baseline row)
CUTS = {
    'witness':      ('actor/holmes-church.png', 1.87, 583.1),
    'witnessAltar': ('actor/holmes-church-altar.png', 1.87, 583.1),
    'groom':        ('actor/norton-groom.png', 1.80, 561.1),
    'groomBeck':    ('actor/norton-beckon.png', 1.80, 561.1),
    'bride':        ('actor/irene-bride.png', 1.68, 524.0),
    'clergyman':    ('actor/clergyman-altar.png', 1.75, 545.8),
}
# which cut stands on which mark
STANDS = [('back', 'witness'), ('lounged', 'witness'), ('altar', 'witnessAltar'),
          ('nortonMet', 'groomBeck'), ('nortonDrag', 'groom'),
          ('nortonHome', 'groom')]


def floor_at(x):
    if x <= FLOOR[0][0]:
        return FLOOR[0][1]
    for (x0, y0), (x1, y1) in zip(FLOOR, FLOOR[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return FLOOR[-1][1]


BAND = 20                  # art px of "ground contact" above a cut's lowest row


def classes(rgb):
    """church_geom.py's own HSV classes: carpet | stone. Kept for the map."""
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


def pew_class(rgb):
    """PEW FURNITURE: the only dark violet mass in this plate (tools/lanecf/
    pew_end.py measured it — the end standard is value 52 / hue 260, the pew
    backs run to value 20; chancel stone is 89..118 and the aisle boards 140)."""
    r, g, b = [rgb[:, :, i].astype(np.float64) for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    d = np.where(mx == mn, 1, mx - mn)
    h = np.select([mx == r, mx == g], [((g - b) / d) % 6, (b - r) / d + 2], (r - g) / d + 4)
    h = np.where(mx == mn, 240, (h * 60 + 360) % 360)
    return (mx < 80) & (h > 200) & (h < 310)


PLATE = np.asarray(Image.open(os.path.join(LIVE, 'set/church/church.jpg')).convert('RGB'))
ISFLOOR = classes(PLATE)
ISPEW = pew_class(PLATE)
PEWS = np.asarray(Image.open(os.path.join(LIVE, 'set/church/pews-front.png'))
                  .convert('RGBA'))[:, :, 3]
_CACHE = {}


def geom(name):
    """the cut's per-column sole row, and which columns touch the ground."""
    if name in _CACHE:
        return _CACHE[name]
    rel, hm, base = CUTS[name]
    a = np.asarray(Image.open(os.path.join(LIVE, rel)).convert('RGBA'))[:, :, 3]
    k = hm * PX_PER_M / a.shape[0]
    on = a > 16
    bot = np.where(on.any(0), on.shape[0] - 1 - np.argmax(on[::-1], 0), -1)
    ground = int(bot.max()) - BAND
    _CACHE[name] = (a.shape, k, base, bot, ground)
    return _CACHE[name]


def support(name, mx, my):
    """what every sole column of `name` stands on when its baseline is at (mx, my)."""
    (ah, aw), k, base, bot, ground = geom(name)
    left = mx - (aw * k) / 2.0
    top = my - base * k
    out = {'floor': 0, 'hidden': 0, 'onPew': 0, 'n': 0, 'pew_px': []}
    for c in range(aw):
        if bot[c] < ground:
            continue                       # this column is not on the ground
        px = int(round(left + c * k))
        py = int(round(top + bot[c] * k))
        if not (0 <= px < PLATE.shape[1] and 0 <= py < PLATE.shape[0]):
            continue
        out['n'] += 1
        lx, ly = px - PEWS_BOX[0], py - PEWS_BOX[1]
        hidden = (0 <= lx < PEWS.shape[1] and 0 <= ly < PEWS.shape[0]
                  and PEWS[ly, lx] > 16)
        # one row of slack: a sole's own antialiased edge is a row wide, so the
        # pixel that carries the contact can be either of two rows.
        onpew = bool(ISPEW[py:py + 2, px].all())
        if hidden:
            out['hidden'] += 1
        elif onpew:
            out['onPew'] += 1
            out['pew_px'].append([px, py])
        else:
            out['floor'] += 1
    out['supported'] = round((out['n'] - out['onPew']) / max(1, out['n']), 3)
    out['ok'] = bool(out['n'] and out['onPew'] == 0)
    return out


def line(tag, name, mx, my, s):
    v = ''
    if s['onPew']:
        xs = [p[0] for p in s['pew_px']]
        v = f"  on the pew at x {min(xs)}..{max(xs)}"
    print(f"  {tag:12} {name:13} ({mx}, {round(my, 1)})  cols={s['n']:3} "
          f"floor={s['floor']:3} hidden={s['hidden']:3} ONPEW={s['onPew']:3} "
          f"{'OK' if s['ok'] else 'FLOATS'}{v}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sweep', action='store_true',
                    help='sweep the altar mark for fully supported (x, y)')
    ap.add_argument('--json', default=None)
    a = ap.parse_args()

    out = {'when': dt.datetime.utcnow().isoformat() + 'Z',
           'tool': 'tools/lanecf/sole_span.py', 'floor': FLOOR, 'marks': {}}
    print('EVERY SOLE COLUMN, AT THE MARK THE SET STANDS IT ON')
    for m, cutname in STANDS:
        x = MARK[m]
        s = support(cutname, x, floor_at(x))
        line(m, cutname, x, floor_at(x), s)
        out['marks'][m] = {'cut': cutname, 'xy': [x, round(floor_at(x), 1)], **s}
    for who, (x, y) in FEET.items():
        cutname = {'bride': 'bride', 'groom': 'groom', 'clergyman': 'clergyman'}[who]
        s = support(cutname, x, y)
        line(who, cutname, x, y, s)
        out['marks'][who] = {'cut': cutname, 'xy': [x, y], **s}
    out['allPass'] = all(v['ok'] for v in out['marks'].values())
    print("NO SOLE STANDS ON A PEW" if out["allPass"] else "SOLES ON PEWS ABOVE")

    if a.sweep:
        print('\nTHE ALTAR MARK, SWEPT: (x, y) where every sole column is honest')
        good = []
        for x in range(650, 800):
            for y in range(470, 570):
                s = support('witnessAltar', x, y)
                if s['ok']:
                    good.append((x, y, s['floor'], s['hidden'], s['n']))
        out['sweep'] = good
        print(f'  {len(good)} fully supported (x, y) of 15000 tried')
        # group by x so the shape of the solution is readable
        by = {}
        for x, y, f, h, n in good:
            by.setdefault(x, []).append((y, f, h))
        for x in sorted(by):
            ys = [y for y, _, _ in by[x]]
            f0 = by[x][0]
            print(f'  x={x:4}  y {min(ys)}..{max(ys)}  '
                  f'(at y={f0[0]}: floor={f0[1]} hidden={f0[2]})')

    if a.json:
        with open(a.json, 'w') as f:
            json.dump(out, f, indent=1)
        print('wrote ' + a.json)
    return 0 if out['allPass'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
