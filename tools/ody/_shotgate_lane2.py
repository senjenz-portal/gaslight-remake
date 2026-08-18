#!/usr/bin/env python3
"""_shotgate_lane2.py -- PROTOTYPE A gate generalized for the SHOTGEN lane-2
plates (wineskin / scheme / greatram / menbeg). The _nomangate.py method
verbatim, config per shot:

(a) IDENTITY (head-cluster law +-20): mean R-B of the darkest 2% inside each
    declared head box, gated against the SAME statistic on the SEED (the real
    staged tableau: canonical actors at their marks with the regrade baked --
    the staging baseline the accepted prototype was judged on; canonical-crown
    refs ulysses -8.7 / polyphemus -11.6 are reported for the record).
(b) SAME-PLACE continuity vs the SEED: 640x360 gray Sobel + 2px blur, NCC
    global + per structure region. Accept law: every structure region >= the
    accepted prototype's weakest structure number (racks-class 0.71), the
    character region >= its giant-class 0.60.
(c) REGISTER: saturation-weighted 36-bin hue histogram intersection vs the
    SET's palette plate (accept >= the accepted prototype's 0.298) + mean HSV
    sat/val deltas vs the SEED (crop-identical -- plate-relative deltas are
    crop-dependent; the accepted prototype measured seed-relative sat 0.082 /
    val -0.075, so the envelope is |sat|<=0.085, |val|<=0.08).

Usage: python3 _shotgate_lane2.py [shot ...]   (default: all four)
       python3 _shotgate_lane2.py --boxes      (write head-box overlay sheet)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = '/Users/samz/Documents/gaslight-remake'
RAW = ROOT + '/assets/raw/ody-shots'
SETS = ROOT + '/site-deploy/living-odyssey/assets/set'

CANON_REFS = {'ulysses': -8.7, 'polyphemus': -11.6}   # canonical crowns, for the record
NCC_STRUCT_MIN = 0.71   # accepted noman cand1: racks .713 / fire .741 / pens .715
NCC_CHAR_MIN = 0.60     # accepted noman cand1: giant .606
HUE_INT_MIN = 0.298     # accepted noman cand1 vs cave-shut
SAT_D_MAX = 0.085       # accepted noman cand1 vs its seed: +0.082
VAL_D_MAX = 0.08        # accepted noman cand1 vs its seed: -0.075
IDENT_TOL = 20.0

# head boxes in 1366x768 px; regions frame-normalized (x0,y0,x1,y1).
# 'char' names the character-class NCC region; the rest are structure-class.
SHOTS = {
    'wineskin': {
        'seed': RAW + '/L2-seed-wineskin.png',
        'plate': SETS + '/shore/shore-day.jpg',
        'heads': {
            'ULYSSES': {'seed': (816, 336, 850, 380), 'cand': (812, 334, 852, 382)},
            'CREW': {'seed': (146, 236, 182, 280), 'cand': (143, 234, 184, 284)},
        },
        'regions': {'ship': (0.30, 0.00, 1.00, 0.42), 'crew': (0.08, 0.28, 0.60, 0.75),
                    'shore': (0.00, 0.55, 0.95, 1.00), 'ulysses': (0.56, 0.32, 0.66, 0.70)},
        'char': 'ulysses',
    },
    'scheme': {
        'seed': RAW + '/L2-seed-scheme.png',
        'plate': SETS + '/cave/cave-shut.jpg',
        'heads': {
            'ULYSSES': {'seed': (780, 246, 818, 295), 'cand': (775, 245, 817, 295)},
            'CREW': {'seed': (1052, 323, 1078, 340), 'cand': (1049, 322, 1077, 340)},
        },
        'regions': {'fire-ring': (0.00, 0.15, 0.45, 0.65), 'crew-vat': (0.70, 0.25, 1.00, 0.80),
                    'racks-top': (0.00, 0.00, 0.70, 0.14), 'ulysses': (0.52, 0.30, 0.65, 0.75)},
        'char': 'ulysses',
    },
    'greatram': {
        'seed': RAW + '/L2-seed-greatram.png',
        'plate': SETS + '/cave/cave-shut.jpg',
        'heads': {
            'ULYSSES': {'seed': (525, 293, 578, 352), 'cand': (522, 293, 572, 354)},
            'RAM': {'seed': (555, 200, 680, 290), 'cand': (560, 185, 700, 285)},
        },
        'regions': {'racks-cheese': (0.00, 0.00, 0.35, 0.30), 'pens-right': (0.62, 0.52, 1.00, 0.98),
                    'fire-ring': (0.00, 0.45, 0.30, 0.85), 'ram': (0.38, 0.15, 0.68, 0.62)},
        'char': 'ram',
    },
    'menbeg': {
        'seed': RAW + '/L2-seed-menbeg.png',
        'plate': SETS + '/sea/sea.jpg',
        'heads': {
            'ULYSSES': {'seed': (292, 25, 358, 98), 'cand': (293, 25, 352, 97)},
            'THE-MEN': {'seed': (958, 176, 1002, 224), 'cand': (952, 170, 995, 220)},
        },
        'regions': {'hull-deck': (0.00, 0.40, 0.58, 1.00), 'sail-top': (0.30, 0.00, 1.00, 0.24),
                    'sea-left': (0.00, 0.00, 0.16, 0.55), 'rowers': (0.30, 0.22, 1.00, 1.00)},
        'char': 'rowers',
    },
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
    g = np.asarray(img.convert('L').resize((640, 360), Image.LANCZOS), dtype=np.float32)
    gx = np.zeros_like(g); gy = np.zeros_like(g)
    gx[:, 1:-1] = g[:, 2:] - g[:, :-2]
    gy[1:-1, :] = g[2:, :] - g[:-2, :]
    m = np.hypot(gx, gy)
    return np.asarray(Image.fromarray(np.clip(m, 0, 255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(2)), dtype=np.float32)


def ncc(a, b):
    a = a - a.mean(); b = b - b.mean()
    d = np.sqrt((a * a).sum() * (b * b).sum())
    return float((a * b).sum() / d) if d else 0.0


def hue_hist(img, bins=36):
    hsv = np.asarray(img.convert('RGB').resize((512, 288)).convert('HSV'), dtype=np.float32)
    h, s, v = hsv[..., 0].ravel(), hsv[..., 1].ravel() / 255, hsv[..., 2].ravel() / 255
    hist, _ = np.histogram(h, bins=bins, range=(0, 256), weights=s)
    return hist / max(hist.sum(), 1e-9), float(s.mean()), float(v.mean())


def gate(shot, cand_path):
    cfg = SHOTS[shot]
    seed = Image.open(cfg['seed']).resize((1366, 768), Image.LANCZOS)
    cand = Image.open(cand_path)
    if cand.size != (1366, 768):
        cand = cand.resize((1366, 768), Image.LANCZOS)
    plate = Image.open(cfg['plate'])
    out = {'shot': shot, 'cand': os.path.basename(cand_path)}
    ident = {}
    for who, boxes in cfg['heads'].items():
        base = head_cluster(seed, boxes['seed'])
        wc = head_cluster(cand, boxes['cand'])
        d = wc - base
        ident[who] = {'seed_warmcool': round(base, 1), 'warmcool': round(wc, 1),
                      'delta': round(d, 1), 'ok': bool(abs(d) <= IDENT_TOL)}
    out['identity'] = ident
    out['identity_ok'] = all(v['ok'] for v in ident.values())
    e_seed, e_cand = edges(seed), edges(cand)
    cont = {'global_ncc': round(ncc(e_cand, e_seed), 3)}
    cont_ok = True
    for rn, (x0, y0, x1, y1) in cfg['regions'].items():
        sl = (slice(int(y0 * 360), int(y1 * 360)), slice(int(x0 * 640), int(x1 * 640)))
        v = round(ncc(e_cand[sl], e_seed[sl]), 3)
        cont[rn + '_ncc'] = v
        floor = NCC_CHAR_MIN if rn == cfg['char'] else NCC_STRUCT_MIN
        if v < floor:
            cont_ok = False
    out['continuity'] = cont
    out['continuity_ok'] = bool(cont_ok and cont['global_ncc'] >= NCC_STRUCT_MIN)
    ph, ps, pv = hue_hist(plate)
    sh2, ss2, sv2 = hue_hist(seed)
    ch, cs, cv = hue_hist(cand)
    reg = {'hue_hist_intersection': round(float(np.minimum(ch, ph).sum()), 3),
           'hue_int_seed': round(float(np.minimum(ch, sh2).sum()), 3),
           'sat_delta': round(cs - ss2, 3), 'val_delta': round(cv - sv2, 3)}
    out['register'] = reg
    out['register_ok'] = bool(reg['hue_hist_intersection'] >= HUE_INT_MIN
                              and abs(reg['sat_delta']) <= SAT_D_MAX
                              and abs(reg['val_delta']) <= VAL_D_MAX)
    out['ok'] = out['identity_ok'] and out['continuity_ok'] and out['register_ok']
    return out


def boxsheet(cands):
    tiles = []
    for shot, cand_path in cands.items():
        cfg = SHOTS[shot]
        for kind, path in [('seed', cfg['seed']), ('cand', cand_path)]:
            im = Image.open(path)
            if im.size != (1366, 768):
                im = im.resize((1366, 768), Image.LANCZOS)
            dr = ImageDraw.Draw(im)
            for who, boxes in cfg['heads'].items():
                dr.rectangle(boxes[kind], outline=(0, 255, 0), width=3)
                dr.text((boxes[kind][0], boxes[kind][3] + 4), f'{shot}:{who}', fill=(0, 255, 0))
            tiles.append(im.resize((683, 384)))
    W, H = 683 * 2, 384 * len(cands)
    sheet = Image.new('RGB', (W, H))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % 2) * 683, (i // 2) * 384))
    sheet.save('/tmp/ody-shots-l2/_headboxes.jpg', quality=88)
    print('/tmp/ody-shots-l2/_headboxes.jpg')


if __name__ == '__main__':
    shots = [a for a in sys.argv[1:] if not a.startswith('-')] or list(SHOTS)
    cands = {s: RAW + f'/L2-{s}-cand1.png' for s in shots}
    for s in shots:   # prefer cand2 when present (the one allowed retry)
        c2 = RAW + f'/L2-{s}-cand2.png'
        if os.path.exists(c2) and '--cand1' not in sys.argv:
            cands[s] = c2
    if '--boxes' in sys.argv:
        boxsheet(cands)
    else:
        print(json.dumps([gate(s, cands[s]) for s in shots], indent=1))
