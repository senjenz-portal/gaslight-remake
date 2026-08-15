#!/usr/bin/env python3
"""palettepull.py -- pull a walk sheet's palette back onto the idle actor.

Borrowed from the sibling actor lane (tools/lanea/actor_sprite.py): each
generated frame drifts a little in mean/std from the figure it is supposed to
BE, so the walk visibly shimmers in colour against the standing pose. Match
each cell's per-channel mean/std to the idle cutout's and blend back at k.

    python3 palettepull.py SHEET REF OUT N [k]
"""
import sys
import numpy as np
from PIL import Image

sheet, ref, out = sys.argv[1], sys.argv[2], sys.argv[3]
n = int(sys.argv[4]); k = float(sys.argv[5]) if len(sys.argv) > 5 else 0.65

ra = np.asarray(Image.open(ref).convert('RGBA'), np.float32)
rm = ra[..., 3] > 128
ref_mu, ref_sd = ra[..., :3][rm].mean(0), ra[..., :3][rm].std(0)

im = Image.open(sheet).convert('RGBA')
cw = im.width // n
cells, resid = [], []
for i in range(n):
    arr = np.asarray(im.crop((i * cw, 0, (i + 1) * cw, im.height)), np.float32).copy()
    m = arr[..., 3] > 128
    if m.sum() > 50:
        mu, sd = arr[..., :3][m].mean(0), arr[..., :3][m].std(0)
        for c in range(3):
            corr = (arr[..., c] - mu[c]) * (ref_sd[c] / max(sd[c], 1e-3)) + ref_mu[c]
            arr[..., c] = arr[..., c] * (1 - k) + corr * k
        resid.append([round(float(v), 1) for v in (mu - ref_mu)])
    cells.append(np.clip(arr, 0, 255).astype(np.uint8))

o = Image.new('RGBA', im.size, (0, 0, 0, 0))
for i, c in enumerate(cells):
    o.paste(Image.fromarray(c), (i * cw, 0))
o.save(out)
print({'out': out, 'n': n, 'k': k, 'residual_mu_minus_ref_per_frame': resid})
