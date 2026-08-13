#!/usr/bin/env python3
"""stageproof_actors.py -- put a keyed actor on its real plate at its real size.

A cutout can look perfect on magenta and fall apart the instant it stands in the
set: a pink rim against the navy, facets four times too big for the diorama, a
key light from the wrong side, a figure a head taller than the door it came out
of. So the only honest test is to composite the actor where it will actually
stand, at the size actor_geom.py measured, and look at THAT.

The church gets a second, harder test the other two cannot offer. St Monica's
plate ALREADY PAINTS this bride and this groom, and the set lane shipped
knot-patch.png -- the chancel with the three inpainted away. So the generated
sprite can be stood on the painted figure's own mark over the patch and put
side by side with the painting it is replacing. If the sprite and the plate
disagree about who these people are, that proof shows it immediately.

    python3 stageproof_actors.py SET WHO ACTOR.png OUT.png
    SET: street | church | chase
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import actor_geom as G  # noqa: E402

ROOT = '/Users/samz/Documents/gaslight-remake'
BOOK = os.path.join(ROOT, 'assets/plates/book')

# where each actor is stood for its proof, per SET. x is the figure centre.
STREET_MARKS = [('at the gate', 640), ('below the bay', 760), ('at the door', 866)]
CHASE_MARKS = [('at the lit door', 663), ('mid strip', 900)]


def place(plate, actor, x, feet_y, target_h, pad=6):
    """scale the actor so its FIGURE is target_h px tall and stand it on feet_y"""
    fig_h = max(1, actor.height - pad)
    s = target_h / fig_h
    w, h = max(1, round(actor.width * s)), max(1, round(actor.height * s))
    a = actor.resize((w, h), Image.LANCZOS)
    top = round(feet_y - target_h)
    left = round(x - w / 2)
    plate.alpha_composite(a, (left, top))
    return {'x': x, 'feet_y': round(feet_y, 1), 'top_y': top, 'left': left,
            'w': w, 'h': h, 'scale': round(s, 4),
            'pct_of_frame_height': round(100.0 * target_h / plate.height, 1)}


def rim_report(actor):
    """what the matte will do to the plate: magenta left in the semi-opaque rim.

    Magenta spill reads as (R+B)/2 - G. The costume's own palette never gets
    near the ring's values, so anything high here is un-keyed backing that will
    show as a pink outline the moment the sprite sits on a navy plate.
    """
    a = np.asarray(actor).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3] / 255.0
    ex = (rgb[..., 0] + rgb[..., 2]) * 0.5 - rgb[..., 1]
    rim = (al > 0.08) & (al < 0.92)
    body = al >= 0.92
    return {
        'rim_px': int(rim.sum()),
        'rim_magenta_excess_max': round(float(ex[rim].max()) if rim.any() else 0.0, 1),
        'rim_magenta_excess_p99': round(float(np.percentile(ex[rim], 99)) if rim.any() else 0.0, 1),
        'body_magenta_excess_max': round(float(ex[body].max()) if body.any() else 0.0, 1),
    }


def palette_report(actor, plate_ref_box, set_name):
    """does the sprite's palette sit inside the plate's own?

    Compared against the region of the plate the actor will stand in, not
    against the whole plate: a night street is mostly empty navy sky and
    matching THAT would just make the actor invisible.
    """
    a = np.asarray(actor).astype(np.float32)
    m = a[..., 3] > 200
    fig = a[..., :3][m]
    plate = Image.open(os.path.join(BOOK, getattr(G, set_name.upper())['plate']))
    ref = np.asarray(plate.convert('RGB').crop(plate_ref_box)).astype(np.float32)
    ref = ref.reshape(-1, 3)
    return {
        'actor_mean_rgb': [round(float(v), 1) for v in fig.mean(0)],
        'plate_region_mean_rgb': [round(float(v), 1) for v in ref.mean(0)],
        'actor_minus_plate': [round(float(v), 1) for v in (fig.mean(0) - ref.mean(0))],
        'actor_sd': [round(float(v), 1) for v in fig.std(0)],
        'plate_region_sd': [round(float(v), 1) for v in ref.std(0)],
    }


def main():
    set_name, who, actor_path, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    actor = Image.open(actor_path).convert('RGBA')
    report = {'set': set_name, 'who': who, 'actor': os.path.abspath(actor_path),
              'actor_px': list(actor.size)}
    report['rim'] = rim_report(actor)

    if set_name == 'street':
        plate = Image.open(os.path.join(BOOK, G.STREET['plate'])).convert('RGBA')
        h = G.px_height(who, 'street')
        report['figure_px'] = round(h, 1)
        report['pxPerMetre'] = round(G.STREET['pxPerMetre'], 1)
        report['marks'] = {}
        # all three marks land on ONE plate on purpose: the point of the street
        # proof is that the same sprite reads at the gate, under the bay and at
        # the door without changing height, which only shows in a single frame.
        for label, x in STREET_MARKS:
            report['marks'][label] = place(plate, actor, x,
                                           G.street_floor_y(x), h)
        report['palette'] = palette_report(actor, (640, 400, 900, 540), 'street')
        plate.convert('RGB').save(out)

    elif set_name == 'church':
        base = Image.open(os.path.join(BOOK, G.CHURCH['plate'])).convert('RGBA')
        h = G.px_height(who, 'church')
        report['figure_px'] = round(h, 1)
        report['pxPerMetre'] = round(G.CHURCH['pxPerMetre'], 1)
        # 1) on the plate as it ships, standing on the painted figure's own mark
        mark = G.CHURCH['marks'][{'irene': 'bride', 'norton': 'groom'}[who]]
        onplate = base.copy()
        report['on_painted_plate'] = place(onplate, actor, mark[0], mark[1], h)
        onplate.convert('RGB').save(out.replace('.png', '-onplate.png'))
        # 2) over the set lane's knot-patch: the painted three lifted off, so the
        #    sprite is the only figure there and can be judged alone
        kp = G.CHURCH['knotPatch']
        patched = base.copy()
        patch = Image.open(os.path.join(BOOK, kp['file'])).convert('RGBA')
        patched.alpha_composite(patch, (kp['x'], kp['y']))
        report['over_knot_patch'] = place(patched, actor, mark[0], mark[1], h)
        patched.convert('RGB').save(out.replace('.png', '-patched.png'))
        # 3) TWIN: the sprite stood beside the painted figure it replaces
        twin = base.copy()
        report['twin_beside_painting'] = place(twin, actor, mark[0] - 150, mark[1], h)
        twin.convert('RGB').save(out.replace('.png', '-twin.png'))
        report['palette'] = palette_report(actor, (695, 332, 912, 530), 'church')

    elif set_name == 'chase':
        plate = Image.open(os.path.join(BOOK, G.CHASE['plate'])).convert('RGBA')
        report['marks'] = {}
        for label, x in CHASE_MARKS:
            u = G.chase_u_at_x(x)
            rx, ry, ppm = G.chase_at(u)
            h = G.HEIGHT_M[who] * ppm
            m = place(plate, actor, x, ry, h)
            m.update({'rail_u': round(u, 3), 'pxPerMetre': round(ppm, 1)})
            report['marks'][label] = m
        report['palette'] = palette_report(actor, (420, 300, 900, 560), 'chase')
        plate.convert('RGB').save(out)
    else:
        raise SystemExit('unknown set ' + set_name)

    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
