#!/usr/bin/env python3
"""respill.py -- apply matte.py's MAGENTA SPILL CEILING to a shipped actor cut,
on the RIM ONLY.

Why this tool exists (F12). tools/laneassets/matte.py keys a painted actor off
its flat magenta backing and finishes with `clamp_spill(rgb, ceiling=20)`, which
forces (R+B)/2 - G below 20 EVERYWHERE. That ceiling never reached
`actor/irene-street.png`: measured on the shipped cut, 284 of its 329
outer-rim pixels (alpha 0.02-0.35) carry a magenta excess up to 149, which is
the hard fringe the review saw round the reveal silhouette.

But the global ceiling cannot simply be re-run on a shipped cut, and that is
the trap this tool exists to avoid: the SAME measurement finds 634 pixels over
the ceiling in her SOLID interior (alpha >= 0.98) — and those are her costume,
the crimson collar-and-lapel facing that is her single accent colour
(rgb 140,28,37 -> excess 60). A global clamp would grey out the accent the
character sheet specifies. Norton's wine-burgundy frock coat is worse: 25 248
interior pixels over the ceiling.

So the ceiling is applied where keying spill actually lives — the soft edge —
and the paint inside the silhouette is left alone:

    alpha <  RIM_ALPHA     full ceiling
    alpha >= RIM_ALPHA     untouched

and the transition is feathered over the last 0.06 of alpha so the fix does not
put a new hard edge where it just removed one.

Raw-first: the pre-fix bytes are copied to `<raw>/pre/<name>` with their sha256
before anything is written, and every measurement (before and after) is recorded
in the lane manifest. Nothing is inferred; the report is the proof.

    python3 respill.py CUT [CUT...] --raw /abs/rawdir [--ceiling 20] [--dry]
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import shutil

import numpy as np
from PIL import Image

RIM_ALPHA = 0.98
FEATHER = 0.06


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for blk in iter(lambda: fh.read(1 << 20), b''):
            h.update(blk)
    return h.hexdigest()


def measure(rgb, alpha, ceiling):
    """the numbers the review complained about, per alpha band"""
    ex = (rgb[..., 0] + rgb[..., 2]) * 0.5 - rgb[..., 1]
    out = {}
    for lo, hi, name in ((0.02, 0.35, 'outerRim'), (0.35, 0.85, 'midRim'),
                         (0.85, RIM_ALPHA, 'innerRim'), (RIM_ALPHA, 1.01, 'solid')):
        m = (alpha >= lo) & (alpha < hi)
        n = int(m.sum())
        over = int((m & (ex > ceiling)).sum())
        out[name] = {'px': n, 'overCeiling': over,
                     'maxExcess': round(float(ex[m].max()), 1) if n else 0.0}
    rim = (alpha >= 0.02) & (alpha < RIM_ALPHA)
    out['rimMaxExcess'] = round(float(ex[rim].max()), 1) if rim.any() else 0.0
    out['rimOverCeiling'] = int((rim & (ex > ceiling)).sum())
    return out


def respill(path, ceiling):
    im = np.asarray(Image.open(path).convert('RGBA')).astype(np.float64)
    rgb, a8 = im[..., :3].copy(), im[..., 3]
    alpha = a8 / 255.0
    before = measure(rgb, alpha, ceiling)

    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    excess = np.maximum(0.0, (r + b) * 0.5 - g - ceiling)
    # 1 on the soft edge, 0 inside the paint, feathered over the last of alpha
    k = np.clip((RIM_ALPHA - alpha) / FEATHER, 0.0, 1.0)
    k = np.where(alpha < 0.02, 0.0, k)           # fully transparent: nothing to fix
    out = rgb.copy()
    out[..., 0] = r - excess * k
    out[..., 2] = b - excess * k
    out = np.clip(out, 0, 255)
    after = measure(out, alpha, ceiling)
    arr = np.dstack([out, a8]).round().astype(np.uint8)
    return Image.fromarray(arr, 'RGBA'), before, after, int((excess * k > 0.5).sum())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cuts', nargs='+')
    ap.add_argument('--raw', required=True)
    ap.add_argument('--ceiling', type=float, default=20.0)
    ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()

    pre = os.path.join(a.raw, 'pre')
    os.makedirs(pre, exist_ok=True)
    rows = []
    for cut in a.cuts:
        name = os.path.basename(cut)
        img, before, after, touched = respill(cut, a.ceiling)
        row = {'file': cut, 'ceiling': a.ceiling, 'rimAlpha': RIM_ALPHA,
               'pxTouched': touched, 'before': before, 'after': after,
               'sha256_before': sha256(cut)}
        if not a.dry:
            shutil.copy2(cut, os.path.join(pre, name))
            img.save(cut)
            row['sha256_after'] = sha256(cut)
            row['pre'] = os.path.join(pre, name)
        rows.append(row)
        print(json.dumps({'file': name, 'pxTouched': touched,
                          'rimMaxExcess': [before['rimMaxExcess'], after['rimMaxExcess']],
                          'rimOverCeiling': [before['rimOverCeiling'], after['rimOverCeiling']],
                          'solidOverCeiling': [before['solid']['overCeiling'],
                                               after['solid']['overCeiling']]}))
    man = os.path.join(a.raw, 'respill.json')
    json.dump({'when': dt.datetime.utcnow().isoformat() + 'Z',
               'tool': 'tools/lanecf/respill.py', 'rows': rows},
              open(man, 'w'), indent=1)
    print('manifest ' + man)


if __name__ == '__main__':
    main()
