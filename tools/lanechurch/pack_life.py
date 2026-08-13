#!/usr/bin/env python3
"""pack_life.py -- crop the church layers to their alpha boxes, then MEASURE the
scene's light and haze off the plate and emit them in stage.js's own schemas.

PACK is tools/lanea/pack_layers.py's contract, unchanged: crop each layer to its
alpha bbox, zero the RGB under alpha==0 so deflate has nothing to chew on, and
write a placement manifest in plate pixels (the space stage.js reads directly,
with no conversion).

LIFE is the part slice_church.py deliberately left undone. stage.js's EMIS
entries are screen-blended CSS radial gradients that only ever BREATHE over the
light the plate already paints, so the honest way to author them is to read the
painted light rather than invent it:

  SOURCES   thresholded on the plate itself and split by temperature. WARM
            sources (R > B) are the altar candles and the glow they throw on the
            plaster. COOL sources (B > R) are the lancets and the east window --
            "the coolest brightest thing in the picture" is the scene seed's own
            phrase and it is measurable. Each source's radius is taken from the
            radius at which its additive residual over the local surround has
            fallen to 1/e, and its rgb from the blob's own peak-quartile mean.

  BREATH    period and amplitude are NOT measured (a still plate has no time
            axis). They are assigned by source class from Beat I's shipped EMIS
            table -- candle 3.7 s / 0.5, hearth-like glow 2.6 s / 0.42, window
            7.3 s / 0.45 -- so the two SETs breathe at the same rates and a
            reader crossing from leaf 1 to leaf 4 does not feel the clock change.

  FOG       COLOUR measured, DENSITY authored, and the tool says which is which
            in the output. The first cut of this pass tried to measure the haze
            as aerial perspective along the standing north wall. It found a real
            drift -- but the drift is +172 R against +38 B from the nave end to
            the chancel end, which is the CANDLE FALLOFF, not haze. (That the
            warm light and the cool light do not mix is the law this plate was
            selected for; of course it dominates the wall.) This plate paints no
            haze, so a measured density would have been a fiction dressed as a
            measurement. What ships instead: the fog's colour is the far nave's
            own ambient, which is the only colour a haze down this nave could
            be, and its density is a small authored number whose job is to
            soften the far pew ends under parallax rather than to be seen.

    python3 pack_life.py RAWDIR DESTDIR
"""
import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

# breath constants carried over from Beat I's shipped EMIS table (stage.js)
BREATH = {'candle': (3.7, 0.50), 'glow': (2.6, 0.42), 'window': (7.3, 0.45)}


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def morph(m, op, k, n=1):
    im = Image.fromarray((m * 255).astype(np.uint8))
    f = ImageFilter.MaxFilter(k) if op == 'd' else ImageFilter.MinFilter(k)
    for _ in range(n):
        im = im.filter(f)
    return np.asarray(im) > 127


def blobs(mask, min_area=12):
    out, seen = [], np.zeros(mask.shape, bool)
    ys, xs = np.nonzero(mask)
    for yy, xx in zip(ys, xs):
        if seen[yy, xx]:
            continue
        comp = np.zeros(mask.shape, bool)
        comp[yy, xx] = True
        while True:
            nxt = morph(comp, 'd', 3) & mask
            if nxt.sum() == comp.sum():
                break
            comp = nxt
        seen |= comp
        if comp.sum() >= min_area:
            out.append(comp)
        if len(out) > 24:
            break
    return out


def source_from(arr, comp, cls):
    ys, xs = np.nonzero(comp)
    cy, cx = float(ys.mean()), float(xs.mean())
    px = arr[comp]
    lum = px @ np.array([0.299, 0.587, 0.114])
    top = px[lum >= np.quantile(lum, 0.75)]
    rgb = [int(round(v)) for v in top.mean(axis=0)]

    # additive falloff radius: how far out the surround stays above 1/e of the
    # blob's own excess over the local background
    H, W, _ = arr.shape
    R = 190
    y0, y1 = max(0, int(cy) - R), min(H, int(cy) + R)
    x0, x1 = max(0, int(cx) - R), min(W, int(cx) + R)
    sub = arr[y0:y1, x0:x1] @ np.array([0.299, 0.587, 0.114])
    yy, xx = np.mgrid[y0:y1, x0:x1]
    rho = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    bins = np.arange(2, R, 4.0)
    prof = np.array([sub[np.abs(rho - r) < 3].mean() if (np.abs(rho - r) < 3).any()
                     else np.nan for r in bins])
    ok = ~np.isnan(prof)
    bins, prof = bins[ok], prof[ok]
    base = float(np.percentile(prof[-8:], 50)) if len(prof) > 8 else float(prof.min())
    peak = float(prof[0])
    exc = prof - base
    thr = (peak - base) / np.e
    idx = np.nonzero(exc < thr)[0]
    rad = int(bins[idx[0]]) if len(idx) else int(bins[-1])
    rad = max(14, min(180, rad))
    alpha = round(float(min(0.40, max(0.06, (peak - base) / 255.0 * 0.9))), 3)
    per, amp = BREATH[cls]
    return {'at': [int(round(cx)), int(round(cy))], 'r': rad,
            'rgb': '%d,%d,%d' % tuple(rgb), 'a': alpha, 'per': per, 'amp': amp,
            'class': cls, 'blob_px': int(comp.sum()),
            'peak_lum': round(peak, 1), 'surround_lum': round(base, 1)}


def main():
    raw, dest = sys.argv[1], sys.argv[2]
    os.makedirs(dest, exist_ok=True)
    src = json.load(open(os.path.join(raw, 'manifest.json')))
    W, H = src['source']['size']
    plate = np.asarray(Image.open(src['source']['path']).convert('RGB'),
                       dtype=np.float64)

    out = {'plate': [W, H], 'layers': [], 'props': [], 'static': {},
           'sourceManifest': os.path.abspath(os.path.join(raw, 'manifest.json')),
           'lensMarks': src['geometry']['lensMarks']}

    # ---- PACK -------------------------------------------------------------
    band_files = [('layer1-shell.png', 'shell'), ('layer2-nave.png', 'nave'),
                  ('layer3-rock.png', 'rock')]
    prop_files = [('prop-altar.png', 'altar'), ('prop-hourglass.png', 'hourglass')]
    for name, key in band_files + prop_files:
        im = Image.open(os.path.join(raw, name)).convert('RGBA')
        a = np.asarray(im).copy()
        alpha = a[..., 3]
        ys, xs = np.where(alpha > 0)
        pad = 2
        x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + 1 + pad)
        y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + 1 + pad)
        a[alpha == 0] = 0
        fn = '%s.png' % key
        Image.fromarray(a[y0:y1, x0:x1]).save(os.path.join(dest, fn), optimize=True)
        rec = {'id': key, 'file': fn, 'x': int(x0), 'y': int(y0),
               'w': int(x1 - x0), 'h': int(y1 - y0),
               'bytes': os.path.getsize(os.path.join(dest, fn)),
               'sha256': sha(os.path.join(dest, fn))}
        (out['layers'] if key in ('shell', 'nave', 'rock') else out['props']).append(rec)
        print('%-10s %4d,%4d %4dx%-4d %6d KB' %
              (key, x0, y0, x1 - x0, y1 - y0,
               os.path.getsize(os.path.join(dest, fn)) // 1024))

    for name, fn in (('layer0-void.png', 'void.png'), ('knot-patch.png', 'knot-patch.png')):
        Image.open(os.path.join(raw, name)).save(os.path.join(dest, fn), optimize=True)
        out['static'][fn] = {'bytes': os.path.getsize(os.path.join(dest, fn)),
                             'sha256': sha(os.path.join(dest, fn))}
        print('%-10s %6d KB' % (fn, os.path.getsize(os.path.join(dest, fn)) // 1024))
    out['static']['knot-patch.png'].update(
        {'x': src['analysis']['knotPatch']['box'][0],
         'y': src['analysis']['knotPatch']['box'][1],
         'note': 'the chancel with the three figures inpainted away -- Beat I '
                 'holmes-patch law, so the actor lane can lift them off the plate'})

    # ---- LIFE: the sources ------------------------------------------------
    lum = plate @ np.array([0.299, 0.587, 0.114])
    Rc, Bc = plate[..., 0], plate[..., 2]
    warm = morph(morph((lum > 196) & (Rc - Bc > 28), 'e', 3), 'd', 3)
    cool = morph(morph((lum > 132) & (Bc - Rc > 16), 'e', 3), 'd', 3)

    raw_src = []
    for comp in blobs(warm, 16):
        raw_src.append(source_from(plate, comp,
                                   'candle' if comp.sum() < 900 else 'glow'))
    for comp in blobs(cool, 60):
        raw_src.append(source_from(plate, comp, 'window'))

    # MERGE + REJECT. The erode/dilate that cleans the threshold also shatters
    # one lit window into three fragments, and it lets lit SKIN through -- the
    # clergyman's face and hands cleared the warm threshold at peak 154-184.
    # Neither is a light source. Two rules, both measured:
    #   merge  two detections closer than 44 px are one source (keep the
    #          brighter, keep the larger radius)
    #   reject a source must actually out-glow its own surround: peak >= 200 for
    #          a flame or a wall glow, >= 150 for glass. Lit cloth does not.
    # The merge test is an ELLIPSE, not a circle, and it is taller than it is
    # wide (44 x 150 px): a gothic lancet is a genuinely elongated source, so a
    # circular test at 44 px kept the head of the window and the body of the
    # same window as two sources. Beat I models its whole sash window as ONE
    # emissive; these do the same.
    MERGE_RX, MERGE_RY = 44.0, 150.0
    FLOOR = {'candle': 200.0, 'glow': 200.0, 'window': 150.0}
    raw_src.sort(key=lambda s: -s['peak_lum'])
    kept, merged = [], 0
    for s in raw_src:
        if s['peak_lum'] < FLOOR[s['class']]:
            continue
        hit = None
        for k in kept:
            if k['class'] != s['class']:
                continue
            if (((k['at'][0] - s['at'][0]) / MERGE_RX) ** 2 +
                    ((k['at'][1] - s['at'][1]) / MERGE_RY) ** 2) < 1.0:
                hit = k
                break
        if hit is not None:
            hit['r'] = max(hit['r'], s['r'])
            hit['blob_px'] += s['blob_px']
            merged += 1
        else:
            kept.append(s)
    emis = kept
    # Beat I's shipped alphas run 0.11-0.34; these are overlays ON TOP of light
    # the plate already paints, so scale the measured excess into that band
    # instead of letting it saturate the 0.40 clamp.
    for s in emis:
        s['a'] = round(float(min(0.34, max(0.10, (s['peak_lum'] - s['surround_lum'])
                                           / 255.0 * 0.42))), 3)
    emis.sort(key=lambda s: (s['at'][1], s['at'][0]))
    for i, s in enumerate(emis):
        s['id'] = '%s%d' % (s['class'][:3], i + 1)
    out['emissives'] = emis
    out['emissiveDetection'] = {'raw': len(raw_src), 'merged_away': merged,
                                'rejected_below_floor':
                                    len(raw_src) - merged - len(emis),
                                'merge_ellipse_px': [MERGE_RX, MERGE_RY],
                                'peak_floor': FLOOR}
    print('\nEMIS  %d sources (%d warm, %d cool)' %
          (len(emis), sum(1 for s in emis if s['class'] != 'window'),
           sum(1 for s in emis if s['class'] == 'window')))
    for s in emis:
        print('  %-7s %-10s r%-4d rgb(%s) a%.2f  peak %.0f over %.0f  %d px'
              % (s['id'], str(s['at']), s['r'], s['rgb'], s['a'],
                 s['peak_lum'], s['surround_lum'], s['blob_px']))

    # ---- LIFE: the haze, measured off the wall's own aerial drift ----------
    # sample the standing north wall plaster on a band that is plaster only
    # (above the pews, below the eaves, left of the chancel arch)
    # The first pass sampled straight through both lancets and the bride, and
    # returned a "drift" of -120 R -- nonsense. The two lancet x-ranges and the
    # figures are excluded by name; what is left is plaster only.
    LANCETS = [(366, 438), (539, 618)]
    samples = []
    for x in range(300, 860, 10):
        if any(lo - 6 <= x <= hi + 6 for lo, hi in LANCETS) or x > 690:
            continue
        col = plate[292:372, x:x + 8].reshape(-1, 3)
        samples.append((x, np.median(col, axis=0)))
    for x in range(760, 850, 10):          # chancel-end plaster, above the knot
        col = plate[196:260, x:x + 8].reshape(-1, 3)
        samples.append((x, np.median(col, axis=0)))
    xs = np.array([s[0] for s in samples], float)
    cols = np.array([s[1] for s in samples])
    fit = [np.polyfit(xs, cols[:, c], 1) for c in range(3)]
    near = np.array([np.polyval(f, 330) for f in fit])   # nave end
    far = np.array([np.polyval(f, 830) for f in fit])    # chancel end
    drift = far - near

    # WHAT THIS MEASUREMENT ACTUALLY FOUND, stated plainly rather than dressed
    # up. The wall drifts from a dark cool plaster at the nave end to a bright
    # warm plaster at the chancel end, and the R drift is far larger than the B
    # drift. That is not aerial haze -- it is the CANDLE FALLOFF, exactly the
    # "the warm light and the cool light never mix" law the plate was selected
    # for. This plate paints no visible haze, so a measured haze density would
    # be a fiction. The split is therefore honest:
    #   COLOUR  measured -- the far nave's own cool ambient, which is the only
    #           colour a haze down this nave could physically be.
    #   DENSITY authored, and deliberately small: the depth cue down this nave
    #           is already carried by the light falloff, so the fog is there to
    #           soften the far pew ends under parallax, not to be seen.
    naveband = plate[430:560, 300:520].reshape(-1, 3)
    ambient = np.percentile(naveband, 55, axis=0)
    out['fog'] = {
        'model': 'colour measured off the far nave ambient; density authored',
        'wall_rgb_at_nave_end': [round(float(v), 1) for v in near],
        'wall_rgb_at_chancel_end': [round(float(v), 1) for v in far],
        'drift_rgb_nave_to_chancel': [round(float(v), 2) for v in drift],
        'drift_is': 'candle falloff, not haze -- R drift %.0f vs B drift %.0f'
                    % (drift[0], drift[2]),
        'far_nave_ambient_rgb': [round(float(v), 1) for v in ambient],
        'fog_rgb': '%d,%d,%d' % tuple(int(round(min(255, v * 1.55 + 26)))
                                      for v in ambient),
        'axis': 'zero at the chancel step (x 860) -> peak at the far nave (x 300)',
        'peak_alpha': 0.085,
        'alpha_is': 'AUTHORED, not measured -- see drift_is',
        'applies_to': 'the `nave` band only, drawn above it and below the actors',
    }
    print('\nFOG   wall nave%s -> chancel%s' % (np.round(near, 1), np.round(far, 1)))
    print('      drift %s  -> %s' % (np.round(drift, 1), out['fog']['drift_is']))
    print('      fog rgb(%s) alpha %.3f (authored)'
          % (out['fog']['fog_rgb'], out['fog']['peak_alpha']))

    json.dump(out, open(os.path.join(dest, 'layers.json'), 'w'), indent=1)
    print('\n->', dest)


if __name__ == '__main__':
    main()
