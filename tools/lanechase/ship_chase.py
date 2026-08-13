#!/usr/bin/env python3
"""ship_chase.py -- land the chase SET under assets/plates/book/chase/.

Three jobs, in tools/living/prep.py's spirit (one code path, every number
derived from the plates themselves):

 1. THE DIM COMPANIONS. Anything cut out of the plate is PLATE PIXELS, so it has
    to dim when the plate dims -- Beat I ships chair.png/chair-dim.png and
    holmes-patch/holmes-patch-dim for exactly this reason. The companions here
    are built by keeping the MASTER's alpha (so the two states are pixel-aligned
    by construction and can cross-fade) and taking RGB from the dim plate. The
    door-out patch is re-derived against the dim plate by the same mean/std
    transfer, off the dim plate's own unlit doors.

 2. PACKING. tools/lanea/pack_layers.py's rule: crop each layer to its alpha
    bbox, zero the RGB under alpha=0 so deflate has nothing to chew on, and
    record the placement so the page can put it back exactly.

 3. THE MANIFEST. Every file with its bytes/size/sha, plus the two things a
    later lane cannot re-derive by looking at the picture: the RAIL and the
    measured DIM matrix.
"""
import hashlib
import json
import os
import sys
import time

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chase_geom as G  # noqa: E402

ROOT = '/Users/samz/Documents/gaslight-remake'
SRC = os.path.join(ROOT, 'assets/raw/book-chase/layers')
DEST = os.path.join(ROOT, 'assets/plates/book/chase')
MASTER = os.path.join(DEST, 'chase-master.png')
DIM = os.path.join(DEST, 'chase-dim-master.png')

MAN = {'lane': 'lanechase (PLATE lane, SET `chase`, Beat III THE PURSUIT)',
       'generated_at': time.strftime('%Y-%m-%dT%H:%M:%S'),
       'generator': 'tools/lanechase/ship_chase.py',
       'plate_space': {'size': [1408, 768]},
       'files': {}}


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()[:16]


def record(rel, note='', extra=None):
    p = os.path.join(DEST, rel)
    im = Image.open(p)
    e = {'bytes': os.path.getsize(p), 'size': list(im.size), 'mode': im.mode,
         'sha256': sha(p), 'note': note}
    if extra:
        e.update(extra)
    MAN['files'][rel] = e
    print('  %-24s %8d B  %-11s %s' % (rel, e['bytes'], str(im.size), im.mode))


def jpg(src, rel, q=92, note=''):
    Image.open(src).convert('RGB').save(os.path.join(DEST, rel), 'JPEG',
                                        quality=q, optimize=True)
    record(rel, note)


def pack(im, rel, note='', pad=2):
    """crop to alpha bbox, zero RGB under alpha=0, record the placement"""
    a = np.asarray(im.convert('RGBA')).copy()
    al = a[..., 3]
    ys, xs = np.nonzero(al > 0)
    if not len(xs):
        raise SystemExit('empty layer ' + rel)
    x0, x1 = max(0, xs.min() - pad), min(a.shape[1], xs.max() + 1 + pad)
    y0, y1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + 1 + pad)
    a[al == 0] = 0
    Image.fromarray(a[y0:y1, x0:x1]).save(os.path.join(DEST, rel), optimize=True)
    record(rel, note, {'x': int(x0), 'y': int(y0)})


def main():
    os.makedirs(DEST, exist_ok=True)
    m = np.asarray(Image.open(MASTER).convert('RGB')).astype(np.float32)
    d = np.asarray(Image.open(DIM).convert('RGB')).astype(np.float32)

    print('plates:')
    jpg(MASTER, 'chase.jpg', 92,
        'base: the empty strip, quiet night. NO vehicles and NO figures are '
        'painted in -- the three rigs are sprites that translate along the rail.')
    jpg(DIM, 'chase-dim.jpg', 92,
        'the painted relight an inset dims the world to. Beat III raises no '
        'inset today; the variant is the SET contract (CONTENT-full 6.2).')
    record('chase-master.png', 'lossless master; chase.jpg is its q92 encode')
    record('chase-dim-master.png', 'lossless master of the relight')

    print('free layers:')
    for f, note in (
        ('halos.png', 'all five blooms in one screen-blended breath layer'),
        ('void.png', 'the fitted backdrop, for a layer that needs to sit under '
                     'everything without sampling the plate'),
    ):
        Image.open(os.path.join(SRC, f)).save(os.path.join(DEST, f), optimize=True)
        record(f, note)
    for s in ('lamp1', 'lamp2', 'lamp3', 'lamp4', 'door'):
        fn = 'glow-%s.png' % s
        Image.open(os.path.join(SRC, fn)).save(os.path.join(DEST, fn), optimize=True)
        record(fn, 'one source breathing alone; screen-blend, additive')
    pack(Image.open(os.path.join(SRC, 'fog.png')).convert('RGBA'), 'fog.png',
         'the fog bank as a drifting card, clipped to the diorama envelope')
    # fog.png is already cropped by the slicer; keep its origin
    MAN['files']['fog.png']['x'] = 934
    MAN['files']['fog.png']['y'] = 52

    print('parallax bands:')
    for b, note in (('terrace', 'houses, pavement and lamps 1/3/4 -- above the kerb'),
                    ('road', 'the cobbled roadway; the rigs ride ON this band'),
                    ('hull', 'the faceted rock below the road`s outer edge')):
        pack(Image.open(os.path.join(SRC, 'band-%s.png' % b)), 'band-%s.png' % b, note)

    print('cutouts + their dim companions:')
    # lamp 2: master alpha, RGB from each plate
    l2 = np.asarray(Image.open(os.path.join(SRC, 'lamp2-front.png'))).copy()
    x0, y0, x1, y1 = G.LAMP2_BOX
    pack(Image.fromarray(l2), 'lamp2-front.png',
         'THE ONLY FOREGROUND OCCLUDER ON THE STRIP. Draw AFTER the rigs: the '
         'plate paints this lamp standing in the roadway, so the pursuit passes '
         'behind it. Pixel-exact restore of the plate, so no inpaint is needed.')
    MAN['files']['lamp2-front.png']['x'] = x0 + MAN['files']['lamp2-front.png']['x']
    MAN['files']['lamp2-front.png']['y'] = y0 + MAN['files']['lamp2-front.png']['y']
    l2d = l2.copy()
    l2d[..., :3] = np.clip(d[y0:y1, x0:x1], 0, 255).astype(np.uint8)
    pack(Image.fromarray(l2d), 'lamp2-front-dim.png',
         'the same lamp under the painted relight -- master alpha, dim RGB, so '
         'the two states are pixel-aligned and can cross-fade')
    MAN['files']['lamp2-front-dim.png']['x'] = x0 + MAN['files']['lamp2-front-dim.png']['x']
    MAN['files']['lamp2-front-dim.png']['y'] = y0 + MAN['files']['lamp2-front-dim.png']['y']

    # door-out, re-derived against each plate
    dx0, dy0, dx1, dy1 = G.DOOR_OUT_BOX
    src_alpha = np.asarray(Image.open(os.path.join(SRC, 'door-out.png')))[..., 3]

    def door_out(plate, rel, note):
        lit = plate[dy0:dy1, dx0:dx1]
        ref = np.concatenate([plate[b[1]:b[3], b[0]:b[2]].reshape(-1, 3)
                              for b in G.UNLIT_DOOR_SAMPLES])
        rm, rs = ref.mean(axis=0), ref.std(axis=0)
        lm, ls = lit.reshape(-1, 3).mean(axis=0), lit.reshape(-1, 3).std(axis=0)
        k = np.clip(rs / np.maximum(ls, 1e-6), 0.25, 1.6)
        out = np.clip((lit - lm) * k + rm, 0, 255).astype(np.uint8)
        o = np.dstack([out, src_alpha])
        Image.fromarray(o).save(os.path.join(DEST, rel), optimize=True)
        record(rel, note, {'x': dx0, 'y': dy0,
                           'unlitMeanRgb': [round(float(v), 1) for v in rm]})

    door_out(m, 'door-out.png',
             'Briony Lodge with its light OUT. mean/std transfer onto the tone '
             'of this terrace`s own three unlit doors; the box takes the light '
             'spill on the steps and flags with it.')
    door_out(d, 'door-out-dim.png', 'the same, derived against the dim plate')

    # ---- the two things a later lane cannot read off the picture ----------
    sl = json.load(open(os.path.join(SRC, 'manifest.json')))
    rl = json.load(open(os.path.join(ROOT, 'assets/raw/book-chase/master/relight.json')))
    MAN['rail'] = sl['analysis']['rail']
    MAN['geometry'] = sl['geometry']
    MAN['dim'] = {'measuredDimMatrix': rl['measuredDimMatrix'],
                  'bookDimMatrix': rl['targetDimMatrix'],
                  'method': rl['method'],
                  'note': 'blur(dim)/blur(base) medians on the diorama envelope, '
                          'the same measure stage.js documents for the room'}
    MAN['marks'] = {
        'door': [G.DOOR[0], G.DOOR[1]],
        'lamps': [[l[0], l[1]] for l in G.LAMPS],
        'railEnds': [[G.RAIL_X0, round(G.rail_at_x(G.RAIL_X0), 1)],
                     [G.RAIL_X1, round(G.rail_at_x(G.RAIL_X1), 1)]],
    }
    with open(os.path.join(DEST, 'MANIFEST.json'), 'w') as f:
        json.dump(MAN, f, indent=1)
    tot = sum(v['bytes'] for v in MAN['files'].values())
    print('\n%d files, %.2f MB -> %s' % (len(MAN['files']), tot / 1e6, DEST))


if __name__ == '__main__':
    main()
