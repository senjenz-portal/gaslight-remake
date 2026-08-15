#!/usr/bin/env python3
"""slice_shore.py -- odyssey shore SET: lift the living layers off the plate.

What lanea/slice_plate.py and lanestreet/slice_street.py did for the sherlock
plates, adapted to the shore of the odyssey chapter. The sherlock lanes cut
PARALLAX bands because their sets scroll; the living-odyssey engine mounts one
1408x768 plate and breathes it (WIRING.md sec 7, setkit emissives/breathe), so
what this set needs from its lane is exactly the sherlock sets' LIFE PASS:

  1. the campfire's bloom, MEASURED as an additive radial profile about its
     own fitted centre (lanea step 2, with the base taken from the profile's
     own tail instead of a fitted void: this bloom lies on sand, not backdrop)
     and shipped as a tight screen-blended crop -> shore-bloom.png, so the set
     can pulse the fire without repainting the plate.
  2. the moon's path on the water, measured as luminance-weighted anchors down
     the glint band -> EMIS entries (a specular band is not a halo; it breathes
     as setkit radial emissives, the way street's `spill`/`wet` chain did).
  3. a fog breath at the waterline -> shore-fog.png, screen-blended, alpha
     feather BAKED IN (street shipped a full-alpha card and had to be masked
     in CSS to kill the seam -- see the mist note in living/app/sets/street.js).
  4. layers-shore.json: the EMIS table (x, y, r per source, measured off the
     plate pixels) + the layer boxes, the shape street's life.json shipped.

Helpers are IMPORTED from tools/lanea/slice_plate.py, not copied.
stdlib + numpy + PIL. Deterministic arithmetic only, no model calls.

    python3 slice_shore.py            # fixed src/out, they are the contract
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
blur, rgba, sha = SP.blur, SP.rgba, SP.sha

ROOT = '/Users/samz/Documents/gaslight-remake'
SETDIR = ROOT + '/site-deploy/living-odyssey/assets/set/shore'
SRC = SETDIR + '/shore.jpg'           # the night master; shore-day.jpg is the
DAY = SETDIR + '/shore-day.jpg'       # painted day state (fire OUT, sun path)
OUT_JSON = ROOT + '/tools/ody/layers-shore.json'

# ---- measured search windows (probe: fire core bbox x 378..505 y 440..497,
# moon glint bbox x 606..821 y 275..554; nothing else on the plate is bright)
FIRE_MAX_R = 190                      # sand warm excess reaches the base level
                                      # (R-B median ~5) at rho ~185
MOON_BOX = (420, 250, 860, 580)       # x0, y0, x1, y1 window on the inlet

# ---- the fog band: where the composition wants breath. The beach meets the
# water along y ~ 470..545 and the inlet's far bank rides to y ~ 560; one low
# gaussian band across the waterline, ramped off both island edges.
FOG_Y0, FOG_SIG = 506.0, 54.0
FOG_X_IN, FOG_X_OUT = (380.0, 470.0), (1080.0, 1180.0)
FOG_PEAK_A = 0.62


def lum_of(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def rgb_str(v):
    """peak-normalised css triple: the tint, at full brightness"""
    v = np.asarray(v, dtype=np.float64)
    v = v / max(v.max(), 1e-6) * 255.0
    return ','.join(str(int(round(x))) for x in v)


def main():
    im = Image.open(SRC).convert('RGB')
    W, H = im.size
    a = np.asarray(im, dtype=np.float64)
    yy, xx = np.mgrid[0:H, 0:W]
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    lum = lum_of(a)
    meta = {}

    # 1 ---- THE CAMPFIRE BLOOM, lifted (lanea step 2, sand-based) ---------
    # centre: luminance-weighted centroid of the flame core. R-B > 100 cannot
    # be foliage (the olive trees top out near 70) and R > 200 cannot be sand.
    core = (R > 200) & (R - B > 100)
    wc = np.where(core, lum, 0.0)
    fx = float((wc * xx).sum() / wc.sum())
    fy = float((wc * yy).sum() / wc.sum())
    rho = np.sqrt((xx - fx) ** 2 + (yy - fy) ** 2)

    # THE BASE PROBLEM, and why this is not lanea's tail subtraction: lanea's
    # lamp stood against the fitted void, and street's did too. This fire
    # stands on a beach it lights ALL OF -- the sand's warm excess only dies
    # at rho ~185, at the island's dark rim, where the material changes. So
    # there is no unlit-sand base to subtract. Instead the additive light is
    # measured by SAME-MATERIAL DIFFERENCING:
    #   * falloff = the warm-excess (R - B) median profile over the sand
    #     (moonlit water is R < B, foliage is masked by R >= G - 4; neither
    #     can leak in), base = the profile's own far tail;
    #   * tint = (near sand ring - far sand ring) per unit of warm excess --
    #     the same sand under more and less firelight, so the sand's own
    #     albedo cancels and what remains is the light.
    sand = (R >= G - 4) & (G >= B - 8)
    w = R - B
    bins = np.arange(0, FIRE_MAX_R + 1, 2.0)
    wprof = np.full(len(bins), np.nan)
    for i, rr in enumerate(bins):
        sel = sand & (np.abs(rho - rr) < 3)
        if sel.sum() > 40:
            wprof[i] = np.median(w[sel])
    ok = ~np.isnan(wprof)
    wprof = np.interp(bins, bins[ok], wprof[ok])
    base_w = wprof[bins >= FIRE_MAX_R - 20].mean()
    excess = np.clip(wprof - base_w, 0, None)
    excess[bins > FIRE_MAX_R - 10] = 0                  # lanea's tail clamp
    # the sand's own facets wiggle the binned medians, and a wiggle in a
    # radial profile ships as a visible RING: boxcar it twice, then hold the
    # falloff monotone -- a bloom cannot brighten with distance.
    k = np.ones(5) / 5.0
    for _ in range(2):                # edge-padded: 'same' zero-pads, and a
        excess = np.convolve(          # zero-dented first bin would cap the
            np.pad(excess, 2, mode='edge'), k, mode='valid')  # whole envelope
    excess = np.minimum.accumulate(excess)

    near = sand & (rho >= 20) & (rho < 45)
    far = sand & (rho >= 115) & (rho < 145)
    dm = np.median(a[near], axis=0) - np.median(a[far], axis=0)
    dw = float(np.median(w[near]) - np.median(w[far]))
    tint_per_w = np.clip(dm / max(dw, 1e-6), 0, None)   # rgb per unit R-B
    peak = excess[0] * tint_per_w

    halo = np.zeros_like(a)
    ex_im = np.interp(np.clip(rho, 0, FIRE_MAX_R), bins, excess)
    for c in range(3):
        halo[..., c] = ex_im * tint_per_w[c]
    halo *= blur((rho < FIRE_MAX_R).astype(np.float32), 4)[..., None]

    # the emissive's own radius: where the measured excess dies (< 8% of peak)
    alive = np.where(excess > 0.08 * excess[0])[0]
    fire_r = int(round(bins[alive[-1]])) if len(alive) else FIRE_MAX_R
    meta['fireBloom'] = {
        'center': [round(fx, 1), round(fy, 1)], 'maxRadius': FIRE_MAX_R,
        'emissiveRadius': fire_r,
        'peakRgb': [round(float(v), 1) for v in peak],
        'peakWarmExcess': round(float(excess[0]), 1),
        'baseWarmExcess': round(float(base_w), 1),
        'tintPerWarmUnit': [round(float(v), 3) for v in tint_per_w],
        'model': 'falloff = median (R-B) profile over the sand sector, base = '
                 'its own tail (r %d..%d), tail clamped to 0, boxcar(5)x2 + '
                 'monotone envelope against facet ringing; tint = (sand at '
                 'r 20..45 - sand at r 115..145) / their warm-excess delta, '
                 'so the sand albedo cancels and what remains is the light'
                 % (FIRE_MAX_R - 20, FIRE_MAX_R),
        'note': 'additive bloom; ships as a screen layer the set pulses',
    }
    print('[1/4] fire bloom centre (%.0f,%.0f) r %d peak %s'
          % (fx, fy, fire_r, np.round(peak, 1)), flush=True)

    # 2 ---- THE MOONPATH, anchored (specular band -> EMIS chain) ----------
    x0, y0, x1, y1 = MOON_BOX
    cool = (lum > 150) & (B > R - 12) & (xx >= x0) & (xx < x1) & \
           (yy >= y0) & (yy < y1)
    wgt = np.where(cool, lum - 150.0, 0.0)
    ys = yy[cool]
    seg_edges = np.percentile(ys, [0, 33, 66, 100])
    anchors = []
    for i in range(3):
        seg = cool & (yy >= seg_edges[i]) & (yy <= seg_edges[i + 1])
        w = np.where(seg, lum - 150.0, 0.0)
        sx = float((w * xx).sum() / w.sum())
        sy = float((w * yy).sum() / w.sum())
        # rms radius of the segment's glitter about its own centre, x1.8 so
        # the emissive's 72%-stop gradient reaches the measured extent
        rr = float(np.sqrt((w * ((xx - sx) ** 2 + (yy - sy) ** 2)).sum()
                           / w.sum()))
        anchors.append({'at': [round(sx, 1), round(sy, 1)],
                        'r': int(round(rr * 1.8)),
                        'n': int(seg.sum())})
    moon_rgb = a[cool & (lum > 220)].mean(axis=0)
    meta['moonpath'] = {
        'bbox': [int(xx[cool].min()), int(yy[cool].min()),
                 int(xx[cool].max()), int(yy[cool].max())],
        'coolBrightPx': int(cool.sum()),
        'glintMeanRgb': [round(v, 1) for v in moon_rgb],
        'anchors': anchors,
        'model': 'lum>150 & B>R-12 in the inlet window, split at the 33rd/66th '
                 'y-percentiles; luminance-weighted centroid + 1.8x rms radius',
        'note': 'a specular band is not a halo: it breathes as EMIS anchors, '
                'the way street chained bay -> spill -> wet',
    }
    print('[2/4] moonpath anchors %s'
          % [(p['at'], p['r']) for p in anchors], flush=True)

    # 3 ---- THE FOG, at the waterline (alpha feather BAKED IN) ------------
    # tint: measured, not authored -- halfway between the moonlit glitter and
    # the night backdrop's own hue raised to vapor brightness.
    backdrop = np.median(a[lum < 45].reshape(-1, 3), axis=0)
    bd_lift = backdrop / max(backdrop.max(), 1e-6) * (lum_of(moon_rgb[None])[0] * 0.8)
    tint = 0.5 * moon_rgb + 0.5 * bd_lift
    band = np.exp(-((yy - FOG_Y0) ** 2) / (2 * FOG_SIG ** 2))
    ramp_in = np.clip((xx - FOG_X_IN[0]) / (FOG_X_IN[1] - FOG_X_IN[0]), 0, 1)
    ramp_out = np.clip((FOG_X_OUT[1] - xx) / (FOG_X_OUT[1] - FOG_X_OUT[0]), 0, 1)
    fog_a = band * ramp_in * ramp_out * FOG_PEAK_A
    fog_rgb = np.zeros_like(a)
    fog_rgb[...] = tint
    meta['fog'] = {
        'tintRgb': [round(float(v), 1) for v in tint],
        'tintModel': '0.5*glintMean + 0.5*(backdrop hue raised to 0.8x glint '
                     'luminance); backdrop = median of plate px with lum<45',
        'band': 'gaussian in y about %.0f, sigma %.0f; x ramps %s up, %s down'
                % (FOG_Y0, FOG_SIG, list(FOG_X_IN), list(FOG_X_OUT)),
        'peakAlpha': FOG_PEAK_A,
        'note': 'screen-blended, drifts; feather baked into the alpha so no '
                'CSS mask is needed (street shipped the seam, sec street.js)',
    }
    print('[3/4] fog tint %s' % np.round(tint, 1), flush=True)

    # 4 ---- write ----------------------------------------------------------
    files = {}

    def put(name, img):
        p = os.path.join(SETDIR, name)
        img.save(p, optimize=True)
        files[name] = {'bytes': os.path.getsize(p), 'sha256': sha(p)}
        print('    %-18s %5d KB' % (name, os.path.getsize(p) // 1024), flush=True)

    pad = FIRE_MAX_R + 4
    bx0, by0 = int(fx - pad), int(fy - pad)
    bloom = np.clip(halo[by0:by0 + 2 * pad, bx0:bx0 + 2 * pad], 0, 255)
    put('shore-bloom.png', Image.fromarray(bloom.astype(np.uint8)))
    bloom_box = [bx0, by0, 2 * pad, 2 * pad]

    fy0, fy1 = int(FOG_Y0 - 3 * FOG_SIG), min(H, int(FOG_Y0 + 3 * FOG_SIG))
    fx0, fx1 = int(FOG_X_IN[0]), int(FOG_X_OUT[1])
    put('shore-fog.png',
        rgba(fog_rgb[fy0:fy1, fx0:fx1], fog_a[fy0:fy1, fx0:fx1]))
    fog_box = [fx0, fy0, fx1 - fx0, fy1 - fy0]

    # ---- the EMIS table, street life.json's shape. per/amp are the life
    # pass's authored breath (sherlock's fire breathed at 3.1 s); everything
    # spatial and chromatic is measured above.
    emis = [
        {'id': 'fire', 'at': [int(round(fx)), int(round(fy))], 'r': fire_r,
         'rgb': rgb_str(peak), 'a': 0.17, 'per': 3.4, 'amp': 0.5,
         'note': 'the campfire on the beach; centre + radius + tint are '
                 'shore-bloom.png\'s own measured profile. OUT in shore-day '
                 '(the state paints dead coals): gain 0.'},
        {'id': 'moon-throat', 'at': anchors[0]['at'], 'r': anchors[0]['r'],
         'rgb': rgb_str(moon_rgb), 'a': 0.08, 'per': 9.7, 'amp': 0.22,
         'note': 'the moonpath where it enters the inlet (top third of the '
                 'glint band)'},
        {'id': 'moon-glint', 'at': anchors[1]['at'], 'r': anchors[1]['r'],
         'rgb': rgb_str(moon_rgb), 'a': 0.10, 'per': 7.9, 'amp': 0.26,
         'note': 'the brightest reach of the path, mid-band between the ships '
                 'and the far bank'},
        {'id': 'moon-wash', 'at': anchors[2]['at'], 'r': anchors[2]['r'],
         'rgb': rgb_str(moon_rgb), 'a': 0.07, 'per': 8.6, 'amp': 0.30,
         'note': 'the path dying against the beach shallows (bottom third)'},
    ]

    man = {
        'lane': 'ody-shore-layers', 'plate': [W, H],
        'created': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'source': {'path': SRC, 'sha256': sha(SRC), 'size': [W, H]},
        'states': {
            'shore': {'file': 'shore.jpg',
                      'gains': {'fire': 1, 'moon-throat': 1, 'moon-glint': 1,
                                'moon-wash': 1}},
            'shore-day': {'file': 'shore-day.jpg', 'sha256': sha(DAY),
                          'gains': {'fire': 0, 'moon-throat': 0.5,
                                    'moon-glint': 0.5, 'moon-wash': 0.5},
                          'note': 'the fire is painted OUT (dead coals, goats '
                                  'loose); the band is the SUN\'s path -- the '
                                  'anchors hold, the night tint does not, so '
                                  'the day state halves them rather than '
                                  'recolours'},
        },
        'generator': 'tools/ody/slice_shore.py (helpers imported from '
                     'tools/lanea/slice_plate.py)',
        'emissives': emis,
        'layers': {
            'bloom': {'file': 'shore-bloom.png', 'box': bloom_box,
                      'blend': 'screen', 'per': 3.4, 'amp': 0.35,
                      'note': 'the measured additive fire bloom; pulse its '
                              'opacity with the fire emissive, gain 0 in '
                              'shore-day'},
            'fog': {'file': 'shore-fog.png', 'box': fog_box,
                    'blend': 'screen', 'driftPxPerSec': 2.6, 'per': 12.0,
                    'baseOpacity': 0.5,
                    'note': 'the waterline breath; alpha feather baked in, '
                            'no CSS mask needed'},
        },
        'drawOrder': ['shore.jpg (or state)', 'shore-fog.png (screen)',
                      '<ACTORS>', 'shore-bloom.png (screen)',
                      'EMIS divs (setkit emissives, breathe)'],
        'analysis': meta, 'files': files,
    }
    json.dump(man, open(OUT_JSON, 'w'), indent=1)
    print('[4/4] -> %s + %s' % (SETDIR, OUT_JSON), flush=True)


if __name__ == '__main__':
    main()
