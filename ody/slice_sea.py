#!/usr/bin/env python3
"""slice_sea.py -- LIVING LAYERS for the odyssey SEA set (leaf 5, Beat VI).

What the sherlock plate lanes did (tools/lanea/slice_plate.py, whose helpers
this module IMPORTS rather than copies, and tools/lanestreet/slice_street.py),
adapted to this plate. The sea plate is one master, no state variants
(assets/set/sea/sea.jpg only), so there is no state cross-fade to cut -- the
life of this set is its LIGHT and its BREATH:

  1. fit the void: isotropic radial gradient, quadratic in r, centre SEARCHED
     (slice_street's method; a hard-coded centre is a lie on a new plate).
  2. lift the MOON's bloom the sherlock way: the halo's additive radial profile
     is measured on true void pixels around the measured disc centre (the disc
     itself is silhouette, so the profile's inner bins extend flat from the
     first clean annulus -- no seam at the disc edge) and ships as its own
     screen-blended, breathing layer.
  3. lift the CAVE-GLOW at the cliff base as a measured WARM-RESIDUAL layer,
     NOT a radial profile: this fire is anisotropic -- a mouth at the cliff
     base, a lit path down to the water, a crag face catching the same light
     two hundred px up -- and a radial model would smear light onto rock the
     plate keeps dark. Instead the additive light is estimated per pixel as
     warmth * (measured fire colour direction), where the fire colour is the
     measured peak-glow colour minus the measured unlit-rock colour, clamped
     so no channel adds more light than the plate itself shows.
  4. build the FOG where the composition wants breath -- the sea gets the
     most (vs shore/cave): a gaussian band in y whose centre and width come
     from the measured water mask, clipped to the water, thinned over the
     moonpath so the glints stay readable, plus a wisp at the cliff base
     where the cave-glow meets the sea. Tinted with the measured moonpath
     glint colour. Ships screen-blended like street's layer7-mist.
  5. measure the EMIS anchors (x, y, r per source, street.js-style): weighted
     centroids and 90%-mass radii off the plate pixels. at/r/rgb are MEASURED;
     a/per/amp are authored breathing params in the sherlock sets' idiom.

This set's sources: MOON + CAVE-GLOW at the cliff base (the moonpath and the
lit crag are the same two lights' spill, and ship as spill entries the way
street.js ships 'spill'/'wet' under its lamp and bay).

stdlib + numpy + PIL. Deterministic arithmetic only -- no RNG, no model calls.

    python3 slice_sea.py            # paths are fixed; reruns are idempotent
"""
import importlib.util
import json
import os
import time

import numpy as np
from PIL import Image

_SPEC = importlib.util.spec_from_file_location(
    'slice_plate', '/Users/samz/Documents/gaslight-remake/tools/lanea/slice_plate.py')
SP = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(SP)          # module level is constants only, no work
blur, morph, fill_holes = SP.blur, SP.morph, SP.fill_holes
poly_mask, sha = SP.poly_mask, SP.sha

ROOT = '/Users/samz/Documents/gaslight-remake'
SRC = ROOT + '/site-deploy/living-odyssey/assets/set/sea/sea.jpg'
OUTDIR = ROOT + '/site-deploy/living-odyssey/assets/set/sea'
JSON_OUT = ROOT + '/tools/ody/layers-sea.json'
WORK = ROOT + '/tools/ody/work'

# ---------------------------------------------------------------- geometry
# All measured off the plate (tools/ody/work/seaprobe*.py + sea-grid.png,
# a 64 px measuring grid, 2026-08-14). The island HULL is a polygon, not a
# rectangle: a margins-only void fit extrapolates unconstrained into the
# middle of the frame and its centre search parked 49 px from the moon,
# swallowing the halo into the void model. With the polygon the fit keeps
# real sky on every side of the moon and the halo survives in the residual.
HULL_ISLAND = [(705, 180), (770, 100), (855, 12), (975, 10), (1045, 45),
               (1100, 95), (1135, 180), (1160, 330), (1165, 480),
               (1000, 600), (860, 665), (715, 715), (640, 712), (450, 610),
               (300, 530), (225, 455), (225, 435), (610, 220)]
MOON_EXCL_R = 175                    # moon disc + halo, kept out of the fit
MOON_WIN = (395, 550, 180, 290)      # x0,x1,y0,y1: the disc's own window
MOON_MAX_R = 168                     # halo measured dead past ~150
CAVE_WIN = [(656, 190), (912, 190), (912, 578), (656, 578)]  # fire gate box
ROCK_REF = (995, 1005, 295, 305)     # unlit rock sample, same cliff, no glow
WARM_T = 18.0                        # R-B above this is fire-lit
VOID_GRID = (range(100, 501, 50), range(400, 1001, 50))      # cy, cx search


def centroid(weight, xx, yy):
    s = weight.sum()
    return float((weight * xx).sum() / s), float((weight * yy).sum() / s)


def r90(weight, cx, cy, xx, yy):
    """radius enclosing 90% of the weighted mass about (cx, cy)"""
    w = weight[weight > 0]
    rho = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)[weight > 0]
    order = np.argsort(rho)
    cum = np.cumsum(w[order])
    return float(rho[order][np.searchsorted(cum, 0.9 * cum[-1])])


def crop_box(img, thresh=2.0, pad=4):
    """tight nonzero bbox of an RGB float image, padded, as [x, y, w, h]"""
    on = img.max(axis=2) > thresh
    ys, xs = np.where(on)
    x0 = max(0, int(xs.min()) - pad); y0 = max(0, int(ys.min()) - pad)
    x1 = min(img.shape[1], int(xs.max()) + pad + 1)
    y1 = min(img.shape[0], int(ys.max()) + pad + 1)
    return [x0, y0, x1 - x0, y1 - y0]


def norm_rgb(v):
    """measured additive colour -> street.js 'rgb' string (max channel 255)"""
    v = np.clip(np.asarray(v, dtype=float), 0, None)
    v = v / max(v.max(), 1e-6) * 255.0
    return ','.join(str(int(round(c))) for c in v)


def main():
    os.makedirs(WORK, exist_ok=True)
    im = Image.open(SRC).convert('RGB')
    W, H = im.size
    a = np.asarray(im, dtype=np.float64)
    yy, xx = np.mgrid[0:H, 0:W]
    s = a.sum(axis=2)
    meta = {}

    # 1 ---- void model, centre searched then refined against its own mask.
    # Excluded from the fit: the island polygon and the moon's own circle.
    hullm = np.asarray(poly_mask((W, H), HULL_ISLAND)) > 0.5
    moonm = np.sqrt((xx - 474.0) ** 2 + (yy - 242.0) ** 2) < MOON_EXCL_R
    bgc0 = ~(hullm | moonm)
    best = None
    with np.errstate(all='ignore'):
        for cy in VOID_GRID[0]:
            for cx in VOID_GRID[1]:
                r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
                V = np.stack([r[bgc0] ** k for k in range(3)], -1)
                err = 0.0
                for c in range(3):
                    coef, *_ = np.linalg.lstsq(V, a[bgc0][:, c], rcond=None)
                    err += float(((V @ coef - a[bgc0][:, c]) ** 2).mean())
                if np.isfinite(err) and (best is None or err < best[0]):
                    best = (err, cx, cy)
    _, vcx, vcy = best
    r = np.sqrt((xx - vcx) ** 2 + (yy - vcy) ** 2)
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
    meta['void'] = {'center': [vcx, vcy], 'model': 'quadratic in r, per channel',
                    'centerSearch': 'coarse grid 400..1000 x 100..500, step 50; '
                                    'island hull polygon + moon circle excluded',
                    'coeffs': coefs, 'residualRmsOnVoid': round(rms, 3)}
    print('[1/6] void fitted at (%d,%d), residual RMS %.2f' % (vcx, vcy, rms),
          flush=True)

    resid = a - void

    # 2 ---- the MOON: disc measured, halo lifted the sherlock way. Measured
    # BEFORE any silhouette, on the hull's own sky (the lanes' order: halo
    # first, silhouette off the unlit plate -- or the halo reads as content).
    win = (xx > MOON_WIN[0]) & (xx < MOON_WIN[1]) & \
          (yy > MOON_WIN[2]) & (yy < MOON_WIN[3])
    w = np.where(win & (s > 420), s - 300, 0)
    mx, my = centroid(w, xx, yy)
    disc_r = float(np.sqrt(((w > 0).sum()) / np.pi))
    rho = np.sqrt((xx - mx) ** 2 + (yy - my) ** 2)
    # sky sector: outside the island hull, clear of the disc. Inner bins are
    # empty and extend flat from the first clean annulus -- no seam.
    sector = (~hullm) & (rho > disc_r + 8) & (xx < 700) & (yy < 580)
    bins = np.arange(0, MOON_MAX_R + 1, 2.0)
    prof = np.zeros((len(bins), 3))
    for i, rr in enumerate(bins):
        sel = sector & (np.abs(rho - rr) < 4)
        prof[i] = resid[sel].mean(axis=0) if sel.sum() > 30 else np.nan
    for c in range(3):
        col = prof[:, c]
        ok = ~np.isnan(col)
        prof[:, c] = np.interp(bins, bins[ok], col[ok])
    prof = np.clip(prof, 0, None)
    prof[bins > MOON_MAX_R - 12] = 0
    halo = np.zeros_like(a)
    for c in range(3):
        halo[..., c] = np.interp(np.clip(rho, 0, MOON_MAX_R), bins, prof[:, c])
    halo *= blur((rho < MOON_MAX_R).astype(np.float32), 4)[..., None]
    moon_r = r90(halo.sum(axis=2), mx, my, xx, yy)
    moon_rgb = prof[np.argmax(prof.sum(axis=1))]
    unlit = a - halo

    # ---- silhouette (island + ship), off the UNLIT plate; fog's water clip
    d = np.sqrt(((unlit - void) ** 2).sum(axis=2))
    sil = morph(morph(d > 7.5, 'd', 5), 'e', 7)
    sil = morph(sil, 'd', 3)
    sil = fill_holes(sil)
    meta['moon'] = {'disc': [round(mx, 1), round(my, 1)],
                    'discRadius': round(disc_r, 1), 'maxRadius': MOON_MAX_R,
                    'r90': round(moon_r, 1),
                    'peakRgb': [round(v, 1) for v in moon_rgb],
                    'note': 'additive halo measured on void pixels only; the '
                            'disc is painted content and stays in the plate'}
    print('[2/6] moon disc (%.0f,%.0f) r%.0f, halo r90 %.0f peak %s'
          % (mx, my, disc_r, moon_r, np.round(moon_rgb, 1)), flush=True)

    # ---- the MOONPATH: the moon's spill on the water, measured off glints
    glint = (s > 420) & (a[..., 2] >= a[..., 0] - 10) & (yy > 250) & \
            (rho > disc_r * 1.3) & sil & hullm
    gw = np.where(glint, s - 380, 0)
    gx, gy = centroid(gw, xx, yy)
    g_r = r90(gw, gx, gy, xx, yy)
    glint_col = a[glint].mean(axis=0)
    meta['moonpath'] = {'centroid': [round(gx, 1), round(gy, 1)],
                        'r90': round(g_r, 1), 'px': int(glint.sum()),
                        'meanRgb': [round(v, 1) for v in glint_col]}
    print('      moonpath centroid (%.0f,%.0f) r90 %.0f, %d glint px'
          % (gx, gy, g_r, glint.sum()), flush=True)

    # 3 ---- the CAVE-GLOW at the cliff base: measured warm-residual layer
    warm = np.clip(a[..., 0] - a[..., 2] - WARM_T, 0, None)
    gate = np.asarray(poly_mask((W, H), CAVE_WIN, feather=9.0))
    warm *= gate
    hot = (warm > 90 - WARM_T) & (a[..., 0] > 150)
    hw = np.where(hot, warm, 0)
    cvx, cvy = centroid(hw, xx, yy)
    cave_r = r90(hw, cvx, cvy, xx, yy)
    rx0, rx1, ry0, ry1 = ROCK_REF
    rock = a[ry0:ry1, rx0:rx1].reshape(-1, 3).mean(axis=0)
    top = warm >= np.percentile(warm[hot], 90) if hot.any() else hot
    peak = a[top].mean(axis=0)
    wpeak = warm[top].mean()
    ratio = np.clip(peak - rock, 0, None) / max(wpeak, 1e-6)
    fire = np.minimum(warm[..., None] * ratio[None, None, :], a)
    fire = np.clip(fire, 0, 255)
    # the crag face: the same fire's spill up the cliff, its own EMIS anchor
    crag = ((a[..., 0] - a[..., 2]) > 25) & ((a[..., 0] - a[..., 2]) <= 90) & \
           (xx > 680) & (yy < 462) & (gate > .5)
    cw = np.where(crag, a[..., 0] - a[..., 2], 0)
    crx, cry = centroid(cw, xx, yy)
    crag_r = r90(cw, crx, cry, xx, yy)
    meta['cave'] = {'mouth': [round(cvx, 1), round(cvy, 1)],
                    'r90': round(cave_r, 1),
                    'rockRef': [round(v, 1) for v in rock],
                    'peakRgb': [round(v, 1) for v in peak],
                    'fireColourPerWarm': [round(v, 3) for v in ratio],
                    'model': 'bloom = min(clip(R-B-%g,0) * fireColour, plate); '
                             'anisotropic by construction' % WARM_T,
                    'crag': {'centroid': [round(crx, 1), round(cry, 1)],
                             'r90': round(crag_r, 1)}}
    print('[3/6] cave mouth (%.0f,%.0f) r90 %.0f, crag (%.0f,%.0f) r90 %.0f, '
          'fire colour/warm %s' % (cvx, cvy, cave_r, crx, cry, crag_r,
                                   np.round(ratio, 2)), flush=True)

    # 4 ---- the FOG: the sea's breath, measured off the water it lies on
    water = sil & hullm & (a[..., 2] - a[..., 0] > 25) & (s > 110) & (yy < 650)
    wy = yy[water]
    y10, y60, y90 = (float(np.percentile(wy, p)) for p in (10, 60, 90))
    fy, fsig = y60, 0.22 * (y90 - y10)
    wmask = blur(water.astype(np.float32), 9)
    band = np.exp(-((yy - fy) ** 2) / (2 * fsig ** 2)) * wmask
    band *= 1 - 0.35 * blur(glint.astype(np.float32), 6)   # the path reads
    # the wisp at the cliff base, where the glow meets the sea
    ref = hot & (yy > 492)
    if ref.any():
        wx_, wy_ = centroid(np.where(ref, warm, 0), xx, yy)
    else:
        wx_, wy_ = cvx, cvy + 60
    wisp = np.exp(-((xx - wx_) ** 2) / (2 * 56.0 ** 2)
                  - ((yy - wy_) ** 2) / (2 * 34.0 ** 2))
    wisp *= blur(sil.astype(np.float32), 9) * 0.8
    fogk = np.clip(band + wisp, 0, 1)
    tint = glint_col / glint_col.max()          # the breath is moon-coloured
    fog = fogk[..., None] * (tint * 176.0)[None, None, :]
    meta['fog'] = {'band': 'gaussian in y about %.0f, sigma %.1f, clipped to '
                           'the measured water mask' % (fy, fsig),
                   'waterYPercentiles': {'p10': y10, 'p60': y60, 'p90': y90},
                   'moonpathThin': 0.35,
                   'wisp': {'at': [round(wx_, 1), round(wy_, 1)],
                            'sigma': [56, 34], 'gain': 0.8},
                   'peakRgb': [int(round(v)) for v in tint * 176.0],
                   'tintSource': 'mean moonpath glint colour, normalised',
                   'note': 'screen-blended, drifts; the sea gets the most '
                           'breath of the three odyssey sets'}
    print('[4/6] fog band y %.0f sigma %.0f, wisp at (%.0f,%.0f), peak %s'
          % (fy, fsig, wx_, wy_, meta['fog']['peakRgb']), flush=True)

    # 5 ---- EMIS table, street.js-shaped: at/r/rgb MEASURED, a/per/amp
    # authored breathing params (the sherlock idiom: fire fast + deep, moon
    # slow + shallow; crag rides the cave's own clock -- one fire).
    # moon/moonpath tints come off the LIGHT's own painted pixels (disc,
    # glints), not the void residual: the void model over-predicts B near the
    # moon by a few counts, which normalised into a green moon. The residual
    # peaks stay in analysis; the tint is the light the plate actually paints.
    disc_rgb = a[win & (s > 420)].mean(axis=0)
    emis = [
        {'id': 'moon', 'at': [int(round(mx)), int(round(my))],
         'r': int(round(moon_r)), 'rgb': norm_rgb(disc_rgb),
         'a': 0.10, 'per': 9.5, 'amp': 0.18, 'role': 'source'},
        {'id': 'moonpath', 'at': [int(round(gx)), int(round(gy))],
         'r': int(round(g_r)), 'rgb': norm_rgb(glint_col),
         'a': 0.09, 'per': 7.3, 'amp': 0.35, 'role': 'spill of moon'},
        {'id': 'cave', 'at': [int(round(cvx)), int(round(cvy))],
         'r': int(round(cave_r)), 'rgb': norm_rgb(peak - rock),
         'a': 0.20, 'per': 3.2, 'amp': 0.55, 'role': 'source'},
        {'id': 'crag', 'at': [int(round(crx)), int(round(cry))],
         'r': int(round(crag_r)), 'rgb': norm_rgb(ratio),
         'a': 0.10, 'per': 3.2, 'amp': 0.45,
         'role': 'spill of cave up the cliff face (same clock: one fire)'},
    ]

    # 6 ---- write: tight crops, screen-blended, boxes recorded
    files, layers = {}, {}

    def put(name, arr, box, blend, note, alpha=None):
        p = os.path.join(OUTDIR, name)
        x0, y0, bw, bh = box
        crop = np.clip(arr[y0:y0 + bh, x0:x0 + bw], 0, 255).astype(np.uint8)
        Image.fromarray(crop).save(p, optimize=True)
        files[name] = {'bytes': os.path.getsize(p), 'sha256': sha(p)}
        layers[name] = {'box': box, 'blend': blend, 'note': note}
        if alpha:
            layers[name]['opacity'] = alpha
        print('    %-22s %6d KB  box %s' % (name, os.path.getsize(p) // 1024,
                                            box), flush=True)

    print('[5/6] shipping ->', OUTDIR, flush=True)
    pad = MOON_MAX_R + 4
    put('sea-bloom-moon.png', halo,
        [int(mx) - pad, int(my) - pad, 2 * pad, 2 * pad], 'screen',
        'the moon halo, measured radial profile; breathe on EMIS moon',
        alpha=[0.10, 0.28])
    put('sea-bloom-cave.png', fire, crop_box(fire), 'screen',
        'the cave fire (mouth + lit path + crag), measured warm residual; '
        'flicker on EMIS cave clock', alpha=[0.20, 0.75])
    put('sea-fog.png', fog, crop_box(fog), 'screen',
        'the sea breath; drift +/-90 px, feather in CSS like street mist',
        alpha=[0.45, 0.70])

    # debug composite (NOT shipped): plate with layers screened at rest alpha
    comp = a.copy()
    for arr, k in ((halo, 0.19), (fire, 0.45), (fog, 0.58)):
        comp = 255 - (255 - comp) * (255 - arr * k) / 255.0
    dbg = comp.copy()
    for e in emis:
        exx, eyy = e['at']
        rr = np.sqrt((xx - exx) ** 2 + (yy - eyy) ** 2)
        dbg[np.abs(rr - e['r']) < 1.2] = (255, 40, 40)
        dbg[np.abs(rr - 4) < 2] = (40, 255, 40)
    Image.fromarray(np.clip(dbg, 0, 255).astype(np.uint8)) \
        .save(os.path.join(WORK, 'debug-sea-layers.png'))
    Image.fromarray(np.clip(comp, 0, 255).astype(np.uint8)) \
        .save(os.path.join(WORK, 'debug-sea-composite.png'))

    man = {'lane': 'ody-sea-layers',
           'created': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
           'source': {'path': SRC, 'sha256': sha(SRC), 'size': [W, H],
                      'states': ['sea'],
                      'note': 'single master; no state variants shipped'},
           'generator': 'tools/ody/slice_sea.py (helpers imported from '
                        'tools/lanea/slice_plate.py)',
           'lightSources': 'moon + cave-glow at the cliff base '
                           '(moonpath and crag are their measured spill)',
           'geometry': {'hullIsland': HULL_ISLAND, 'moonExclR': MOON_EXCL_R,
                        'caveGate': CAVE_WIN, 'rockRef': list(ROCK_REF)},
           'emis': emis,
           'emisNote': 'at/r/rgb MEASURED off the plate (weighted centroids, '
                       '90%-mass radii, additive peak colours); a/per/amp '
                       'authored breathing params, street.js idiom',
           'layers': layers,
           'drawOrder': ['sea.jpg', 'sea-fog.png (screen, drifts)',
                         '<ACTORS>', 'sea-bloom-cave.png (screen, flickers)',
                         'sea-bloom-moon.png (screen, breathes)'],
           'analysis': meta, 'files': files}
    json.dump(man, open(JSON_OUT, 'w'), indent=1)
    print('[6/6] -> %s' % JSON_OUT, flush=True)


if __name__ == '__main__':
    main()
