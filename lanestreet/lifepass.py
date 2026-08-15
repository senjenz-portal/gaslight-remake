#!/usr/bin/env python3
"""lifepass.py -- STAGE 2b: what makes the street plate ALIVE, and its marks.

Three products, none of them a repaint:

  1. THE CHALK RING, three states (off / armed / locked). CONTENT-full.md sec
     6.2 lists it as a free layer of this SET and sec 6.4 makes it gate `station`
     ("click the chalk ring - take your station at the open window"). It is
     AUTHORED here rather than generated, for the reference's own reason: it is
     "opaque cream chalk, zero text, plus one soft halo so it survives the
     cobbles" -- a shape with a required size and a required position, which an
     image model cannot be asked for and a circle-drawing routine gets exactly
     right. `off` ships no file: it is the absence of the layer.

  2. THE EMISSIVE TABLE. The room's life pass (stage.js EMIS) is four painted
     lights that only ever BREATHE -- they are never drawn, only pulsed, so the
     plate keeps owning the picture. The street's are measured out of the plate
     the same way: each entry's centre and radius come from the connected warm
     components curate.py found, not from taste.

  3. THE MARKS the runtime needs in plate pixels: the two gate targets
     (`window`, `station`), the plume mouth, the reveal box behind the glass,
     and the floor line actors stand on.

    python3 lifepass.py PLATE.png OUTDIR
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# ---- the ground plane, read off the plate's own paving ------------------
# The pavement's far edge runs (478,452) -> (900,524): slope 0.171, i.e. the
# street direction tilts 9.7 deg below horizontal. A circle chalked on that
# plane projects to an ellipse with its major axis along the street.
GROUND_SLOPE = 0.171
PX_PER_M_X = 81.0          # paving slab ~0.9 m reads ~73 px wide
RING_AT = (543, 497)       # the clear flagstone at the gas lamp's foot
RING_R_M = 0.52            # the reference's TorusGeometry radius
RING_TUBE_M = 0.048
ISO_SQUASH = 0.45          # ground y-scale / x-scale, from the slabs

CHALK = (217, 207, 174)    # the reference's 0xd9cfae
GLOW = (228, 214, 174)     # 0xe4d6ae

# ---- the emissives, centres and radii from curate.py's components -------
EMIS = [
    # id, centre, radius, rgb, base alpha, breath period, breath amplitude
    ('lamp', (479, 318), 118, '255,196,96', 0.155, 6.4, 0.30,
     'the gas standard: halo centre is slice_street.py\'s fitted bloom centre'),
    ('bay', (753, 372), 92, '255,186,96', 0.130, 5.2, 0.28,
     'the sitting-room fire behind the long windows; bbox [691,299,815,433]'),
    ('fanlight', (880, 349), 28, '255,206,126', 0.170, 4.4, 0.42,
     'the semicircular light over the front door'),
    ('spill', (745, 539), 96, '255,178,104', 0.085, 7.1, 0.34,
     'the bay\'s warm patch on the pavement; bbox [608,458,842,510] + [647,506,818,568]'),
    ('wet', (757, 588), 58, '255,168,96', 0.070, 8.3, 0.40,
     'the same light again in the wet cobbles; bbox [712,570,805,606]'),
    ('upper', (759, 212), 44, '255,150,80', 0.000, 3.1, 0.55,
     'the first-floor window: DARK in the base and dim states (alpha 0), and '
     'the channel the smoke state drives hot. It exists here so the ruse has a '
     'light to turn on rather than a light to invent'),
]

MARKS = {
    'window': {'at': [763, 373], 'r': 60,
               'what': 'gate target, Beat VI: the lit sitting-room bay. The '
                       'reference anchors this target on `story-irene` herself '
                       '- she stands behind that glass - so the target IS the '
                       'reveal surface',
               'glassPoly': [[696, 326], [722, 316], [766, 312], [808, 322],
                             [808, 430], [766, 436], [722, 430], [696, 422]],
               'litPanes': 'x 724-803 in three columns (724-741, 744-762, '
                           '780-803); the left return pane 698-722 is in shadow'},
    'station': {'at': list(RING_AT), 'r': 46,
                'what': 'gate target, Beat V: the chalk ring on the flagstone '
                        'at the gas lamp\'s foot'},
    'plume': {'at': [759, 212], 'box': [727, 168, 790, 262],
              'what': 'the first-floor window, the plume\'s mouth (sec 6.6 t+1.35)'},
    'reveal': {'box': [698, 318, 806, 430], 'crossX': [721, 786],
               'pxPerMetre': [36.0, 53.3], 'backlight': 'reveal-back.png',
               'what': 'the box a silhouette must live in, INSIDE the glass and '
                       'BEHIND layer5-bayglass.png. The reference crosses her '
                       'from the west edge of the glass to the panel side, '
                       'which is left -> right here: world 2.25 -> 4.05 of a '
                       'glass spanning 1.6 -> 4.6, i.e. plate x 721 -> 786'},
    'floorLine': {'points': [[400, 498], [478, 458], [560, 470], [640, 486],
                             [700, 496], [760, 506], [830, 516], [900, 524]],
                  'what': 'where the built street meets the pavement: the line '
                          'a sprite\'s foot baseline is pinned to. Same '
                          'polyline slice_street.py cut the base band on, so '
                          'an actor cannot stand in front of his own ground'},
}


def ring_layer(state):
    """One chalk ring, as a cropped RGBA layer + its plate-space placement."""
    rx = RING_R_M * PX_PER_M_X
    ry = rx * ISO_SQUASH
    tube = max(2.0, RING_TUBE_M * PX_PER_M_X)
    glow_r = rx * (1.55 if state == 'armed' else 1.15)
    pad = int(glow_r + 12)
    W = H = pad * 2
    cx = cy = pad
    sup = 4                                   # supersample, then box-filter down
    im = Image.new('RGBA', (W * sup, H * sup), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # the halo first, so the chalk sits on top of it
    g = Image.new('L', (W * sup, H * sup), 0)
    ImageDraw.Draw(g).ellipse([(cx - glow_r) * sup, (cy - glow_r * ISO_SQUASH) * sup,
                              (cx + glow_r) * sup, (cy + glow_r * ISO_SQUASH) * sup],
                             fill=255)
    g = g.filter(ImageFilter.GaussianBlur(glow_r * sup * 0.30))
    ga = np.asarray(g).astype(np.float32) / 255.0
    ga *= 0.13 if state == 'armed' else 0.20
    d.ellipse([(cx - rx) * sup, (cy - ry) * sup, (cx + rx) * sup, (cy + ry) * sup],
              outline=CHALK + (255,), width=int(tube * sup))
    a = np.asarray(im).astype(np.float32)
    # composite: chalk over halo
    halo_rgb = np.zeros_like(a[..., :3])
    for c, v in enumerate(GLOW):
        halo_rgb[..., c] = v
    ka = a[..., 3:4] / 255.0
    rgb = a[..., :3] * ka + halo_rgb * (1 - ka)
    alpha = np.clip(a[..., 3] / 255.0 * (0.88 if state == 'armed' else 1.0)
                    + ga * (1 - a[..., 3] / 255.0), 0, 1)
    out = np.zeros((H * sup, W * sup, 4), np.uint8)
    out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[..., 3] = (alpha * 255).astype(np.uint8)
    im = Image.fromarray(out).resize((W, H), Image.BOX)
    # shear the whole stamp so the ring lies along the street's slope
    im = im.transform((W, H + int(abs(GROUND_SLOPE) * W)), Image.AFFINE,
                      (1, 0, 0, -GROUND_SLOPE, 1, GROUND_SLOPE * W / 2),
                      resample=Image.BICUBIC)
    x0 = int(RING_AT[0] - W / 2)
    y0 = int(RING_AT[1] - H / 2 - abs(GROUND_SLOPE) * W / 2)
    return im, x0, y0


def main():
    plate, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    res = {'plate': list(Image.open(plate).size),
           'generator': 'tools/lanestreet/lifepass.py',
           'groundPlane': {'slope': GROUND_SLOPE, 'pxPerMetreX': PX_PER_M_X,
                           'isoSquash': ISO_SQUASH,
                           'derivation': 'pavement far edge (478,452)->(900,524); '
                                         'paving slab ~0.9 m reads ~73 px wide'},
           'chalkRing': {'states': ['off', 'armed', 'locked'],
                         'off': 'no layer - the absence of the file',
                         'radiusM': RING_R_M, 'tubeM': RING_TUBE_M,
                         'files': {}},
           'emissives': [], 'marks': MARKS}

    for state in ('armed', 'locked'):
        im, x0, y0 = ring_layer(state)
        fn = 'chalk-%s.png' % state
        im.save(os.path.join(outdir, fn), optimize=True)
        res['chalkRing']['files'][state] = {
            'file': fn, 'x': x0, 'y': y0, 'w': im.size[0], 'h': im.size[1],
            'bytes': os.path.getsize(os.path.join(outdir, fn))}
        print('%-14s %4d,%4d %3dx%-3d %5d B' % (fn, x0, y0, im.size[0], im.size[1],
                                                os.path.getsize(os.path.join(outdir, fn))))

    for (i, at, r, rgb, al, per, amp, note) in EMIS:
        res['emissives'].append({'id': i, 'at': list(at), 'r': r, 'rgb': rgb,
                                 'a': al, 'per': per, 'amp': amp, 'note': note})
    res['mist'] = {'layer': 'layers/mist.png', 'origin': [0, 470],
                   'blend': 'screen', 'driftPxPerSec': 3.2, 'per': 11.0,
                   'note': 'the damp. Beat I had no weather; this street is wet '
                           'in every canon description of it'}
    with open(os.path.join(outdir, 'life.json'), 'w') as f:
        json.dump(res, f, indent=1)
    print('emissives %d, marks %d -> %s/life.json'
          % (len(res['emissives']), len(MARKS), outdir))


if __name__ == '__main__':
    main()
