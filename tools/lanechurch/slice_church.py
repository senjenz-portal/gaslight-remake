#!/usr/bin/env python3
"""slice_church.py -- cut the SET `church` plate into living layers.

Adapted from tools/lanea/slice_plate.py (the 221B slicer that shipped Beat I).
Same six-step spine; every place it differs is a deliberate cut, listed here so
the next lane does not have to diff two files to find them.

  STEP 1  VOID MODEL.  slice_plate fits a quadratic in RADIUS about one measured
          centre (700,390) -- right for 221B, whose backdrop is a true isotropic
          vignette. This plate's backdrop is a directional navy wash: a radial
          fit about the frame centre leaves residual above the silhouette
          threshold over most of the frame (measured: it called 76-95% of the
          picture "diorama"). Replaced with a full 2D quadratic per channel,
          [1,x,y,x^2,xy,y^2], which SUBSUMES the radial model. Residual 3.13
          RGB RMS -- the same order as 221B's 1.2 on a noisier plate.

  STEP 2  BLOOM LIFT.  DROPPED, on purpose. 221B has one dominant gas-lamp
          halo, so lifting it into a screen-blended layer is what stops it
          tearing at a band seam. St Monica's has SIX small sources (four altar
          candles, two wall glows) whose halos overlap each other and sit
          entirely inside one band -- there is no seam for them to tear at, and
          subtracting six overlapping radial profiles would leave rings in the
          plaster. The light still breathes: the life pass measures each source
          off the plate and emits stage.js EMIS entries (screen-blended CSS
          overlays), which is what Beat I's fire/candle/win actually are.

  STEP 3  SILHOUETTE.  unchanged.

  STEP 4  DEPTH BANDS.  221B cut room / rock / lamp. A one-wall cutaway chapel
          has a different depth story, and the cut follows the isometric: the
          NAVE FLOOR and everything standing on it is nearer the camera than the
          standing north wall behind it, and the rock base is nearer still.
             shell  walls, roof trusses, both lancets, the east window, the
                    chancel, the altar and the three at the altar
             nave   the nave floor, the crimson runner and every pew
             rock   the faceted base it floats on
          Two hand-authored polylines separate them, read off the plate at 2x
          (tools/lanechurch/ has the gridded crops those reads came from).
          NAVE_EDGE steps DOWN between x=690 and x=700: left of the bride the
          nave band runs up to the wall base, at the bride it stops at the pew
          that crosses in front of her. The step is vertical and lands inside
          her own silhouette, so the seam is never visible.

  STEP 5  INPAINT.  unchanged (26 px of headroom, multigrid harmonic fill).

  STEP 6  WRITE.  unchanged, plus the FREE CUTS the scene ledger names:
          altar (with its rail), the hourglass, and KNOT-PATCH -- the chancel
          harmonically inpainted with the three figures removed. That last one
          is Beat I's `holmes-patch` law: the plate paints the rest state (fact
          M.1, "the three-in-a-knot tableau is the SET's rest state") and the
          patch is the hole they came out of, so the actor lane can lift them
          off and run the lounge, the run, the beckon and the drag.

    python3 slice_church.py OUTDIR [--src PLATE]
"""
import argparse
import hashlib
import json
import os
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = '/Users/samz/Documents/gaslight-remake/assets/plates/book/church/church.jpg'

# ---- hand-authored geometry, plate px (1408x768) --------------------------
# top of the faceted rock base == bottom of the building
ROCK_EDGE = [(250, 496), (300, 540), (352, 576), (416, 600), (480, 612),
             (544, 620), (608, 632), (672, 648), (736, 658), (800, 652),
             (864, 616), (928, 598), (992, 568), (1056, 550), (1120, 536),
             (1180, 528)]
# top of the nave band == the north wall's base, dropping to the pew that
# crosses in front of the bride
NAVE_EDGE = [(250, 520), (290, 500), (340, 478), (400, 462), (460, 452),
             (520, 444), (580, 438), (640, 432), (690, 430),
             (700, 506), (760, 508), (820, 512), (860, 516), (900, 552),
             (960, 566), (1020, 566), (1180, 560)]

# free cuts the ledger names (x0, y0, x1, y1)
ALTAR = (818, 344, 1094, 540)      # altar block + rail + chancel step face
HOURGLASS = (986, 350, 1028, 404)  # brass hourglass, amber sand
KNOT = (672, 326, 928, 536)        # clergyman + bride + groom

# the two close lenses, measured off this plate (see report)
LENS = {'ring': [782, 446], 'coin': [934, 402], 'nave': [704, 384],
        'aisle': [520, 470]}


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def blur(mask, r):
    return np.asarray(Image.fromarray(np.clip(mask * 255, 0, 255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255.0


def morph(m, op, k, n=1):
    im = Image.fromarray((m * 255).astype(np.uint8))
    f = ImageFilter.MaxFilter(k) if op == 'd' else ImageFilter.MinFilter(k)
    for _ in range(n):
        im = im.filter(f)
    return np.asarray(im) > 127


def fill_holes(m):
    inv = ~m
    reach = np.zeros_like(inv)
    reach[0, :] = inv[0, :]; reach[-1, :] = inv[-1, :]
    reach[:, 0] = inv[:, 0]; reach[:, -1] = inv[:, -1]
    for _ in range(600):
        nxt = morph(reach, 'd', 3) & inv
        nxt[0, :] |= inv[0, :]; nxt[-1, :] |= inv[-1, :]
        nxt[:, 0] |= inv[:, 0]; nxt[:, -1] |= inv[:, -1]
        if nxt.sum() == reach.sum():
            break
        reach = nxt
    return m | (inv & ~reach)


def below_mask(size, edge, feather=3.0):
    W, H = size
    ys = np.interp(np.arange(W), [p[0] for p in edge], [p[1] for p in edge])
    m = (np.arange(H)[:, None] >= ys[None, :]).astype(np.float32)
    return blur(m, feather) if feather else m


def box_mask(size, b, feather=0.0):
    W, H = size
    m = np.zeros((H, W), np.float32)
    m[b[1]:b[3], b[0]:b[2]] = 1.0
    return blur(m, feather) if feather else m


def harmonic_fill(img, hole, iters=(220, 160, 110, 70), levels=4):
    H, W, C = img.shape
    pim, phl = [img], [hole]
    for _ in range(levels - 1):
        s = (max(1, pim[-1].shape[1] // 2), max(1, pim[-1].shape[0] // 2))
        pim.append(np.asarray(Image.fromarray(np.clip(pim[-1], 0, 255).astype(np.uint8))
                              .resize(s, Image.BOX), dtype=np.float32))
        phl.append(np.asarray(Image.fromarray((phl[-1] * 255).astype(np.uint8))
                              .resize(s, Image.BOX), dtype=np.float32) > 127)
    cur = None
    for lvl in range(levels - 1, -1, -1):
        im, hm = pim[lvl].astype(np.float32).copy(), phl[lvl]
        if not hm.any():
            cur = im; continue
        if cur is not None:
            up = np.asarray(Image.fromarray(np.clip(cur, 0, 255).astype(np.uint8))
                            .resize((im.shape[1], im.shape[0]), Image.BILINEAR),
                            dtype=np.float32)
            im[hm] = up[hm]
        else:
            im[hm] = im[~hm].mean(axis=0) if (~hm).any() else 0
        for _ in range(iters[min(lvl, len(iters) - 1)]):
            p = np.pad(im, ((1, 1), (1, 1), (0, 0)), mode='edge')
            avg = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) * 0.25
            im[hm] = avg[hm]
        cur = im
    return cur


def rgba(rgb, alpha):
    o = np.zeros((rgb.shape[0], rgb.shape[1], 4), dtype=np.uint8)
    o[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    o[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(o)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('outdir')
    ap.add_argument('--src', default=SRC)
    a = ap.parse_args()
    os.makedirs(a.outdir, exist_ok=True)

    im = Image.open(a.src).convert('RGB')
    W, H = im.size
    arr = np.asarray(im, dtype=np.float64)
    meta = {}

    # 1 ---- void model (2D quadratic per channel), refined against its own mask
    yy, xx = np.mgrid[0:H, 0:W]
    x = (xx - W / 2.0) / (W / 2.0); y = (yy - H / 2.0) / (H / 2.0)
    F = np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], -1)
    bg = np.zeros((H, W), bool)
    b = int(min(H, W) * 0.05)
    bg[:b, :] = bg[-b:, :] = bg[:, :b] = bg[:, -b:] = True
    void = np.zeros_like(arr); coefs = []
    for _ in range(6):
        coefs = []
        for c in range(3):
            coef, *_ = np.linalg.lstsq(F[bg], arr[bg][:, c], rcond=None)
            coefs.append([float(v) for v in coef])
            void[..., c] = F @ coef
        d = np.sqrt(((arr - void) ** 2).sum(axis=2))
        nbg = ~morph(morph(d > 7, 'd', 3), 'e', 5)
        if nbg.sum() < 0.02 * H * W:
            break
        bg = nbg
    rms = float(np.sqrt(((arr[bg] - void[bg]) ** 2).sum(axis=1).mean()))
    meta['void'] = {'model': '2D quadratic per channel [1,x,y,x2,xy,y2]',
                    'coeffs': coefs, 'residualRmsOnVoid': round(rms, 3),
                    'voidFractionOfFrame': round(float(bg.mean() * 100), 2)}
    print('[1/6] void fitted, residual RMS %.2f, void %.1f%% of frame'
          % (rms, bg.mean() * 100), flush=True)

    # 2 ---- (bloom lift deliberately dropped; see module docstring)
    print('[2/6] bloom lift SKIPPED by design -- six small sources, no seam',
          flush=True)

    # 3 ---- silhouette
    d = np.sqrt(((arr - void) ** 2).sum(axis=2))
    sil = morph(morph(d > 7.5, 'd', 5), 'e', 7)
    sil = morph(sil, 'd', 3)
    sil = fill_holes(sil)
    silf = blur(sil.astype(np.float32), 1.0)
    colf, rowf = sil.mean(axis=0), sil.mean(axis=1)
    cols, rows = np.nonzero(colf > 0.005)[0], np.nonzero(rowf > 0.005)[0]
    hull = [int(cols.min()), int(rows.min()), int(cols.max()), int(rows.max())]
    meta['hull'] = hull
    print('[3/6] silhouette %.1f%% of frame, hull %s' % (sil.mean() * 100, hull),
          flush=True)

    # 4 ---- depth bands
    rock_a = below_mask((W, H), ROCK_EDGE, feather=2.5) * silf
    nave_a = below_mask((W, H), NAVE_EDGE, feather=2.5) * silf * (1 - rock_a)
    shell_a = silf * (1 - rock_a) * (1 - nave_a)
    cov = {k: round(float((m > .5).mean() * 100), 2)
           for k, m in (('shell', shell_a), ('nave', nave_a), ('rock', rock_a))}
    meta['coveragePct'] = cov
    print('[4/6] bands', cov, flush=True)

    # 5 ---- inpaint each band's occluded neighbourhood
    print('[5/6] inpainting neighbourhoods ...', flush=True)

    def grow(m, n=13):
        return morph(m > .5, 'd', 3, n) & sil

    layers = {}
    for name, m in (('shell', shell_a), ('nave', nave_a), ('rock', rock_a)):
        ext = grow(m)
        rgbf = harmonic_fill(arr.astype(np.float32), ext & ~(m > .3))
        rgbv = np.where((m > .3)[..., None], arr, rgbf)
        alpha = np.maximum(m, blur(ext.astype(np.float32), 5) * (ext | (m > .3)))
        layers[name] = (rgbv, np.clip(alpha, 0, 1))

    # --- the free cuts the ledger names -----------------------------------
    props = {}
    for nm, bx in (('altar', ALTAR), ('hourglass', HOURGLASS)):
        m = box_mask((W, H), bx, feather=1.2) * silf
        props[nm] = (arr, m, bx)

    # KNOT PATCH: the chancel with the three figures inpainted away
    knot_m = box_mask((W, H), KNOT, feather=0.0) > .5
    patch_rgb = harmonic_fill(arr.astype(np.float32), knot_m)
    pad = 10
    kb = [max(0, KNOT[0] - pad), max(0, KNOT[1] - pad),
          min(W, KNOT[2] + pad), min(H, KNOT[3] + pad)]

    # 6 ---- write
    files = {}

    def put(name, img):
        p = os.path.join(a.outdir, name)
        img.save(p, optimize=True)
        files[name] = {'bytes': os.path.getsize(p), 'sha256': sha(p)}
        print('    %-24s %6d KB' % (name, os.path.getsize(p) // 1024), flush=True)

    put('layer0-void.png', Image.fromarray(np.clip(void, 0, 255).astype(np.uint8)))
    put('layer1-shell.png', rgba(*layers['shell']))
    put('layer2-nave.png', rgba(*layers['nave']))
    put('layer3-rock.png', rgba(*layers['rock']))
    for nm, (rgbv, m, bx) in props.items():
        put('prop-%s.png' % nm, rgba(rgbv, m))
    put('knot-patch.png',
        Image.fromarray(np.clip(patch_rgb[kb[1]:kb[3], kb[0]:kb[2]], 0, 255)
                        .astype(np.uint8)))
    meta['knotPatch'] = {'box': kb, 'figuresBox': list(KNOT)}

    dbg = np.clip(arr * 0.30, 0, 255)
    dbg[..., 0] += shell_a * 150
    dbg[..., 1] += nave_a * 150
    dbg[..., 2] += rock_a * 190
    put('debug-bands.png', Image.fromarray(np.clip(dbg, 0, 255).astype(np.uint8)))

    man = {'lane': 'lanechurch-layers',
           'created': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
           'source': {'path': os.path.abspath(a.src), 'sha256': sha(a.src),
                      'size': [W, H]},
           'generator': 'tools/lanechurch/slice_church.py',
           'adaptedFrom': 'tools/lanea/slice_plate.py',
           'geometry': {'rockEdge': ROCK_EDGE, 'naveEdge': NAVE_EDGE,
                        'altarBox': list(ALTAR), 'hourglassBox': list(HOURGLASS),
                        'knotBox': list(KNOT), 'lensMarks': LENS},
           'analysis': meta, 'files': files}
    json.dump(man, open(os.path.join(a.outdir, 'manifest.json'), 'w'), indent=1)
    print('[6/6] -> %s' % a.outdir, flush=True)


if __name__ == '__main__':
    main()
