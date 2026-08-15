#!/usr/bin/env python3
"""slice_cave.py -- ody lane: lift the LIVING LAYERS off the Polyphemus cave set.

What the sherlock plate lane (tools/lanea/slice_plate.py step 2, then
tools/lanestreet/slice_street.py + lifepass.py) did for 221B and Serpentine
Avenue, adapted to the cave plate family. This set does not need the depth-band
cut (the odyssey engine cross-fades whole painted states, street-style); what
it needs from the lane is:

  1. THE MEASURED BLOOM, lifted as its own screen-blended layer so it can
     breathe without a repaint. Each source's additive radial profile is
     measured off the plate pixels exactly the way slice_plate.py measured the
     gas lamp: annulus statistics about a brightness-weighted centroid, local
     baseline subtracted, tail clamped to zero, halo re-synthesised from the
     profile. Sources of this set:
        lampL, lampR  the two hanging lanterns (lit in EVERY state)
        mouth         the moon-light through the open mouth (dark when the
                      boulder is in: shut / embers / predawn)
        fire          the blaze. Isolated EXACTLY, not modelled: cave-shut and
                      cave-embers share their geometry (boulder in, lanterns
                      lit, same grade), so clip(shut - embers, 0) IS the
                      fire's own light and nothing else.
        embers        the faint coal glow, measured off cave-embers.
  2. A FOG CARD where the composition wants breath: this set's breath is at
     the mouth -- moon mist in the aperture and the pool it spills on the
     floor. Both blobs are PLACED BY MEASUREMENT (centroid + sigma moments of
     the plate's own cool residual), only their gain is authored. The sea set
     gets the heavy weather; the cave gets this.
  3. THE EMISSIVE TABLE (x, y, r per source, street-EMIS-shaped) with every
     centre and radius measured off the plate, plus the layer boxes.

Deterministic arithmetic only: stdlib + numpy + PIL, no model calls, no
network. Helper functions are IMPORTED from tools/lanea/slice_plate.py rather
than copied, so the two books' plates are cut by identical code.

    python3 slice_cave.py            # reads assets in place, ships in place
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
blur, sha = SP.blur, SP.sha

SETDIR = ('/Users/samz/Documents/gaslight-remake/site-deploy/living-odyssey/'
          'assets/set/cave')
OUTJSON = '/Users/samz/Documents/gaslight-remake/tools/ody/layers-cave.json'

# ---------------------------------------------------------------- sources
# Seed boxes measured off the plates at 2x with a 16 px grid; everything
# downstream of the seed (centre, radius, colour, profile) is computed.
# plate: which state the source is measured on (the one it burns in).
# metric: what weights the centroid ('warm' = R-B, 'cool' = B-R, 'lum').
# sector: optional x-clip keeping the profile annuli out of a neighbour's
#         light (lampL hangs 85 px from the mouth's blue).
SOURCES = {
    'lampL':  {'plate': 'cave.jpg', 'seed': (225, 285, 320, 395), 'thresh': 60,
               'metric': 'warm', 'rmax': 100, 'sector_xmax': 268},
    'lampR':  {'plate': 'cave.jpg', 'seed': (1235, 1295, 330, 400), 'thresh': 60,
               'metric': 'warm', 'rmax': 130},
    'mouth':  {'plate': 'cave.jpg', 'seed': (260, 430, 240, 420), 'thresh': 60,
               'metric': 'cool', 'rmax': 140},
    # rgb_rmin: the flame core of the diff is a MATERIAL swap (white blaze
    # over red coals reads cyan), so the light's chroma is taken from the
    # clean spill beyond it and the core keeps only its measured luminance.
    'fire':   {'plate': 'DIFF:cave-shut.jpg-cave-embers.jpg',
               'seed': (520, 780, 300, 520), 'thresh': 120,
               'metric': 'lum', 'rmax': 300, 'rgb_rmin': 50},
    # the coals cast no measurable halo -- clip(embers - predawn, 0) is a flat
    # ~(16,0,0) grade offset at every radius -- so this channel is the coal
    # CLUSTER itself: centroid, extent and colour of the warm pixels, shipped
    # as an EMIS gradient with no bloom card.
    'embers': {'plate': 'cave-embers.jpg', 'seed': (560, 720, 425, 495),
               'thresh': 55, 'metric': 'warm', 'mode': 'cluster'},
}

# breath authoring (the ONLY authored numbers in the table; ids note it).
# Distinct periods so no two lights ever sync, street-style.
BREATH = {
    'lampL':  {'a': 0.15, 'per': 5.7, 'amp': 0.30, 'gain': None},
    'lampR':  {'a': 0.15, 'per': 6.3, 'amp': 0.30, 'gain': None},
    'mouth':  {'a': 0.16, 'per': 9.7, 'amp': 0.22, 'gain': None},
    'fire':   {'a': 0.34, 'per': 3.1, 'amp': 0.55, 'gain': 0},
    'embers': {'a': 0.20, 'per': 4.6, 'amp': 0.50, 'gain': 0},
}


def load(name):
    if name.startswith('DIFF:'):
        # the two plates are joined as 'DIFF:<a>.jpg-<b>.jpg'
        a, b = name[5:].split('.jpg-')
        A = np.asarray(Image.open(os.path.join(SETDIR, a + '.jpg'))
                       .convert('RGB'), dtype=np.float64)
        B = np.asarray(Image.open(os.path.join(SETDIR, b)).convert('RGB'),
                       dtype=np.float64)
        return np.clip(A - B, 0, None)
    return np.asarray(Image.open(os.path.join(SETDIR, name)).convert('RGB'),
                      dtype=np.float64)


def metric_field(img, metric):
    if metric == 'warm':
        return img[..., 0] - img[..., 2]
    if metric == 'cool':
        return img[..., 2] - img[..., 0]
    return img.sum(axis=2)


def measure(name, cfg, xx, yy):
    """centroid + additive radial RGB profile + reach, all off the pixels."""
    img = load(cfg['plate'])
    x0, x1, y0, y1 = cfg['seed']
    box = (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
    w = np.where(box, np.clip(metric_field(img, cfg['metric']) - cfg['thresh'],
                              0, None), 0)
    cx = float((w * xx).sum() / w.sum())
    cy = float((w * yy).sum() / w.sum())

    rho = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)

    if cfg.get('mode') == 'cluster':
        # no halo to profile: the channel is the glowing cluster itself.
        on = w > 0
        ext = float(np.percentile(rho[on], 95))
        ring = (rho > ext + 8) & (rho < ext + 30)
        base = np.median(img[ring].reshape(-1, 3), axis=0)
        col = np.clip(img[on].reshape(-1, 3).mean(axis=0) - base, 0, None)
        rgb = np.round(col / max(col.max(), 1e-9) * 255).astype(int)
        return {'center': [round(cx, 1), round(cy, 1)],
                'r': int(round(ext)), 'rgb': [int(v) for v in rgb],
                'peakAdditiveRgb': [round(float(v), 1) for v in col],
                'baseline': [round(float(v), 1) for v in base],
                'bins': None, 'profile': None, 'rho': rho, 'rmax': None}

    rmax = cfg['rmax']
    sector = np.ones_like(rho, dtype=bool)
    if 'sector_xmax' in cfg:
        sector = xx < cfg['sector_xmax']
    bins = np.arange(0, rmax + 1, 2.0)
    prof = np.full((len(bins), 3), np.nan)
    for i, rr in enumerate(bins):
        sel = sector & (np.abs(rho - rr) < 3)
        if sel.sum() > 30:
            prof[i] = np.median(img[sel].reshape(-1, 3), axis=0)
    for c in range(3):                          # fill thin annuli
        col = prof[:, c]
        ok = ~np.isnan(col)
        prof[:, c] = np.interp(bins, bins[ok], col[ok])
    # local baseline: the median of the tail fifth of the range
    tail = bins >= rmax * 0.8
    base = np.median(prof[tail], axis=0)
    add = np.clip(prof - base, 0, None)
    add[bins > rmax - 12] = 0                   # lanea's tail clamp
    lum = add.sum(axis=1)
    peak = float(lum.max())
    peak_i = int(lum.argmax())
    floor = max(6.0, 0.04 * peak)
    lit = np.where(lum >= floor)[0]
    r_reach = float(bins[lit.max()]) if len(lit) else 0.0
    rgb_rmin = cfg.get('rgb_rmin', 0)
    if rgb_rmin:
        # chroma from the clean spill (annulus-area-weighted mean of the lit
        # bins beyond rgb_rmin); the core keeps only its measured luminance.
        sel = (lum >= floor) & (bins >= rgb_rmin)
        aw = (lum * bins)[sel]
        col = (add[sel] * aw[:, None]).sum(axis=0) / aw.sum()
        unit = col / max(col.sum(), 1e-9)
        add = lum[:, None] * unit[None, :]
    else:
        col = add[peak_i]
    rgb = np.round(col / max(col.max(), 1e-9) * 255).astype(int)
    return {'center': [round(cx, 1), round(cy, 1)], 'r': int(round(r_reach)),
            'rgb': [int(v) for v in rgb],
            'peakAdditiveRgb': [round(float(v), 1) for v in col],
            'bins': bins, 'profile': add, 'rho': rho, 'rmax': rmax,
            'baseline': [round(float(v), 1) for v in base]}


def synth_halo(m, shape):
    """re-synthesise the halo from the measured profile (lanea step 2)."""
    halo = np.zeros(shape)
    rho = np.clip(m['rho'], 0, m['rmax'])
    for c in range(3):
        halo[..., c] = np.interp(rho, m['bins'], m['profile'][:, c])
    halo *= blur((m['rho'] < m['rmax']).astype(np.float32), 4)[..., None]
    return halo


def crop_bbox(card, pad=4):
    on = card.sum(axis=2) >= 2.0
    ys, xs = np.where(on)
    H, W = on.shape
    x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + pad + 1)
    return x0, y0, x1, y1


def put(name, arr, files):
    p = os.path.join(SETDIR, name)
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(p, optimize=True)
    files[name] = {'bytes': os.path.getsize(p), 'sha256': sha(p)}
    print('    %-24s %6d KB' % (name, os.path.getsize(p) // 1024), flush=True)


def moments(w, xx, yy):
    sx = float((w * xx).sum() / w.sum())
    sy = float((w * yy).sum() / w.sum())
    vx = float(np.sqrt((w * (xx - sx) ** 2).sum() / w.sum()))
    vy = float(np.sqrt((w * (yy - sy) ** 2).sum() / w.sum()))
    return sx, sy, vx, vy


def main():
    master = load('cave.jpg')
    H, W, _ = master.shape
    yy, xx = np.mgrid[0:H, 0:W]
    files, meta = {}, {}

    # 1 ---- measure every source ----------------------------------------
    M = {}
    for name, cfg in SOURCES.items():
        M[name] = measure(name, cfg, xx, yy)
        print('[measure] %-6s centre (%6.1f,%6.1f) reach %3d px  rgb %s'
              % (name, *M[name]['center'], M[name]['r'],
                 tuple(M[name]['rgb'])), flush=True)

    # 2 ---- the standing bloom card: lamps + mouth (the master's lights) -
    bloom = np.zeros_like(master)
    for name in ('lampL', 'lampR', 'mouth'):
        bloom += synth_halo(M[name], master.shape)
    bx0, by0, bx1, by1 = crop_bbox(bloom)
    put('cave-bloom.png', bloom[by0:by1, bx0:bx1], files)
    meta['bloom'] = {'sources': ['lampL', 'lampR', 'mouth'],
                     'cropOrigin': [int(bx0), int(by0)],
                     'cropSize': [int(bx1 - bx0), int(by1 - by0)],
                     'blend': 'screen'}

    # 3 ---- the fire's own light, isolated by plate subtraction ---------
    fire = synth_halo(M['fire'], master.shape)
    fx0, fy0, fx1, fy1 = crop_bbox(fire)
    put('cave-bloom-fire.png', fire[fy0:fy1, fx0:fx1], files)
    meta['fireBloom'] = {'sources': ['fire'],
                         'isolation': 'clip(cave-shut - cave-embers, 0): same '
                                      'geometry, so the difference is the '
                                      'blaze\'s light and nothing else. Core '
                                      'chroma (r<50) is the material swap of '
                                      'white flame over red coals, so the card '
                                      'keeps the measured luminance there and '
                                      'the spill\'s measured chroma throughout',
                         'cropOrigin': [int(fx0), int(fy0)],
                         'cropSize': [int(fx1 - fx0), int(fy1 - fy0)],
                         'blend': 'screen', 'restOpacity': 0,
                         'drive': 'the shut state\'s blaze; embers states hold '
                                  'it near 0 and pulse the embers channel'}

    # 4 ---- the fog card: breath at the mouth, placed by measurement -----
    cool = np.clip(master[..., 2] - master[..., 0] - 10, 0, None)
    apert = np.where((xx >= 260) & (xx < 430) & (yy >= 240) & (yy < 400), cool, 0)
    pool = np.where((xx >= 260) & (xx < 560) & (yy >= 400) & (yy < 500), cool, 0)
    ax, ay, asx, asy = moments(apert, xx, yy)
    px, py, psx, psy = moments(pool, xx, yy)
    # fog colour = the mouth's own measured light, renormalised
    fc = np.array(M['mouth']['rgb'], dtype=np.float64) / 255.0
    inflate = 1.25          # breath overhangs the light it rides
    ga = np.exp(-(((xx - ax) / (asx * inflate)) ** 2 +
                  ((yy - ay) / (asy * inflate)) ** 2) / 2.0)
    gp = np.exp(-(((xx - px) / (psx * inflate)) ** 2 +
                  ((yy - py) / (psy * inflate)) ** 2) / 2.0)
    fog = np.zeros_like(master)
    for c in range(3):
        fog[..., c] = np.clip(ga * 115.0 * fc[c] + gp * 70.0 * fc[c], 0, 255)
    gx0, gy0, gx1, gy1 = crop_bbox(fog)
    put('cave-fog.png', fog[gy0:gy1, gx0:gx1], files)
    meta['fog'] = {
        'cropOrigin': [int(gx0), int(gy0)], 'cropSize': [int(gx1 - gx0),
                                                         int(gy1 - gy0)],
        'blend': 'screen', 'restOpacity': 0.45, 'driftPxPerSec': 2.4,
        'per': 13.0,
        'aperture': {'at': [round(ax, 1), round(ay, 1)],
                     'sigma': [round(asx, 1), round(asy, 1)]},
        'pool': {'at': [round(px, 1), round(py, 1)],
                 'sigma': [round(psx, 1), round(psy, 1)]},
        'placement': 'centroid + sigma moments of clip(B-R-10,0) in the mouth '
                     'aperture (y 240..400) and its floor spill (y 400..500); '
                     'gaussians at those moments, inflated 1.25x. Colour is '
                     'the mouth\'s own measured light. Gains (115/70) and '
                     'rest opacity are the authored numbers',
        'note': 'the cave\'s breath is moon mist at the mouth. Dark states '
                '(shut/embers/predawn) should fade it with the mouth channel; '
                'the sea set carries the heavy weather'}

    # 5 ---- the EMIS table ------------------------------------------------
    emis = []
    NOTES = {
        'lampL': 'the west lantern, on the rock left of the mouth; lit in '
                 'every state. Profile measured in the x<268 sector so the '
                 'mouth\'s blue never leaks into it',
        'lampR': 'the east lantern, over the bed; lit in every state',
        'mouth': 'the moon through the open mouth, aperture + spill. DARK '
                 'whenever the boulder is in (shut/embers/predawn); the dawn '
                 'plate repaints it warm and this channel keeps breathing it',
        'fire':  'the fire pit ablaze: centre/reach/colour measured on '
                 'clip(cave-shut - cave-embers, 0). Alpha 0.34 but gain 0 at '
                 'rest -- the shut state drives it, street-fire-style',
        'embers': 'the banked coals of cave-embers/cave-predawn: gain 0 at '
                  'rest, the ember states raise it and it only smoulders',
    }
    for name in SOURCES:
        m, b = M[name], BREATH[name]
        row = {'id': name, 'at': [int(round(m['center'][0])),
                                  int(round(m['center'][1]))],
               'r': m['r'], 'rgb': ','.join(str(v) for v in m['rgb']),
               'a': b['a'], 'per': b['per'], 'amp': b['amp']}
        if b['gain'] is not None:
            row['gain'] = b['gain']
        row['note'] = NOTES[name]
        emis.append(row)

    # 6 ---- layers-cave.json ---------------------------------------------
    states = sorted(f for f in os.listdir(SETDIR) if f.endswith('.jpg'))
    man = {
        'lane': 'ody-layers-cave',
        'created': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'generator': 'tools/ody/slice_cave.py (helpers imported from '
                     'tools/lanea/slice_plate.py)',
        'plate': [W, H],
        'sources': {f: {'sha256': sha(os.path.join(SETDIR, f))} for f in states},
        'method': 'bloom = per-source additive radial profile (annulus '
                  'median about a metric-weighted centroid, tail-fifth '
                  'baseline subtracted, clipped, tail clamped), re-synthesised '
                  'isotropically -- slice_plate.py step 2, per source. The '
                  'fire is isolated by plate subtraction instead of a void '
                  'model. Deterministic, no model calls.',
        'emissives': emis,
        'layers': {'cave-bloom.png': meta['bloom'],
                   'cave-bloom-fire.png': meta['fireBloom'],
                   'cave-fog.png': meta['fog']},
        'stateLightMap': {
            'cave.jpg':         {'lampL': 1, 'lampR': 1, 'mouth': 1, 'fire': 0, 'embers': 0, 'fog': 1},
            'cave-dawn.jpg':    {'lampL': 1, 'lampR': 1, 'mouth': 1, 'fire': 0, 'embers': 0, 'fog': 0.5},
            'cave-shut.jpg':    {'lampL': 1, 'lampR': 1, 'mouth': 0, 'fire': 1, 'embers': 0, 'fog': 0},
            'cave-embers.jpg':  {'lampL': 1, 'lampR': 1, 'mouth': 0, 'fire': 0, 'embers': 1, 'fog': 0},
            'cave-predawn.jpg': {'lampL': 1, 'lampR': 1, 'mouth': 0, 'fire': 0, 'embers': 0.5, 'fog': 0},
        },
        'measurement': {k: {'center': M[k]['center'], 'reachPx': M[k]['r'],
                            'peakAdditiveRgb': M[k]['peakAdditiveRgb'],
                            'baselineRgb': M[k]['baseline'],
                            'measuredOn': SOURCES[k]['plate'],
                            'seedBox': list(SOURCES[k]['seed'])}
                        for k in SOURCES},
        'files': files,
    }
    with open(OUTJSON, 'w') as f:
        json.dump(man, f, indent=1)
    print('-> %s  (%d emissives, %d layers)' % (OUTJSON, len(emis),
                                                len(man['layers'])), flush=True)


if __name__ == '__main__':
    main()
