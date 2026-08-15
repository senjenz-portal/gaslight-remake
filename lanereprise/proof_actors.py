#!/usr/bin/env python3
"""proof_actors.py -- stage the shipped disguises on the real SETs, and measure
the two things a REPRISE actor can silently get wrong.

  1. THE STAGE PROOF. A cut-out can look perfect on magenta and fall apart on the
     plate: key spill, wrong facet size, wrong key direction, wrong height. So
     composite him where he actually stands, at the height the SET's own painted
     furniture says he is (see stageproof_reprise.py for both derivations), and
     look at THAT.
  2. THE SWAP PROOF. A derived state has to be swappable for the idle without the
     figure jumping. Measured as the shared-canvas baseline delta plus the
     centroid delta of the pixels the two states have in common - which is
     bounded by the part of him that did not change.

    python3 proof_actors.py OUTDIR
"""
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = '/Users/samz/Documents/gaslight-remake'
A = os.path.join(ROOT, 'assets/plates/book/actors')
BOOK = os.path.join(ROOT, 'assets/plates/book')

HOLMES_M = 1.87
SETS = {
    'church': {'plate': os.path.join(BOOK, 'church/church.jpg'), 'px_per_m': 104.5},
    'street': {'plate': os.path.join(BOOK, 'street/street.png'), 'px_per_m': 49.4},
}
# x, foot-baseline y, actor file, optional strip cell
PLAN = {
    # the side-aisle floor line, read off the plate's own red runner: the aisle
    # rises to the chancel, so only the foot line moves (isometric, Beat I's law)
    'church': [
        (470, 590, 'holmes-groom.png', None),
        (545, 568, 'holmes-groom-walk.png', 0),
        (640, 548, 'holmes-groom-walk.png', 2),
        (690, 532, 'holmes-groom-altar.png', None),
    ],
    'street': [
        (556, 516, 'holmes-clergyman.png', None),
        (700, 541, 'holmes-clergyman-signal.png', None),
    ],
}


def cell(img, i, n=4):
    w = img.width // n
    return img.crop((i * w, 0, (i + 1) * w, img.height))


def place(plate, actor, x, feet_y, h_px, pad=6):
    s = h_px / (actor.height - pad)
    w, h = max(1, round(actor.width * s)), max(1, round(actor.height * s))
    a = actor.resize((w, h), Image.LANCZOS)
    plate.alpha_composite(a, (round(x - w / 2), round(feet_y - h_px)))
    return {'x': x, 'feet_y': feet_y, 'w': w, 'h': h, 'scale': round(s, 4)}


def swap_delta(p, q):
    """How far the figure moves when one state is swapped for the other."""
    aa = np.asarray(Image.open(p).convert('RGBA'))[..., 3] > 128
    bb = np.asarray(Image.open(q).convert('RGBA'))[..., 3] > 128
    both = aa & bb
    ay, ax = np.nonzero(aa)
    by, bx = np.nonzero(bb)
    # the legs are the part of him that never changes in either derived state, so
    # their centroid is the honest "did he shift" probe
    legs = slice(int(ay.max()) - 260, int(ay.max()) + 1)
    la, lb = aa[legs], bb[legs]
    ca = [float(np.nonzero(la)[i].mean()) for i in (1, 0)]
    cb = [float(np.nonzero(lb)[i].mean()) for i in (1, 0)]
    return {
        'canvas_a': list(Image.open(p).size), 'canvas_b': list(Image.open(q).size),
        'baseline_delta_px': int(ay.max() - by.max()),
        'shared_alpha_pct_of_a': round(100.0 * both.sum() / max(1, aa.sum()), 1),
        'leg_centroid_delta_px': [round(ca[0] - cb[0], 2), round(ca[1] - cb[1], 2)],
        'head_top_delta_px': int(ay.min() - by.min()),
        'left_edge_delta_px': int(ax.min() - bx.min()),
        'shared_px': int(both.sum()),
    }


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/lanereprise/proof'
    os.makedirs(out, exist_ok=True)
    rep = {'holmes_m': HOLMES_M, 'sets': {}, 'swaps': {}}
    for name, cfg in SETS.items():
        h_px = round(cfg['px_per_m'] * HOLMES_M)
        plate = Image.open(cfg['plate']).convert('RGBA')
        placed = []
        for x, y, f, ci in PLAN[name]:
            im = Image.open(os.path.join(A, f)).convert('RGBA')
            if ci is not None:
                im = cell(im, ci)
            placed.append(dict(actor=f, cell=ci, **place(plate, im, x, y, h_px)))
        p = os.path.join(out, 'proof-%s.png' % name)
        plate.convert('RGB').save(p)
        x, y = PLAN[name][0][0], PLAN[name][0][1]
        box = (max(0, x - 230), max(0, y - h_px - 70), min(1408, x + 430), min(768, y + 60))
        plate.crop(box).resize(((box[2] - box[0]) * 2, (box[3] - box[1]) * 2),
                               Image.LANCZOS).convert('RGB').save(
            os.path.join(out, 'proof-%s-2x.png' % name))
        rep['sets'][name] = {'px_per_m': cfg['px_per_m'], 'render_height_px': h_px,
                             'placed': placed, 'proof': p}
    for a_, b_ in (('holmes-clergyman.png', 'holmes-clergyman-signal.png'),
                   ('holmes-groom.png', 'holmes-groom-altar.png')):
        rep['swaps'][a_ + ' -> ' + b_] = swap_delta(os.path.join(A, a_), os.path.join(A, b_))
    with open(os.path.join(out, 'proof.json'), 'w') as f:
        json.dump(rep, f, indent=1)
    print(json.dumps(rep, indent=1))


if __name__ == '__main__':
    main()
