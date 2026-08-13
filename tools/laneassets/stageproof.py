#!/usr/bin/env python3
"""stageproof.py -- put the keyed King on the real plate at the real scale.

This is the only honest style test. A cutout can look perfect on magenta and
fall apart the moment it sits on the navy plate: pink rim, wrong facet size,
wrong light direction, wrong height. So composite him where he will actually
stand and look at THAT.

Scale comes from the sibling lane's measured geometry (tools/lanea/holmes_geom):
Holmes is 245 plate-px tall for ~1.85 m, so the plate runs 132.4 px/m and the
King's 2.2 m is 291 px. The diorama is isometric, so that height is the same
anywhere on the floor -- only the floor line moves.
"""
import json
import os
import sys

from PIL import Image

sys.path.insert(0, '/Users/samz/Documents/gaslight-remake/tools/lanea')
from holmes_geom import floor_y  # noqa: E402

ROOT = '/Users/samz/Documents/gaslight-remake'
B1 = os.path.join(ROOT, 'assets/plates/beat1')
PX_PER_M = 230 / 1.85   # 230 = Holmes cutout alpha height measured by the sibling actor lane
KING_M = 2.2
KING_PX = round(PX_PER_M * KING_M)


def place(plate, actor, x, scale_px, baseline_pad=6, dy=0):
    fig_h = actor.height - baseline_pad
    s = scale_px / fig_h
    w, h = max(1, round(actor.width * s)), max(1, round(actor.height * s))
    a = actor.resize((w, h), Image.LANCZOS)
    feet = floor_y(x) + dy
    top = round(feet - scale_px)
    left = round(x - w / 2)
    plate.alpha_composite(a, (left, top))
    return {'x': x, 'feet_y': round(feet, 1), 'top_y': top,
            'left': left, 'w': w, 'h': h, 'scale': round(s, 4)}


def main():
    plate_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(B1, 'plate-door.png')
    out = sys.argv[2] if len(sys.argv) > 2 else '/tmp/stageproof.png'
    plate = Image.open(plate_path).convert('RGBA')

    masked = Image.open(os.path.join(B1, 'king-masked.png')).convert('RGBA')
    unmasked = Image.open(os.path.join(B1, 'king-unmasked.png')).convert('RGBA')
    walk = Image.open(os.path.join(B1, 'king-walk-enter.png')).convert('RGBA')
    n = 4
    cw = walk.width // n

    report = {'king_px': KING_PX, 'px_per_m': round(PX_PER_M, 1), 'marks': {}}

    # 1: the standing masked King where he addresses the room
    p1 = plate.copy()
    report['marks']['standing_masked_x700'] = place(p1, masked, 700, KING_PX)
    p1.convert('RGB').save(out.replace('.png', '-standing.png'))

    # 2: unmasked, same mark -- the flip must not move him
    p2 = plate.copy()
    report['marks']['standing_unmasked_x700'] = place(p2, unmasked, 700, KING_PX)
    p2.convert('RGB').save(out.replace('.png', '-unmasked.png'))

    # 3: the entrance walk, four frames along the path from the door
    p3 = plate.copy()
    for i, x in enumerate((450, 530, 610, 690)):
        f = walk.crop((i * cw, 0, (i + 1) * cw, walk.height))
        report['marks']['walk%d' % (i + 1)] = place(p3, f, x, KING_PX)
    p3.convert('RGB').save(out.replace('.png', '-walk.png'))

    # 4: scale sanity -- King beside Holmes, both on their floor marks
    p4 = plate.copy()
    report['marks']['beside_holmes_x680'] = place(p4, masked, 680, KING_PX)
    p4.convert('RGB').save(out.replace('.png', '-scale.png'))

    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
