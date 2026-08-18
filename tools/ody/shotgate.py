#!/usr/bin/env python3
"""shotgate.py -- SHOTGEN lane gates for a fused still-shot candidate.

The _nomangate.py prototype gate set, generalized, with thresholds pinned to
the ACCEPTED prototype's own numbers (A-noman-cand1, owner pick 2026-08-17):

(a) IDENTITY (+-20 law): mean R-B of the darkest 2% of pixels inside each
    declared character box, candidate vs THE SEED's same box. The seed is the
    real staged tableau -- its actors passed the canonical identity gates
    upstream (strip/canonical law), so the seed cluster IS the canonical
    measured under this unit's light (the gate_b.py law: "canonical measured
    on the seed"). Accepted prototype: cand1 vs seed deltas 5.0 / 6.2.
(b) SAME-PLACE continuity vs the SEED: 640x360 gray, Sobel magnitude, 2px
    gaussian blur, normalized cross-correlation -- GLOBAL >= 0.71 (accepted
    0.711) and each 2x2 QUADRANT >= 0.60 (accepted min region 0.606,
    the racks-class number).
(c) REGISTER, saturation-weighted 36-bin hue histogram intersection +
    mean HSV sat/value deltas, thresholds the accepted prototype's own:
    intersection >= 0.29 (accepted 0.298), |sat delta| <= 0.10 (accepted
    0.006), |val delta| <= 0.25 (accepted 0.183). GATED vs the SEED (the
    staged register the reader saw -- the prototype's seed sat ON its state
    plate, so seed-register == plate-register there; some units run under a
    dim/grade the bare plate file does not carry). The bare state-plate
    numbers are REPORTED as info.

Usage: shotgate.py <config.json> <candidate.png> [...more candidates]
config: { "seed": path, "plate": path, "boxes": {"WHO": [x0,y0,x1,y1]} }
        boxes in 1366x768 frame px (both seed and candidate are resized).
Prints JSON; exit 0 if ANY candidate passes all gates.
"""
import json
import sys

import numpy as np
from PIL import Image, ImageFilter

NCC_GLOBAL_MIN = 0.71
NCC_QUAD_MIN = 0.60
IDENT_TOL = 20.0
HUE_MIN = 0.29
SAT_MAX = 0.10
VAL_MAX = 0.25
W, H = 1366, 768


def load(path):
    return Image.open(path).convert('RGB').resize((W, H), Image.LANCZOS)


def head_cluster(img, box):
    a = np.asarray(img).astype(np.float32)
    x0, y0, x1, y1 = box
    px = a[y0:y1, x0:x1].reshape(-1, 3)
    lum = px.mean(axis=1)
    k = max(30, int(0.02 * len(lum)))
    idx = np.argsort(lum)[:k]
    sel = px[idx]
    return float(sel[:, 0].mean() - sel[:, 2].mean())


def edges(img):
    g = np.asarray(img.convert('L').resize((640, 360), Image.LANCZOS),
                   dtype=np.float32)
    gx = np.zeros_like(g); gy = np.zeros_like(g)
    gx[:, 1:-1] = g[:, 2:] - g[:, :-2]
    gy[1:-1, :] = g[2:, :] - g[:-2, :]
    m = np.hypot(gx, gy)
    m = np.asarray(Image.fromarray(np.clip(m, 0, 255).astype(np.uint8))
                   .filter(ImageFilter.GaussianBlur(2)), dtype=np.float32)
    return m


def ncc(a, b):
    a = a - a.mean(); b = b - b.mean()
    d = np.sqrt((a * a).sum() * (b * b).sum())
    return float((a * b).sum() / d) if d else 0.0


def hue_hist(img, bins=36):
    hsv = np.asarray(img.resize((512, 288)).convert('HSV'), dtype=np.float32)
    s, v = hsv[..., 1].ravel() / 255, hsv[..., 2].ravel() / 255
    h = hsv[..., 0].ravel()
    hist, _ = np.histogram(h, bins=bins, range=(0, 256), weights=s)
    hist = hist / max(hist.sum(), 1e-9)
    return hist, float(s.mean()), float(v.mean())


def main():
    cfg = json.load(open(sys.argv[1]))
    seed = load(cfg['seed'])
    plate = Image.open(cfg['plate']).convert('RGB')
    e_seed = edges(seed)
    ph, ps, pv = hue_hist(plate)
    sh, ss, sv = hue_hist(seed)
    seed_heads = {w: round(head_cluster(seed, b), 1)
                  for w, b in cfg['boxes'].items()}
    out = {'seed_heads': seed_heads}
    any_ok = False
    for path in sys.argv[2:]:
        img = load(path)
        ident = {}
        for who, box in cfg['boxes'].items():
            wc = head_cluster(img, box)
            d = wc - seed_heads[who]
            ident[who] = {'warmcool': round(wc, 1), 'delta': round(d, 1),
                          'ok': bool(abs(d) <= IDENT_TOL)}
        e_c = edges(img)
        cont = {'global_ncc': round(ncc(e_c, e_seed), 3)}
        quads = {}
        for qy in (0, 1):
            for qx in (0, 1):
                sl = (slice(qy * 180, (qy + 1) * 180),
                      slice(qx * 320, (qx + 1) * 320))
                quads[f'q{qy}{qx}'] = round(ncc(e_c[sl], e_seed[sl]), 3)
        cont.update(quads)
        ch, cs, cv = hue_hist(img)
        reg = {'hue_hist_intersection': round(float(np.minimum(ch, sh).sum()), 3),
               'sat_delta': round(cs - ss, 3), 'val_delta': round(cv - sv, 3)}
        reg_plate = {'hue_hist_intersection': round(float(np.minimum(ch, ph).sum()), 3),
                     'sat_delta': round(cs - ps, 3), 'val_delta': round(cv - pv, 3)}
        ok = (all(v['ok'] for v in ident.values())
              and cont['global_ncc'] >= NCC_GLOBAL_MIN
              and all(v >= NCC_QUAD_MIN for v in quads.values())
              and reg['hue_hist_intersection'] >= HUE_MIN
              and abs(reg['sat_delta']) <= SAT_MAX
              and abs(reg['val_delta']) <= VAL_MAX)
        any_ok = any_ok or ok
        out[path.split('/')[-1]] = {'identity': ident, 'continuity': cont,
                                    'register_vs_seed': reg,
                                    'register_vs_plate_info': reg_plate, 'ok': ok}
    print(json.dumps(out, indent=1))
    sys.exit(0 if any_ok else 1)


if __name__ == '__main__':
    main()
