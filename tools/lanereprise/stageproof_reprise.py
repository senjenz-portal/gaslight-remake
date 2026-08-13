#!/usr/bin/env python3
"""stageproof_reprise.py -- put the keyed disguise on the real SET at the real scale.

The only honest test of a cut-out (tools/laneassets/stageproof.py's own ruling):
a figure can look perfect on magenta and fall apart the moment it sits on the
plate -- pink rim, wrong facet size, wrong key direction, wrong height. So
composite him where he will actually stand, at the height the SET's own painted
furniture says he is, and look at THAT.

SCALE, derived per SET (the sibling lanes publish no actor height):

  church  the church lane's own `handoffToActorLane.figureBoxes` ARE the
          calibration: bride [688,344,792,528] = 184 px, clergyman
          [848,328,925,510] = 182 px, and its closeLenses record confirms
          bride_pct_of_frame_h 24.0 (= 184 px of 768). A ~1.75 m adult reads
          ~183 px, so the plate runs ~104.5 px/m and Holmes' 1.87 m is 195 px.

  street  no figure is painted on this plate, so the scale comes from its own
          architecture: the front door reads 100 px (plate y 368..468) for a
          2.03 m Victorian front door, and the area railings read 55 px for
          1.11 m -- both give ~49.4 px/m, so Holmes is 92 px.

  Both SETS are isometric dioramas, so -- Beat I's law, verbatim -- actor height
  does NOT change with depth; only the floor line moves.

    python3 stageproof_reprise.py /abs/outdir
"""
import json
import os
import sys

from PIL import Image

ROOT = '/Users/samz/Documents/gaslight-remake'
BOOK = os.path.join(ROOT, 'assets/plates/book')

HOLMES_M = 1.87                       # "a tall gaunt man", 6 ft in the canon

SETS = {
    'church': {
        'plate': os.path.join(BOOK, 'church/church.jpg'),
        'px_per_m': 104.5,
        'derivation': 'church MANIFEST handoffToActorLane.figureBoxes: bride 184 px, clergyman 182 px for ~1.75 m',
        'marks': {                    # x, foot-baseline y
            'aisle': (523, 560),      # lensMarks.aisle (520,470) is the LENS; the
                                      # floor under it is the side aisle boards
            'chancel': (700, 528),    # the bride's own foot line (figureBoxes bride y1)
        },
    },
    'street': {
        'plate': os.path.join(BOOK, 'street/street.png'),
        'px_per_m': 49.4,
        'derivation': 'front door 100 px / 2.03 m and area railings 55 px / 1.11 m',
        'marks': {
            'station': (556, 516),    # beside the chalk ring at the lamp's foot
            'window': (700, 540),     # under the lit bay, where Watson takes his post
        },
    },
}


def place(plate, actor, x, feet_y, height_px, pad=6):
    fig_h = actor.height - pad
    s = height_px / fig_h
    w, h = max(1, round(actor.width * s)), max(1, round(actor.height * s))
    a = actor.resize((w, h), Image.LANCZOS)
    top = round(feet_y - height_px)
    left = round(x - w / 2)
    plate.alpha_composite(a, (left, top))
    return {'x': x, 'feet_y': feet_y, 'top_y': top, 'left': left,
            'w': w, 'h': h, 'scale': round(s, 4), 'render_height_px': height_px}


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/lanereprise/stageproof'
    raw = sys.argv[2] if len(sys.argv) > 2 else None
    os.makedirs(out, exist_ok=True)
    rep = {'holmes_m': HOLMES_M, 'sets': {}}

    plan = [
        ('church', 'holmes-groom-b', ['aisle', 'chancel']),
        ('street', 'holmes-clergyman-b', ['station', 'window']),
    ]
    for set_name, actor_file, marks in plan:
        cfg = SETS[set_name]
        hpx = round(cfg['px_per_m'] * HOLMES_M)
        plate = Image.open(cfg['plate']).convert('RGBA')
        actor = Image.open(os.path.join(raw, 'matte', actor_file + '.png')).convert('RGBA')
        placed = {}
        for m in marks:
            x, y = cfg['marks'][m]
            placed[m] = place(plate, actor, x, y, hpx)
        p = os.path.join(out, 'stageproof-%s.png' % set_name)
        plate.convert('RGB').save(p)
        # a 2x read on the first mark, because 92 px is not judgeable at 100%
        x, y = cfg['marks'][marks[0]]
        box = (max(0, x - 190), max(0, y - hpx - 60), min(1408, x + 190), min(768, y + 60))
        plate.crop(box).resize(((box[2] - box[0]) * 2, (box[3] - box[1]) * 2),
                               Image.LANCZOS).convert('RGB').save(
            os.path.join(out, 'stageproof-%s-2x.png' % set_name))
        rep['sets'][set_name] = {'actor': actor_file, 'px_per_m': cfg['px_per_m'],
                                 'derivation': cfg['derivation'],
                                 'render_height_px': hpx, 'placed': placed,
                                 'proof': p}
    with open(os.path.join(out, 'stageproof.json'), 'w') as f:
        json.dump(rep, f, indent=1)
    print(json.dumps(rep, indent=1))


if __name__ == '__main__':
    main()
