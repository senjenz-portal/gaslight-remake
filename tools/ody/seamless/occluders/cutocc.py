#!/usr/bin/env python3
"""
cutocc.py — cut the odyssey floor-prop OCCLUDERS from the plates, the
pews-front.png pattern (living/assets/set/church): a pixel-exact restore of
the plate's own prop, alpha-masked along the prop's silhouette, drawn LAST
so settled actors run behind it. No inpaint — the pixels are the plate's.

The five settles these serve (measured foot-burial at the ledger marks):
  1. giant-seat (760,452)  the meal clutch behind the fire ring's RIGHT lip
  2. suppliant (690,495)   the plea behind the ring's front lip
  3. scheme (640,480)      (+ bowl-offer 700,468) behind the lip's crown
  4. F.entry file (~505..521) the laden crossing behind the woodpile's crown
  5. milking (852,470)     the seated giant behind the milk tub
(The frontPen RAILS were measured and refused: a rail fence is gaps, and a
polygon cut would carry pen-interior pixels over the actor — a rail cut
needs a silhouette-grade alpha, filed for the strip lane. The sea GUNWALE
was measured and refused: every rower baseline sits 18-21 px UPSTAGE of the
inner gunwale's top edge, overlap 0 px — flat no-op.)

Deterministic: polygons are hand-surveyed plate coordinates (grid overlays
in ../_work), feathered 1.2 px. Same plate, same PNG.

Occluders are cut PER PLATE STATE they serve (the room-dim law — the same
stones are painted five times); this cuts the states the tableaux need and
`--all-states` cuts the full cave family.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
SETS = os.path.join(ROOT, 'site-deploy', 'living-odyssey', 'assets', 'set')

# ---- the surveyed silhouettes (plate px, closed polygons) ---------------
FIRERING_FRONT = [  # the ring's front + right lip band, inner rim -> outer base
    (528, 428), (534, 436), (544, 444), (558, 452), (576, 459), (598, 464),
    (620, 467), (642, 467), (662, 462), (682, 455), (700, 446), (712, 435),
    (721, 423), (728, 412),                       # inner rim, L -> R
    (733, 424), (726, 440), (717, 453), (706, 467), (694, 479), (678, 491),
    (658, 499), (636, 503), (612, 503), (590, 499), (570, 491), (552, 481),
    (538, 468), (530, 455), (526, 440),           # outer base, R -> L
]
WOODPILE_FRONT = [  # the pile's crown -> right end -> front bottoms
    (486, 528), (492, 519), (500, 512), (512, 506), (526, 502), (544, 500),
    (562, 500), (580, 501), (596, 504), (608, 508), (616, 513), (619, 521),
    (617, 540), (608, 545), (595, 547), (575, 549), (552, 550), (528, 549),
    (508, 547), (494, 543), (487, 537),
]
TUB_FRONT = [  # the milk tub by the front pen (K7/K8's cluster)
    (848, 478), (852, 468), (862, 462), (880, 458), (900, 458), (918, 462),
    (930, 468), (934, 476), (935, 492), (933, 512), (928, 529), (918, 540),
    (900, 546), (880, 546), (862, 540), (852, 528), (848, 510),
]
SHORE_STONES_FRONT = [  # the camp ring's near stone arc
    (408, 468), (418, 464), (432, 462), (448, 463), (462, 466), (468, 470),
    (468, 477), (455, 481), (438, 482), (422, 480), (410, 475),
]
SHORE_LOG_FRONT = [  # the log downstage of the fire
    (399, 492), (404, 488), (444, 487), (449, 491), (449, 503), (444, 507),
    (404, 507), (399, 503),
]
SHORE_LOG_LEFT = [  # the lower-left log, Ulysses' own seat rail
    (350, 471), (358, 467), (388, 481), (389, 496), (378, 497), (350, 482),
]

# name -> (set dir, plate file(s), polygons, ground line y = draw-order key)
CUTS = {
    'firering-front': ('cave', ['cave-shut.jpg'], [FIRERING_FRONT], 503),
    'woodpile-front': ('cave', ['cave.jpg', 'cave-shut.jpg'],
                       [WOODPILE_FRONT], 550),
    'tub-front':      ('cave', ['cave-shut.jpg'], [TUB_FRONT], 546),
    'firepit-front':  ('shore', ['shore.jpg'],
                       [SHORE_STONES_FRONT, SHORE_LOG_FRONT, SHORE_LOG_LEFT],
                       507),
}
CAVE_STATES = ['cave.jpg', 'cave-dawn.jpg', 'cave-shut.jpg',
               'cave-embers.jpg', 'cave-predawn.jpg']


def cut(name, all_states=False):
    lane, plates, polys, ground = CUTS[name]
    if all_states and lane == 'cave':
        plates = CAVE_STATES
    xs = [p[0] for poly in polys for p in poly]
    ys = [p[1] for poly in polys for p in poly]
    x0, y0 = min(xs) - 3, min(ys) - 3
    x1, y1 = max(xs) + 4, max(ys) + 4
    made = []
    for plate in plates:
        im = Image.open(os.path.join(SETS, lane, plate)).convert('RGB')
        mask = Image.new('L', im.size, 0)
        d = ImageDraw.Draw(mask)
        for poly in polys:
            d.polygon(poly, fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(1.2))
        rgba = np.dstack([np.asarray(im), np.asarray(mask)])
        out = Image.fromarray(rgba[y0:y1, x0:x1])
        state = os.path.splitext(plate)[0]
        suffix = '' if len(plates) == 1 else \
            '-' + state.replace('cave-', '').replace('cave', 'master')
        f = os.path.join(HERE, f'{name}{suffix}.png')
        out.save(f)
        made.append((f, (x0, y0), ground))
        print(f'  {os.path.basename(f)}  box [{x0},{y0},{x1-x0},{y1-y0}] '
              f'ground y={ground}  ({lane}/{plate})')
    return made


if __name__ == '__main__':
    import sys
    all_states = '--all-states' in sys.argv
    names = [a for a in sys.argv[1:] if not a.startswith('-')] or list(CUTS)
    import json
    meta = {}
    for n in names:
        for f, org, ground in cut(n, all_states):
            meta[os.path.basename(f)] = {'origin': list(org), 'ground': ground}
    with open(os.path.join(HERE, 'occluders.json'), 'w') as fp:
        json.dump(meta, fp, indent=1)
    print('-> occluders.json')
