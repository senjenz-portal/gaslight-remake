#!/usr/bin/env python3
"""cutpair.py -- cut the crew-canonical pair apart into two singles ON NAVY.

The pair ships as one JPEG on a flat #1a2038-ish navy field. Downstream wants
two separate i2i inputs and two matted stand singles, each still on the flat
navy field (the matte tool samples its backing from the border ring, so the
cut must keep a clean ring). Method:

  1. distance-from-backing column profile (backing = median of border ring);
  2. figures = the two widest on-runs; the cut line = the gap between them;
  3. each figure re-centred on a fresh flat-navy canvas at the ORIGINAL
     canvas height, feet kept at their original y (baseline preserved).
"""
import json
import sys

import numpy as np
from PIL import Image

SRC = '/Users/samz/Documents/gaslight-remake/assets/plates/odyssey/actors/crew-canonical.png'
OUT_A = '/tmp/ody-poses/crew-a-src.png'
OUT_B = '/tmp/ody-poses/crew-b-src.png'

im = Image.open(SRC).convert('RGB')
a = np.asarray(im).astype(np.float32)
h, w = a.shape[:2]
r = 12
ring = np.concatenate([a[:r].reshape(-1, 3), a[-r:].reshape(-1, 3),
                       a[:, :r].reshape(-1, 3), a[:, -r:].reshape(-1, 3)])
bg = np.median(ring, axis=0)
d = np.sqrt(((a - bg) ** 2).sum(axis=2))
on = (d > 40).sum(axis=0) > 4          # columns with real figure pixels

runs, s = [], None
for i, v in enumerate(on):
    if v and s is None:
        s = i
    elif not v and s is not None:
        runs.append((s, i)); s = None
if s is not None:
    runs.append((s, w))
runs = sorted(runs, key=lambda x: x[0] - x[1])[:2]   # two widest
runs = sorted(runs, key=lambda x: x[0])              # left first
assert len(runs) == 2, runs

meta = {'backing_rgb': [round(float(v), 1) for v in bg], 'runs': runs}
navy = tuple(int(round(v)) for v in bg)
for (x0, x1), out, tag in [(runs[0], OUT_A, 'A-ochre'), (runs[1], OUT_B, 'B-slate')]:
    pad = 24
    x0p, x1p = max(0, x0 - pad), min(w, x1 + pad)
    fig = im.crop((x0p, 0, x1p, h))
    canvas = Image.new('RGB', (max(640, fig.width + 2 * pad), h), navy)
    canvas.paste(fig, ((canvas.width - fig.width) // 2, 0))
    canvas.save(out)
    # foot row = lowest on-row inside the run
    col = d[:, x0:x1]
    rows = np.nonzero((col > 40).sum(axis=1) > 4)[0]
    meta[tag] = {'src_run': [int(x0), int(x1)], 'out': out,
                 'canvas': list(canvas.size),
                 'foot_y': int(rows.max()), 'top_y': int(rows.min()),
                 'height_px': int(rows.max() - rows.min() + 1)}
print(json.dumps(meta, indent=1))
