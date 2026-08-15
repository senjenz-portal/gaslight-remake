#!/usr/bin/env python3
"""relight.py -- build a plate's dim variant from the master by TRANSFERRING a
painted relight, instead of shipping the painted relight itself.

WHY THIS EXISTS. Two i2i relight candidates were generated for the chase plate
with Beat I's own lighting-only instruction and its FORBIDDEN list. Both are
handsome and both FAIL platediff's structure gate:

    chase-dim-a   changed 22.73%   edge IoU 0.605   shift (0,0)  luma x0.81
    chase-dim-b   changed 28.46%   edge IoU 0.453   shift (0,0)  luma x0.72

An edge IoU near 0.5 on a pure relight means the model re-rendered rather than
relit -- in chase-dim-b the hull's facets are recut and the fog bank's silhouette
has moved. The Living Book CROSS-FADES base against dim under an inset, so any
geometry drift between them swims on screen. Confined change or rejected: both
are rejected as drop-in plates.

But the candidate still knows something the master does not: WHERE the light
should fall when the street is turned down -- lamps stay the only warm things,
stone goes cold and blue, the fog dulls. That is a LOW-FREQUENCY field, and it
survives the candidate's geometry drift. So:

    field  = blur(candidate) / blur(master)          per channel, clipped
    dim    = master * field * k

The master's every edge and facet is preserved exactly (it is multiplied, never
redrawn), and the painted relight's spatial law is adopted. This is the same
one-code-path idea tools/living/prep.py uses for the Holmes patch -- derive the
relight from the plates themselves, never from a guess at a brightness value.

k is then solved so the finished variant's own measured DIM matrix lands on the
book's established one, so both SETs dim by one law.

    python3 relight.py MASTER CANDIDATE OUT [--target 0.448,0.588,0.754]
"""
import argparse
import hashlib
import json
import os

import numpy as np
from PIL import Image, ImageFilter

SIGMA = 28.0
RATIO_CLIP = (0.12, 1.60)


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def arr(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(np.float32)


def big(p):
    return np.asarray(Image.open(p).convert('RGB')
                      .filter(ImageFilter.GaussianBlur(SIGMA))).astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('master')
    ap.add_argument('candidate')
    ap.add_argument('out')
    ap.add_argument('--target', default='0.448,0.588,0.754',
                    help='the book DIM_MATRIX the finished variant must land on')
    ap.add_argument('--json', default='')
    a = ap.parse_args()

    M, C = arr(a.master), arr(a.candidate)
    if M.shape != C.shape:
        raise SystemExit('candidate is not in plate space: %s vs %s'
                         % (C.shape, M.shape))
    bM, bC = big(a.master), big(a.candidate)
    field = np.clip(bC / np.maximum(bM, 1e-3), *RATIO_CLIP)

    L = M[..., 0] * .299 + M[..., 1] * .587 + M[..., 2] * .114
    env = L > 28                                   # the diorama, not the void

    target = np.array([float(v) for v in a.target.split(',')], np.float32)
    got = np.array([float(np.median(field[..., c][env])) for c in range(3)])
    k = target / np.maximum(got, 1e-6)
    dim = np.clip(M * field * k[None, None, :], 0, 255)

    # what the finished variant actually measures at, by the same method
    # tools/living/stage.js documents for the room: blur(dim)/blur(base)
    bD = np.asarray(Image.fromarray(dim.astype(np.uint8))
                    .filter(ImageFilter.GaussianBlur(SIGMA))).astype(np.float32)
    final = [float(np.median((bD / np.maximum(bM, 1e-3))[..., c][env]))
             for c in range(3)]

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    Image.fromarray(dim.astype(np.uint8)).save(a.out, optimize=True)

    meta = {
        'generator': 'tools/lanechase/relight.py',
        'master': {'path': os.path.abspath(a.master), 'sha256': sha(a.master)},
        'relight_source': {'path': os.path.abspath(a.candidate),
                           'sha256': sha(a.candidate),
                           'role': 'LOW-FREQUENCY LIGHTING FIELD ONLY -- its '
                                   'geometry is not used and cannot leak in'},
        'out': {'path': os.path.abspath(a.out), 'sha256': sha(a.out)},
        'method': 'dim = master * clip(blur%.0f(cand)/blur%.0f(master), %.2f, %.2f) * k'
                  % (SIGMA, SIGMA, *RATIO_CLIP),
        'fieldMedianBeforeK': [round(float(v), 4) for v in got],
        'k': [round(float(v), 4) for v in k],
        'targetDimMatrix': [round(float(v), 4) for v in target],
        'measuredDimMatrix': [round(float(v), 4) for v in final],
        'envelopeFractionOfFrame': round(float(env.mean() * 100), 2),
    }
    print(json.dumps(meta, indent=1))
    if a.json:
        with open(a.json, 'w') as f:
            json.dump(meta, f, indent=1)


if __name__ == '__main__':
    main()
