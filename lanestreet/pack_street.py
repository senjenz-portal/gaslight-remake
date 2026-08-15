#!/usr/bin/env python3
"""pack_street.py -- crop, zero and PROVE the street's parallax layers.

Same packing discipline as tools/lanea/pack_layers.py: crop each layer to its
alpha bbox, zero the RGB under alpha=0 so PNG deflate has nothing to chew on,
emit a placement manifest in plate pixels.

It adds the step the room's packer did not have: a RECOMPOSITION PROOF. The
layers are composited back in draw order over the void and differenced against
the source plate. A cut that loses or double-counts a pixel is a cut that will
show a seam the first time the camera moves, and the only honest way to know is
to put it back together.

    python3 pack_street.py RAWDIR DESTDIR SRCPLATE.png
"""
import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image

# draw order, far -> near; halo is screen-blended, mist is screen-blended and
# additive-only, bayglass is drawn AFTER the actors (see slice_street.py)
BANDS = [('terrace', 'layer1-terrace.png'), ('villa', 'layer2-villa.png'),
         ('base', 'layer3-base.png'), ('lamp', 'layer4-lamp.png')]
OVERLAY = [('bayglass', 'layer5-bayglass.png')]
STATIC = [('void.png', 'layer0-void.png'), ('halo.png', 'layer6-halo.png'),
          ('mist.png', 'layer7-mist.png')]


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def main():
    raw, dest, srcp = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(dest, exist_ok=True)
    src = json.load(open(os.path.join(raw, 'manifest.json')))
    W, H = src['source']['size']
    out = {'plate': [W, H], 'layers': [], 'overlays': [], 'static': {},
           'halo': src['analysis']['halo'], 'mist': src['analysis']['mist'],
           'bayGlass': src['analysis']['bayGlass'],
           'drawOrder': src['drawOrder'],
           'sourceManifest': os.path.join(raw, 'manifest.json')}

    comp = np.asarray(Image.open(os.path.join(raw, 'layer0-void.png'))
                      .convert('RGB')).astype(np.float32)

    def pack(key, name, into):
        im = Image.open(os.path.join(raw, name)).convert('RGBA')
        a = np.asarray(im).copy()
        alpha = a[..., 3]
        ys, xs = np.where(alpha > 0)
        pad = 2
        x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + 1 + pad)
        y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + 1 + pad)
        a[alpha == 0] = 0
        crop = Image.fromarray(a[y0:y1, x0:x1])
        fn = '%s.png' % key
        crop.save(os.path.join(dest, fn), optimize=True)
        b = os.path.getsize(os.path.join(dest, fn))
        into.append({'id': key, 'file': fn, 'x': int(x0), 'y': int(y0),
                     'w': int(x1 - x0), 'h': int(y1 - y0), 'bytes': b,
                     'sha256': sha(os.path.join(dest, fn))})
        print('%-9s %4d,%4d %4dx%-4d %6d KB' % (key, x0, y0, x1 - x0, y1 - y0,
                                                b // 1024))
        return a.astype(np.float32)

    for key, name in BANDS:
        a = pack(key, name, out['layers'])
        k = (a[..., 3:4] / 255.0)
        comp = comp * (1 - k) + a[..., :3] * k
    for key, name in OVERLAY:
        pack(key, name, out['overlays'])

    for fn, name in STATIC:
        im = Image.open(os.path.join(raw, name))
        im.save(os.path.join(dest, fn), optimize=True)
        b = os.path.getsize(os.path.join(dest, fn))
        out['static'][fn] = {'bytes': b, 'sha256': sha(os.path.join(dest, fn)),
                             'size': list(im.size)}
        print('%-9s %s %6d KB' % (fn, im.size, b // 1024))

    # ---- the recomposition proof -------------------------------------
    halo = np.asarray(Image.open(os.path.join(raw, 'layer6-halo.png'))
                      .convert('RGB')).astype(np.float32)
    hx, hy = src['analysis']['halo']['cropOrigin']
    hh, hw = halo.shape[:2]
    comp[hy:hy + hh, hx:hx + hw] += halo          # the bloom goes back, additively
    plate = np.asarray(Image.open(srcp).convert('RGB')).astype(np.float32)
    err = np.abs(np.clip(comp, 0, 255) - plate)
    proof = {'meanAbsErr': round(float(err.mean()), 3),
             'p999AbsErr': round(float(np.percentile(err, 99.9)), 2),
             'maxAbsErr': round(float(err.max()), 2),
             'pxOver8': int((err.max(axis=2) > 8).sum()),
             'note': 'void + terrace + villa + base + lamp, then the halo added '
                     'back, differenced against the source plate'}
    out['recompositionProof'] = proof
    print('proof: mean %.3f  p99.9 %.2f  max %.2f  px>8 %d'
          % (proof['meanAbsErr'], proof['p999AbsErr'], proof['maxAbsErr'],
             proof['pxOver8']))
    vis = plate.copy()
    m = err.max(axis=2) > 8
    vis[m] = vis[m] * 0.3 + np.array([255, 40, 40], np.float32) * 0.7
    Image.fromarray(vis.astype(np.uint8)).save(os.path.join(dest, 'proof-residual.png'))

    json.dump(out, open(os.path.join(dest, 'layers.json'), 'w'), indent=1)
    print('->', dest)


if __name__ == '__main__':
    main()
