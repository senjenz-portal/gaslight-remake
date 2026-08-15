#!/usr/bin/env python3
"""slice_street.py -- STAGE 2: cut the Serpentine Avenue plate into living layers.

Same five-step method as tools/lanea/slice_plate.py (whose helper functions this
module IMPORTS rather than copies, so the two plates are cut by identical code):

  1. fit the void: the backdrop is an isotropic radial gradient, quadratic in r.
     The room plate's centre was hard-coded at (700,390); this plate's centre is
     SEARCHED for, because a second plate is where a hard-coded constant becomes
     a lie.
  2. lift the gas-lamp bloom out of the plate into its own screen-blended,
     pulsing layer, so it can never tear at a layer seam.
  3. silhouette = |unlit - void| threshold, closed + hole-filled.
  4. hand-authored polygons cut the silhouette into depth bands.
  5. each band's occluded neighbourhood is harmonically inpainted, so parallax
     reveals show plausible pixels instead of holes.

WHAT IS DIFFERENT FROM THE ROOM, AND WHY (the cuts, documented):

  * FOUR bands, not three. The room is one interior box; this is a street with
    real depth: `terrace` (the far row, behind), `villa` (Briony Lodge itself,
    with its railings and steps), `base` (the pavement, the cobbled road and the
    rock the island floats on -- what actors stand ON), `lamp` (the gas standard
    on the near pavement, the one genuinely near object).
  * A FIFTH LAYER THE ROOM HAD NO NEED OF: `bayglass`. CONTENT-full.md sec 6.2
    requires "the villa's bay glass (transparent, drawn last)" because THE
    REVEAL is a silhouette BEHIND that glass -- the reference builds her opaque
    at renderOrder 0 and lets the transparent panes blend over her. So the glass
    is cut as an OVERLAY that is never removed from the villa band underneath:
    composited over its own source pixels with no sprite between them it
    reproduces the plate exactly, and with a sprite between them it does what
    glass does. Its alpha is derived from amberness -- the muntins read as dark
    bars against the lit room, so they come out opaque (they must cross in front
    of her) while the panes come out ~0.15 (she must read through them).
  * `mist`: a low damp haze over the cobbles. The room's life pass was four
    breathing emissives; a wet street at night wants one more channel, and
    Doyle's own word for this street is "damp".

    python3 slice_street.py SRC.png OUTDIR
"""
import importlib.util
import json
import os
import sys
import time

import numpy as np
from PIL import Image

_SPEC = importlib.util.spec_from_file_location(
    'slice_plate', '/Users/samz/Documents/gaslight-remake/tools/lanea/slice_plate.py')
SP = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(SP)          # module level is constants only, no work
blur, morph, fill_holes = SP.blur, SP.morph, SP.fill_holes
poly_mask, below_mask, harmonic_fill, rgba, sha = (
    SP.poly_mask, SP.below_mask, SP.harmonic_fill, SP.rgba, SP.sha)

# ---------------------------------------------------------------- geometry
# All of it measured off the curated plate at 3x with a 16 px grid
# (/tmp/z-lamp.png, /tmp/z-villa.png, /tmp/z-terr.png, /tmp/z-ground.png).
HULL = [(330, 0), (1060, 0), (1060, 767), (330, 767)]   # island + halo bounds

# the gas standard: finial, lantern, cross-bar, post, plinth
LAMP = [(456, 278), (512, 278), (512, 352), (502, 356), (496, 470), (506, 470),
        (506, 506), (462, 506), (462, 470), (472, 470), (466, 356), (456, 352)]

# everything BELOW this line is the base band: pavement, cobbles, rock. The
# line runs along the feet of the built things -- the terrace's plinth, the
# railing bases, the door steps.
GROUND_EDGE = [(330, 520), (400, 498), (478, 458), (560, 470), (640, 486),
               (700, 496), (760, 506), (830, 516), (900, 524), (960, 518),
               (1010, 508), (1060, 500)]

# the villa's own left edge, as x(y): left of it and above the ground line is
# the far terrace. The kink at y=130 is the villa's roof corner riding over the
# terrace ridge.
VILLA_EDGE = [(0, 706), (90, 692), (130, 644), (170, 662), (210, 674),
              (330, 676), (430, 678), (470, 690), (560, 706)]

# The three faces of the bay, as one octagon (frames included: the muntins have
# to draw in FRONT of her). MEASURED, after a first pass authored it 32 px too
# wide on the right: curate.py's warm components put the lit panes at x
# 724-803 (three columns: 724-741, 744-762, 780-803) and the proof-reveal sheet
# showed the surplus as a strip of alpha 1.0 over x 806-838 -- the bay's right
# CHEEK, not its glass -- which blanked the silhouette it exists to reveal.
BAYGLASS = [(696, 326), (722, 316), (766, 312), (808, 322), (808, 430),
            (766, 436), (722, 430), (696, 422)]

HALO_MAX_R = 148
# the sector of the frame the bloom is measured in: pure backdrop, no terrace
HALO_SECTOR = 'x < 452 or y < 186'


def keep_main_blob(mask, scale=4, min_px=24, pad=9):
    """Drop speckle: keep only silhouette blobs that survive at 1/scale.

    The room plate's void fitted to 1.2 RGB RMS; this one fits to 3.4, because
    a gas-lamp bloom that is OCCLUDED by a terrace is not perfectly radial and
    leaves crescent residue where the model over-subtracts. Above the |unlit -
    void| threshold that residue reads as silhouette -- a scatter of 2-8 px
    islands out in the backdrop, which would ship as visible dirt in the
    parallax layers. Labelling is done on a 4x-downsampled copy (the island is
    one 700 px blob there, so max-propagation converges in a few hundred cheap
    iterations) and the kept mask is dilated back before intersecting.
    """
    H, W = mask.shape
    sh, sw = H // scale, W // scale
    small = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255)
                       .resize((sw, sh), Image.BOX)) > 96
    lab = np.zeros((sh, sw), np.int32)
    lab[small] = np.arange(1, int(small.sum()) + 1)
    for _ in range(4 * (sh + sw)):
        prev = lab
        m = lab.copy()
        m[1:, :] = np.maximum(m[1:, :], lab[:-1, :])
        m[:-1, :] = np.maximum(m[:-1, :], lab[1:, :])
        m[:, 1:] = np.maximum(m[:, 1:], lab[:, :-1])
        m[:, :-1] = np.maximum(m[:, :-1], lab[:, 1:])
        m[~small] = 0
        lab = m
        if np.array_equal(prev, lab):
            break
    keep = np.zeros((sh, sw), bool)
    vals, counts = np.unique(lab[lab > 0], return_counts=True)
    for v, n in zip(vals, counts):
        if n >= min_px:
            keep |= (lab == v)
    big = np.asarray(Image.fromarray(keep.astype(np.uint8) * 255)
                     .resize((W, H), Image.NEAREST)) > 127
    big = morph(big, 'd', 3, pad)
    return mask & big, int(len(vals)), int(keep.sum() * scale * scale)


def x_of_y(pts, H):
    ys = [p[0] for p in pts]
    xs = [p[1] for p in pts]
    return np.interp(np.arange(H), ys, xs)


def main():
    src, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    im = Image.open(src).convert('RGB')
    W, H = im.size
    a = np.asarray(im, dtype=np.float64)
    yy, xx = np.mgrid[0:H, 0:W]
    meta = {}

    # 1 ---- void model. The centre is SEARCHED, then the model refined against
    # its own mask exactly as the room's was.
    bgc0 = ~(np.asarray(poly_mask((W, H), HULL)) > 0.5)
    best = None
    for cy in range(240, 481, 40):
        for cx in range(560, 881, 40):
            r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
            V = np.stack([r[bgc0] ** k for k in range(3)], -1)
            err = 0.0
            for c in range(3):
                coef, *_ = np.linalg.lstsq(V, a[bgc0][:, c], rcond=None)
                err += float(((V @ coef - a[bgc0][:, c]) ** 2).mean())
            if best is None or err < best[0]:
                best = (err, cx, cy)
    _, cx, cy = best
    r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    bgc, void, coefs = bgc0, None, None
    for _ in range(4):
        V = np.stack([r[bgc] ** k for k in range(3)], -1)
        void = np.zeros_like(a)
        coefs = []
        for c in range(3):
            coef, *_ = np.linalg.lstsq(V, a[bgc][:, c], rcond=None)
            coefs.append(coef.tolist())
            void[..., c] = sum(coef[k] * r ** k for k in range(3))
        d = np.sqrt(((a - void) ** 2).sum(axis=2))
        bgc = ~morph(morph(d > 7, 'd', 3), 'e', 5)
    rms = float(np.sqrt(((a[bgc] - void[bgc]) ** 2).sum(axis=1).mean()))
    meta['void'] = {'center': [cx, cy], 'model': 'quadratic in r, per channel',
                    'centerSearch': 'coarse grid 560..880 x 240..480, step 40',
                    'coeffs': coefs, 'residualRmsOnVoid': round(rms, 3)}
    print('[1/6] void model fitted at (%d,%d), residual RMS %.2f' % (cx, cy, rms),
          flush=True)

    # 2 ---- lift the gas-lamp bloom
    sub = (xx > 458) & (xx < 512) & (yy > 292) & (yy < 350)
    w = np.where(sub, np.clip(a.sum(axis=2) - 400, 0, None), 0)
    lx, ly = float((w * xx).sum() / w.sum()), float((w * yy).sum() / w.sum())
    rho = np.sqrt((xx - lx) ** 2 + (yy - ly) ** 2)
    sector = (xx < 452) | (yy < 186)
    resid = a - void
    bins = np.arange(0, HALO_MAX_R + 1, 2.0)
    prof = np.zeros((len(bins), 3))
    for i, rr in enumerate(bins):
        sel = sector & (np.abs(rho - rr) < 4)
        prof[i] = resid[sel].mean(axis=0) if sel.sum() > 30 else np.nan
    for c in range(3):
        col = prof[:, c]
        ok = ~np.isnan(col)
        prof[:, c] = np.interp(bins, bins[ok], col[ok])
    prof = np.clip(prof, 0, None)
    prof[bins > HALO_MAX_R - 12] = 0
    halo = np.zeros_like(a)
    for c in range(3):
        halo[..., c] = np.interp(np.clip(rho, 0, HALO_MAX_R), bins, prof[:, c])
    halo *= blur((rho < HALO_MAX_R).astype(np.float32), 4)[..., None]
    unlit = a - halo
    meta['halo'] = {'center': [round(lx, 1), round(ly, 1)], 'maxRadius': HALO_MAX_R,
                    'peakRgb': [round(v, 1) for v in prof[0]],
                    'sector': HALO_SECTOR,
                    'note': 'additive bloom, subtracted from the plate and '
                            're-added as a screen layer'}
    print('[2/6] lamp bloom lifted, centre (%.0f,%.0f) peak %s'
          % (lx, ly, np.round(prof[0], 1)), flush=True)

    # 3 ---- silhouette
    d = np.sqrt(((unlit - void) ** 2).sum(axis=2))
    sil = morph(morph(d > 7.5, 'd', 5), 'e', 7)
    sil = morph(sil, 'd', 3)
    raw_pct = float(sil.mean() * 100)
    sil, nblobs, kept_px = keep_main_blob(sil)
    sil = fill_holes(sil)
    silf = blur(sil.astype(np.float32), 1.0)
    meta['silhouette'] = {'rawPct': round(raw_pct, 2),
                          'blobsFound': nblobs, 'keptPct': round(sil.mean() * 100, 2),
                          'speckleDroppedPct': round(raw_pct - sil.mean() * 100, 2)}
    print('[3/6] silhouette %.1f%% of frame (%.2f%% speckle dropped, %d blobs)'
          % (sil.mean() * 100, raw_pct - sil.mean() * 100, nblobs), flush=True)

    # 4 ---- depth bands
    lamp_a = poly_mask((W, H), LAMP, feather=1.2) * silf
    base_a = below_mask((W, H), GROUND_EDGE, feather=2.5) * silf * (1 - lamp_a)
    xv = x_of_y(VILLA_EDGE, H)
    left = (xx < xv[:, None]).astype(np.float32)
    left = blur(left, 1.5)
    rest = silf * (1 - lamp_a) * (1 - base_a)
    terr_a = rest * left
    villa_a = rest * (1 - left)
    cov = {k: round(float((m > .5).mean() * 100), 2)
           for k, m in (('terrace', terr_a), ('villa', villa_a),
                        ('base', base_a), ('lamp', lamp_a))}
    meta['coveragePct'] = cov
    print('[4/6] bands', cov, flush=True)

    # 5 ---- inpaint each band's occluded neighbourhood
    print('[5/6] inpainting neighbourhoods ...', flush=True)

    def grow(m, n=13):
        return morph(m > .5, 'd', 3, n) & sil

    layers = {}
    for name, m in (('terrace', terr_a), ('villa', villa_a), ('base', base_a)):
        ext = grow(m)
        rgbf = harmonic_fill(unlit.astype(np.float32), ext & ~(m > .3))
        rgbv = np.where((m > .3)[..., None], unlit, rgbf)
        alpha = np.maximum(m, blur(ext.astype(np.float32), 5) * (ext | (m > .3)))
        layers[name] = (rgbv, np.clip(alpha, 0, 1))
        print('    %-8s inpainted %d px' % (name, int((ext & ~(m > .3)).sum())),
              flush=True)
    layers['lamp'] = (unlit, lamp_a)

    # 5b --- the bay glass overlay (see the module docstring)
    gpoly = poly_mask((W, H), BAYGLASS, feather=1.0)
    warm = (a[..., 0] - a[..., 2])
    k = np.clip((warm - 20.0) / 60.0, 0, 1)
    glass_a = gpoly * (1.0 - 0.85 * k)
    meta['bayGlass'] = {
        'poly': BAYGLASS,
        'alphaModel': 'a = poly * (1 - 0.85 * clamp((R-B - 20)/60, 0, 1))',
        'paneAlphaMean': round(float(glass_a[(gpoly > .5) & (k > .6)].mean()), 3),
        'muntinAlphaMean': round(float(glass_a[(gpoly > .5) & (k < .2)].mean()), 3),
        'note': 'overlay, NOT removed from the villa band: composited over its '
                'own source pixels it is an identity, and a sprite slipped '
                'between the two is behind glass',
    }

    # 5c --- the damp haze over the cobbles (life pass)
    mband = np.exp(-((yy - 556.0) ** 2) / (2 * 46.0 ** 2))
    mband *= np.clip((xx - 336.0) / 90.0, 0, 1) * np.clip((1040.0 - xx) / 110.0, 0, 1)
    mband *= (base_a > .3)
    mist = np.zeros_like(a)
    for c, v in enumerate((150.0, 168.0, 196.0)):
        mist[..., c] = mband * v
    meta['mist'] = {'band': 'gaussian in y about 556, sigma 46, clipped to the '
                            'base band', 'peakRgb': [150, 168, 196],
                    'note': 'screen-blended, drifts; the street is damp'}

    # 6 ---- write
    files = {}

    def put(name, img):
        p = os.path.join(outdir, name)
        img.save(p, optimize=True)
        files[name] = {'bytes': os.path.getsize(p), 'sha256': sha(p)}
        print('    %-24s %6d KB' % (name, os.path.getsize(p) // 1024), flush=True)

    put('layer0-void.png', Image.fromarray(np.clip(void, 0, 255).astype(np.uint8)))
    put('layer1-terrace.png', rgba(*layers['terrace']))
    put('layer2-villa.png', rgba(*layers['villa']))
    put('layer3-base.png', rgba(*layers['base']))
    put('layer4-lamp.png', rgba(*layers['lamp']))
    put('layer5-bayglass.png', rgba(a, glass_a))

    pad = HALO_MAX_R + 4
    x0, y0 = int(lx - pad), int(ly - pad)
    hc = np.clip(halo[y0:y0 + 2 * pad, x0:x0 + 2 * pad], 0, 255).astype(np.uint8)
    put('layer6-halo.png', Image.fromarray(hc))
    meta['halo']['cropOrigin'] = [x0, y0]
    meta['halo']['cropSize'] = [2 * pad, 2 * pad]

    my0, my1 = 470, 660
    put('layer7-mist.png',
        Image.fromarray(np.clip(mist[my0:my1], 0, 255).astype(np.uint8)))
    meta['mist']['cropOrigin'] = [0, my0]
    meta['mist']['cropSize'] = [W, my1 - my0]

    dbg = np.clip(unlit * 0.30, 0, 255)
    dbg[..., 0] += villa_a * 150 + lamp_a * 60
    dbg[..., 1] += base_a * 150 + lamp_a * 200
    dbg[..., 2] += terr_a * 170 + glass_a * 120
    put('debug-bands.png', Image.fromarray(np.clip(dbg, 0, 255).astype(np.uint8)))

    man = {'lane': 'lanestreet-layers',
           'created': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
           'source': {'path': os.path.abspath(src), 'sha256': sha(src),
                      'size': [W, H]},
           'generator': 'tools/lanestreet/slice_street.py (helpers imported '
                        'from tools/lanea/slice_plate.py)',
           'geometry': {'hull': HULL, 'lampPoly': LAMP,
                        'groundEdge': GROUND_EDGE, 'villaEdge': VILLA_EDGE,
                        'bayGlassPoly': BAYGLASS},
           'drawOrder': ['layer0-void', 'layer1-terrace', 'layer2-villa',
                         'layer3-base', 'layer4-lamp', 'layer7-mist',
                         '<ACTORS + the reveal silhouette>', 'layer5-bayglass',
                         'layer6-halo (screen)'],
           'analysis': meta, 'files': files}
    json.dump(man, open(os.path.join(outdir, 'manifest.json'), 'w'), indent=1)
    print('[6/6] -> %s' % outdir, flush=True)


if __name__ == '__main__':
    main()
