#!/usr/bin/env python3
"""sole_composite.py — WHAT IS UNDER THE SOLE IN THE FRAME THE READER GETS.

sole_span.py asks the plate what it paints under each sole column and gets the
right answer to the wrong question. At the altar the witness stands at (700, 501)
on chancel stone the plate really does paint — value 94..126, floorFrac 0.893,
every sole column legal — and in the 3.2x ring lens his boots hang in mid-air,
because the stone under them is NOT WHAT THE READER SEES THERE. The bride stands
at (728, 524): she is 23 plate px NEARER the camera than he is, her gown covers
that stone from her waist down to her own hem, and she is painted BEHIND him in
the actor group. So his soles are over her gown with the pew rail a few px lower,
and nothing in the book measures it, because every existing probe reads the
bitmaps one at a time.

This composites the set the way the DOM does — plate, altar cut, bride, clergyman,
witness, pew cut over the top — and for each of the witness's own sole columns
reports the TOPMOST LAYER at the pixel just below his sole:

    pew      the foreground pew cut, or a participant painted in FRONT of him:
             the sole is hidden, which is legal
    actor    another participant's cut under a VISIBLE sole: standing on a PERSON
    onPew    the plate paints PEW FURNITURE under a visible sole and no cut covers
             it: the boot is standing on a pew, or floating over one
    floor    anything else — the sole is over painted floor

THE LAW: for every sole column, actor == 0 and onPew == 0.

WHY THE THIRD CLASS NAMES THE DEFECT AND NOT THE REMEDY. It used to be `void` —
"the plate paints neither carpet nor stone under this sole" — and that test fails
boots that are standing on perfectly good painted floor, because floor here is
more materials than any classifier knows. Measured on the shipped plate at the two
aisle marks: the witness's 9 outermost sole columns at `back` stand on the aisle's
WOODEN BOARDS (rgb 132,87,58 — hue 23.5, sat 56 %, value 132: neither the carpet
rule's hue nor the stone rule's saturation) and 12 columns at `lounged` stand on
the runner's own SHADOWED EDGE (rgb 91,26,46 — hue 341.5, and the carpet rule
wants 342.0). Both are floor; the classifier could not say so, and a lap asserting
`void == 0` therefore failed the staging for the plate's own paint. Pew furniture
is the one unambiguous mass in this picture (value < 80, hue 200..310, against
stone at 89..118 and boards at 132), so the law is stated on it — the same
decision, for the same reason, as tools/lanecf/sole_span.py.

TWO SCENES, because the marriage is not the only place four people stand. The
altar staging is where the review filed F5; the AISLE is where Norton reaches the
witness, and it is the one the depth order gets wrong — the two men's marks are
0.5 px apart on the floor line and whichever is painted second owns the other's
boots.

    python3 tools/lanecf/sole_composite.py [--depth] [--json OUT]
"""
import argparse
import datetime as dt
import json
import os

import numpy as np
from PIL import Image

from sole_span import (CUTS, FEET, ISFLOOR, MARK, PEWS_BOX, PLATE, PX_PER_M,
                       BAND, floor_at, geom, pew_class)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
LIVE = os.path.join(ROOT, 'site-deploy/living/assets')
ISPEW = pew_class(PLATE)
ALTAR = (813, 339, 286, 206)            # sets/church.js ALTAR x/y/w/h

# THE TWO STAGINGS THE BEAT ACTUALLY HOLDS, as (who, cut, mark). Both carry all
# four participants, because the bride and the clergyman are painted on every
# frame of the beat — the register law (F4) is that the reader can see all four.
#
# PAINTER ORDER IS NOT WRITTEN HERE. It is DERIVED, by sorting each scene on its
# own mark y: nearer the camera = lower mark = painted later. That is the law the
# set has to obey (sets/church.js sorts the actor group every frame), and deriving
# it here is what let this tool find the aisle defect — a static DOM order can be
# right for one staging and wrong for the other, and it was: the shipped order
# painted the groom (aisle mark y 601.1) in front of the witness (601.6), which is
# the further man over the nearer one, and 10 of his 41 sole columns landed on the
# witness's cut.
SCENES = {
    'altar': [('witness', 'witnessAltar', (MARK['altar'], floor_at(MARK['altar']))),
              ('clergyman', 'clergyman', FEET['clergyman']),
              ('bride', 'bride', FEET['bride']),
              ('groom', 'groom', FEET['groom'])],
    'aisle': [('witness', 'witness', (MARK['lounged'], floor_at(MARK['lounged']))),
              ('clergyman', 'clergyman', FEET['clergyman']),
              ('bride', 'bride', FEET['bride']),
              ('groom', 'groomBeck', (MARK['nortonMet'], floor_at(MARK['nortonMet'])))],
}


def painter_order(cast):
    """back to front: ascending mark y. Ties keep the cast's own order."""
    return sorted(cast, key=lambda c: c[2][1])


def cut_alpha(name):
    """the cut's alpha, and the plate box it is drawn in: (alpha, x0, y0, k)."""
    rel, hm, base = CUTS[name]
    a = np.asarray(Image.open(os.path.join(LIVE, rel)).convert('RGBA'))[:, :, 3]
    return a, hm * PX_PER_M / a.shape[0], base


def drawn(name, mx, my):
    a, k, base = cut_alpha(name)
    ah, aw = a.shape
    return a, k, mx - (aw * k) / 2.0, my - base * k


def alpha_at(a, k, x0, y0, px, py):
    c = int(round((px - x0) / k))
    r = int(round((py - y0) / k))
    if 0 <= r < a.shape[0] and 0 <= c < a.shape[1]:
        return int(a[r, c])
    return 0


def classify(px, py, who, layers, pew_cut):
    """what the reader has under one sole column: (px, py) is the SOLE pixel.

    A sole is legal two ways and they are not the same test. It is HIDDEN if
    something nearer than the actor covers the sole itself — the pew cut, or a
    participant painted in FRONT of him, which is what a near figure does to a far
    one's feet and reads as standing behind her. Otherwise the sole is visible and
    the pixel BELOW it has to be painted floor. A cut painted behind him that
    covers that pixel is the defect: the reader sees his boot resting on her."""
    me = [i for i, l in enumerate(layers) if l[0] == who][0]
    lx, ly = px - PEWS_BOX[0], py - PEWS_BOX[1]
    if 0 <= ly < pew_cut.shape[0] and 0 <= lx < pew_cut.shape[1] and pew_cut[ly, lx] > 16:
        return 'pew', 'pews-front.png'
    for i in range(len(layers) - 1, me, -1):            # only what is IN FRONT
        name, a, k, x0, y0 = layers[i]
        if alpha_at(a, k, x0, y0, px, py) > 16:
            return 'pew', name                          # hidden behind a nearer cut
    below = py + 1
    for i in range(len(layers) - 1, -1, -1):            # front to back
        name, a, k, x0, y0 = layers[i]
        if name == who:
            continue
        if alpha_at(a, k, x0, y0, px, below) > 16:
            return 'actor', name
    # the sole is VISIBLE and no cut is under it, so the plate answers. One row of
    # slack, as sole_span.py has: a sole's own antialiased edge is a row wide, so
    # the pixel carrying the contact can be either of two rows.
    if ISPEW[below, px] and ISPEW[min(below + 1, PLATE.shape[0] - 1), px]:
        return 'onPew', 'plate-pew'
    return 'floor', 'plate'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--depth', action='store_true',
                    help='print the group in painter order against its own marks')
    ap.add_argument('--json', default=None)
    a_ = ap.parse_args()

    pew_cut = np.asarray(Image.open(os.path.join(LIVE, 'set/church/pews-front.png'))
                         .convert('RGBA'))[:, :, 3]

    out = {'when': dt.datetime.utcnow().isoformat() + 'Z',
           'tool': 'tools/lanecf/sole_composite.py', 'scenes': {}}
    bad = 0
    for scene, cast in SCENES.items():
        order = painter_order(cast)
        layers = []
        for who, cut, (mx, my) in order:
            a, k, x0, y0 = drawn(cut, mx, my)
            layers.append((who, a, k, x0, y0))

        if a_.depth:
            print(f'THE {scene.upper()} GROUP, painter order (first = furthest back)')
            for who, cut, (mx, my) in order:
                print(f'  {who:10} mark y {my:6.1f}   {CUTS[cut][0]}')
            print('  NEARER THE CAMERA = LOWER MARK. sets/church.js has to paint '
                  'the group in this order, and it sorts every frame to do it.')

        print(f'\nEVERY SOLE COLUMN, AGAINST THE {scene.upper()} COMPOSITE')
        out['scenes'][scene] = {'order': [w for w, _, _ in order], 'soles': {}}
        for who, cut, (mx, my) in order:
            (ah, aw), k, base, bot, ground = geom(cut)
            _, _, x0, y0 = drawn(cut, mx, my)
            tally, hits = {'pew': 0, 'actor': 0, 'floor': 0, 'onPew': 0}, {}
            for c in range(aw):
                if bot[c] < ground:
                    continue
                px = int(round(x0 + c * k))
                py = int(round(y0 + bot[c] * k))        # the SOLE pixel itself
                if not (0 <= px < PLATE.shape[1] and 0 <= py + 1 < PLATE.shape[0]):
                    continue
                kind, src = classify(px, py, who, layers, pew_cut)
                tally[kind] += 1
                hits.setdefault(f'{kind}:{src}', []).append(px)
            n = sum(tally.values())
            ok = n > 0 and tally['actor'] == 0 and tally['onPew'] == 0
            bad += 0 if ok else 1
            detail = '  '.join(f'{k} x {min(v)}..{max(v)}'
                               for k, v in sorted(hits.items())
                               if k.startswith(('actor', 'onPew')))
            print(f'  {who:10} ({mx}, {round(my, 1)})  cols={n:3} '
                  f'pew={tally["pew"]:3} floor={tally["floor"]:3} '
                  f'ACTOR={tally["actor"]:3} ONPEW={tally["onPew"]:3} '
                  f'{"OK" if ok else "FLOATS"}  {detail}')
            out['scenes'][scene]['soles'][who] = {
                'mark': [mx, round(my, 1)], 'n': n, **tally, 'ok': ok,
                'where': {k: [min(v), max(v)] for k, v in hits.items()}}
    out['allPass'] = bad == 0
    print('\nNO SOLE IS OVER AN ACTOR OR A PEW, IN EITHER STAGING' if not bad
          else f'\n{bad} PARTICIPANT-FRAME(S) FLOAT IN THE COMPOSITE')
    if a_.json:
        with open(a_.json, 'w') as f:
            json.dump(out, f, indent=1)
        print('wrote ' + a_.json)
    return 0 if not bad else 1


if __name__ == '__main__':
    raise SystemExit(main())
