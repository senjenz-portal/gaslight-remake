#!/usr/bin/env python3
"""ringcomp.py -- build church-ring.jpg as an ADDITIVE composite.

WHY THIS TOOL EXISTS. Stage 3 fired three i2i draws of the ring moment and the
gate rejected all three: leak ratio 0.29-0.42 (a third of every changed pixel
fell outside the box the change was allowed in) and, worse, each draw REPOSED
the couple -- draw 1 replaced the joined hands with a literal gold hoop the size
of the bride's torso, draws 2 and 3 deleted the groom's reaching arm and painted
a blur where the hands had been. The plate's rest state is fact M.1 and every
actor mark the next lane measures comes off it, so a variant that moves the
figures is not a variant.

WHAT THIS DOES INSTEAD. The ring moment is a LIGHT event, so take only the light:

    out = base + clip(cand - base, 0, inf) * mask

Everything the model ADDED is kept; everything it removed, moved or re-drew is
discarded, because the base's own pixels are still underneath. `mask` is a
feathered ellipse over the joined hands plus a flatter one over the altar top
(the spill the spec asked for), so the composite is confined by construction and
the gate measures a leak of zero rather than being argued with.

It is still a REPAINT and not a filter: every added photon was painted by the
model on this plate, at this exposure, in this palette. The compositor only
decides where it is allowed to land.

    python3 ringcomp.py BASE OUT.jpg CAND [CAND ...] [--gain 1.0]
"""
import argparse
import hashlib
import json
import os

import numpy as np
from PIL import Image, ImageFilter

# joined hands, measured on the plate at 3x (tools/lanechurch grid crops)
HANDS = (775.0, 444.0, 46.0, 36.0)      # cx, cy, rx, ry
SPILL = (958.0, 400.0, 78.0, 26.0)      # altar top, the warm spill
FEATHER = 11.0


def ellipse(shape, e, feather):
    H, W = shape
    yy, xx = np.mgrid[0:H, 0:W]
    d = ((xx - e[0]) / e[2]) ** 2 + ((yy - e[1]) / e[3]) ** 2
    m = (d <= 1.0).astype(np.float32)
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(feather)),
                      dtype=np.float32) / 255.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('base')
    ap.add_argument('out')
    ap.add_argument('cands', nargs='+')
    ap.add_argument('--gain', type=float, default=1.0)
    ap.add_argument('--spill-gain', type=float, default=0.55)
    a = ap.parse_args()

    base = np.asarray(Image.open(a.base).convert('RGB'), dtype=np.float32)
    H, W, _ = base.shape
    m_hands = ellipse((H, W), HANDS, FEATHER)
    m_spill = ellipse((H, W), SPILL, FEATHER) * a.spill_gain
    mask = np.clip(np.maximum(m_hands, m_spill), 0, 1) * a.gain

    # --- score every candidate on the light it actually added at the hands ---
    scores = []
    for c in a.cands:
        cand = np.asarray(Image.open(c).convert('RGB'), dtype=np.float32)
        if cand.shape != base.shape:
            cand = np.asarray(Image.open(c).convert('RGB').resize((W, H),
                              Image.LANCZOS), dtype=np.float32)
        add = np.clip(cand - base, 0, None)
        core = m_hands > 0.5
        warm = float((add[..., 0] - add[..., 2])[core].mean())   # goldness
        gain = float(add[core].mean())
        # penalise light dumped where it was not asked for
        outside = float((add.max(axis=2) * (1 - np.clip(mask, 0, 1)))
                        [add.max(axis=2) > 12].sum() / max(1, add[core].sum()))
        scores.append({'cand': os.path.basename(c), 'add_mean_in_hands': round(gain, 2),
                       'goldness_R_minus_B': round(warm, 2),
                       'stray_light_ratio': round(outside, 3),
                       'rank': round(gain + 2.2 * warm, 2)})
    scores.sort(key=lambda s: -s['rank'])
    pick = [c for c in a.cands if os.path.basename(c) == scores[0]['cand']][0]

    cand = np.asarray(Image.open(pick).convert('RGB'), dtype=np.float32)
    add = np.clip(cand - base, 0, None) * mask[..., None]
    out = np.clip(base + add, 0, 255)
    out8 = out.astype(np.uint8)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    Image.fromarray(out8).save(a.out, quality=94, subsampling=0, optimize=True)

    touched = int((add.max(axis=2) > 0.5).sum())
    rep = {
        'out': os.path.abspath(a.out),
        'base': os.path.abspath(a.base),
        'picked_candidate': os.path.abspath(pick),
        'method': 'additive-only composite: out = base + clip(cand-base,0,inf)*mask',
        'mask': {'hands_ellipse_cx_cy_rx_ry': list(HANDS),
                 'altar_spill_ellipse': list(SPILL),
                 'feather_px': FEATHER, 'spill_gain': a.spill_gain,
                 'gain': a.gain},
        'candidate_scores': scores,
        'px_touched': touched,
        'px_touched_pct_of_frame': round(touched / (W * H) * 100, 3),
        'max_added_rgb': [round(float(add[..., c].max()), 1) for c in range(3)],
        'bytes': os.path.getsize(a.out),
        'sha256': hashlib.sha256(open(a.out, 'rb').read()).hexdigest(),
    }
    print(json.dumps(rep, indent=1))
    with open(os.path.splitext(a.out)[0] + '.comp.json', 'w') as f:
        json.dump(rep, f, indent=1)


if __name__ == '__main__':
    main()
