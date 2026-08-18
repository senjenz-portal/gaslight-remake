#!/usr/bin/env python3
"""_nomangate.py -- PROTOTYPE A gates for the painted NOMAN dialogue shot.

(a) IDENTITY (head-cluster law, MANIFEST-consist +-20): mean R-B of the
    darkest 2% of pixels inside each character's head box -- the same
    darkest-cluster statistic strip_slice_gate.head_warmcool measures on the
    canonical crowns through the navy matte (refs computed there: ulysses
    -8.7, polyphemus -11.6). The painted shot has no alpha, so the crown
    window is a declared head box instead of the top-10%-of-figure band;
    the darkest 2% inside it is the same hair/beard cluster.
(b) SAME-PLACE continuity: structural correspondence vs the SEED (the real
    staged tableau on cave-shut, so correspondence vs the master by
    construction). Measure: both frames to 640x360 grayscale, Sobel gradient
    magnitude, 2px gaussian blur (repaint jitter tolerance), then normalized
    cross-correlation -- global and per structure region (racks / fire-ring /
    pens / giant), regions in frame-normalized coords.
(c) REGISTER vs the cave plate (cave-shut.jpg): saturation-weighted 36-bin
    hue histogram intersection + mean HSV saturation/value deltas.
"""
import json
import sys

import numpy as np
from PIL import Image, ImageFilter

REFS = {'ulysses': -8.7, 'polyphemus': -11.6}

# head boxes, per candidate, in the candidate's own 1366x768 px
HEADS = {
    'cand1': {'ulysses': (676, 483, 720, 534), 'polyphemus': (852, 98, 998, 272)},
    'cand2': {'ulysses': (681, 486, 724, 537), 'polyphemus': (862, 92, 998, 268)},
    'seed':  {'ulysses': (672, 486, 714, 534), 'polyphemus': (838, 102, 1012, 268)},
}

REGIONS = {  # frame-normalized (x0,y0,x1,y1)
    'racks': (0.13, 0.00, 0.55, 0.42),
    'fire-ring': (0.15, 0.40, 0.55, 0.80),
    'pens': (0.62, 0.08, 1.00, 0.58),
    'giant': (0.55, 0.08, 0.80, 0.70),
}


def head_cluster(img, box):
    a = np.asarray(img.convert('RGB')).astype(np.float32)
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
    hsv = np.asarray(img.convert('RGB').resize((512, 288)).convert('HSV'),
                     dtype=np.float32)
    h, s, v = hsv[..., 0].ravel(), hsv[..., 1].ravel() / 255, hsv[..., 2].ravel() / 255
    hist, _ = np.histogram(h, bins=bins, range=(0, 256), weights=s)
    hist = hist / max(hist.sum(), 1e-9)
    return hist, float(s.mean()), float(v.mean())


def main():
    seed = Image.open('/tmp/ody-shots/seed-noman.png').resize((1366, 768), Image.LANCZOS)
    plate = Image.open('/Users/samz/Documents/gaslight-remake/site-deploy/'
                       'living-odyssey/assets/set/cave/cave-shut.jpg')
    e_seed = edges(seed)
    ph, ps, pv = hue_hist(plate)
    out = {}
    for name, path in [('cand1', sys.argv[1]), ('cand2', sys.argv[2])]:
        img = Image.open(path)
        # (a) identity
        ident = {}
        for who in ('ulysses', 'polyphemus'):
            wc = head_cluster(img, HEADS[name][who])
            d = wc - REFS[who]
            ident[who] = {'warmcool': round(wc, 1), 'delta': round(d, 1),
                          'ok': bool(abs(d) <= 20)}
        # (b) continuity vs seed
        e_c = edges(img)
        cont = {'global_ncc': round(ncc(e_c, e_seed), 3)}
        for rn, (x0, y0, x1, y1) in REGIONS.items():
            sl = (slice(int(y0 * 360), int(y1 * 360)),
                  slice(int(x0 * 640), int(x1 * 640)))
            cont[rn + '_ncc'] = round(ncc(e_c[sl], e_seed[sl]), 3)
        # (c) register vs cave plate
        ch, cs, cv = hue_hist(img)
        reg = {'hue_hist_intersection': round(float(np.minimum(ch, ph).sum()), 3),
               'sat_delta': round(cs - ps, 3), 'val_delta': round(cv - pv, 3)}
        out[name] = {'identity': ident, 'continuity': cont, 'register': reg}
    # seed's own head clusters as a staging baseline
    out['seed_heads'] = {w: round(head_cluster(seed, HEADS['seed'][w]), 1)
                         for w in ('ulysses', 'polyphemus')}
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
