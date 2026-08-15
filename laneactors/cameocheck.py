#!/usr/bin/env python3
"""cameocheck.py -- score a candidate cameo card against the SHIPPED cameo family.

A cameo is not judged by whether the face is good. It is judged by whether it
sits in the same card as `irene`, `holmes`, `king-unmasked` when the reader
flips between them: same navy field, same field FLATNESS (the family's ground is
a plain gradient, not a faceted backdrop), same bust size, same seat of the
shoulders on the bottom edge, same skin warmth.

    python3 cameocheck.py CAND [CAND...]

Prints one JSON line per candidate plus the family's own mean/spread, so a
candidate's numbers can be read against the band the family already occupies.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = '/Users/samz/Documents/gaslight-remake'
FAMILY = ['cameo-irene.png', 'cameo-holmes.png', 'cameo-watson.png',
          'cameo-king-unmasked.png', 'cameo-king-masked.png']


def measure(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]

    # THE FIELD is the border ring -- the part of the card no bust ever reaches.
    r = 24
    ring = np.concatenate([a[:r].reshape(-1, 3), a[:, :r].reshape(-1, 3),
                           a[:, -r:].reshape(-1, 3)])
    field = np.median(ring, axis=0)
    # FLATNESS: the family's ground is a smooth gradient. A faceted backdrop
    # shows up as high local spread inside the ring, and it is the single
    # loudest way an off-family card reads wrong at a glance.
    field_sd = float(ring.std(axis=0).mean())

    # THE BUST: everything far enough from the field colour.
    d = np.sqrt(((a - field) ** 2).sum(axis=2))
    m = d > 42
    if m.sum() < 500:
        return {'file': os.path.basename(path), 'error': 'no bust found'}
    ys, xs = np.nonzero(m)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    # skin/coat mean over the bust only
    bust = a[m]
    # does the bust SIT on the bottom edge the way the family's do?
    bottom_run = int(m[-3:].sum())
    return {
        'file': os.path.basename(path),
        'size': [w, h],
        'field_rgb': [round(float(v), 1) for v in field],
        'field_flatness_sd': round(field_sd, 2),
        'bust_top_frac': round(y0 / h, 3),
        'bust_h_frac': round((y1 - y0 + 1) / h, 3),
        'bust_w_frac': round((x1 - x0 + 1) / w, 3),
        'bust_cx_frac': round(((x0 + x1) / 2) / w, 3),
        'seats_on_bottom': bottom_run > w * 0.05,
        'bust_mean_rgb': [round(float(v), 1) for v in bust.mean(axis=0)],
        'bust_warmth_r_minus_b': round(float(bust[:, 0].mean() - bust[:, 2].mean()), 1),
    }


def main():
    fam = [measure(os.path.join(ROOT, 'assets/plates', f)) for f in FAMILY]
    for r in fam:
        print(json.dumps({'family': r}))
    keys = ['field_flatness_sd', 'bust_top_frac', 'bust_h_frac', 'bust_w_frac',
            'bust_cx_frac', 'bust_warmth_r_minus_b']
    band = {k: [round(min(r[k] for r in fam), 3), round(max(r[k] for r in fam), 3)]
            for k in keys}
    fam_field = np.array([r['field_rgb'] for r in fam]).mean(axis=0)
    print(json.dumps({'FAMILY_BAND': band,
                      'FAMILY_FIELD_RGB': [round(float(v), 1) for v in fam_field]}))

    for p in sys.argv[1:]:
        r = measure(p)
        if 'error' in r:
            print(json.dumps(r))
            continue
        # ONE-SIDED KEYS. Field flatness is a defect only in EXCESS: a card
        # whose ground is smoother than the family's has no faceted backdrop
        # fighting the bust, which is what the measure exists to catch. Scoring
        # it two-sided fails the cleanest candidate for being clean.
        one_sided_max = {'field_flatness_sd'}
        fails = []
        for k in keys:
            lo, hi = band[k]
            if k in one_sided_max:
                if r[k] > hi + 1e-9:
                    fails.append(k)
            elif not (lo - 1e-9 <= r[k] <= hi + 1e-9):
                fails.append(k)
        r['field_delta_from_family'] = round(
            float(np.sqrt(((np.array(r['field_rgb']) - fam_field) ** 2).sum())), 1)
        r['outside_family_band'] = fails
        r['verdict'] = 'IN-FAMILY' if not fails and r['field_delta_from_family'] < 18 \
            else 'OUT: ' + ','.join(fails + (['field'] if r['field_delta_from_family'] >= 18 else []))
        print(json.dumps(r))


if __name__ == '__main__':
    main()
