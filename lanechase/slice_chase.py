#!/usr/bin/env python3
"""slice_chase.py -- cut the chase strip into the layers the Living Book eats.

Written to tools/lanea/slice_plate.py's PATTERN, not its code, because the two
plates are not the same kind of picture. What was kept, and what had to change,
in the order slice_plate does it:

 1. FIT THE VOID.  slice_plate models 221B's backdrop as an isotropic quadratic
    in r about a fitted centre and gets 1.2 RGB RMS. That model does not fit this
    plate: the fog bank throws a broad ASYMMETRIC glow into the backdrop, and a
    search over centres bottomed out at the edge of its range at 7.65 RMS. So the
    void here is a bivariate polynomial of total degree 3 (10 terms per channel),
    fitted on the subject-free region and refined against its own mask exactly as
    slice_plate refines its.

 2. THE BLOOM.  slice_plate LIFTS 221B's one lamp bloom out of the plate and
    ships it as a screen layer, because a parallax seam runs through that halo
    and a baked bloom would tear at it. This plate has FIVE warm sources (four
    gas lamps and Briony Lodge's lit door) and nothing moves through any of them,
    so the bloom is NOT removed -- the plate keeps its painted light and the halo
    layer only ADDS the breath. Subtracting five overlapping blooms off a painted
    facade would have been five chances to leave a grey bruise on the plate for
    an effect the book cannot see.
    The profiles are still MEASURED, not invented: for each source the additive
    profile is the radial mean of the WARM EXCESS (R-B) minus its own value at
    the profile's outer radius. Warm excess is the right probe here because the
    night facade is blue-grey and every source is amber, so the bloom separates
    from the wall by hue where it would not separate by luma.

 3. SILHOUETTE.  Same as slice_plate: |plate - void| thresholded, closed,
    hole-filled. It is used for two things -- clipping the fog card to the
    diorama envelope (the ledger's explicit requirement that the fog "must sit
    INSIDE the diorama envelope from every angle"), and bounding the bands.

 4. DEPTH BANDS.  slice_plate cuts 221B with hand-authored POLYGONS. A strip's
    depth ordering runs ACROSS the road, so this plate is cut with the two
    hand-authored POLYLINES in chase_geom.py -- terrace above the kerb, roadway
    between kerb and outer edge, hull below the outer edge.

 5. INPAINT.  Same harmonic multigrid fill as slice_plate, on each band's
    occluded neighbourhood, so a parallax reveal shows plausible pixels.

 6. WHAT THIS PLATE ADDS THAT 221B HAD NO ANALOGUE FOR:
      * LAMP 2 AS A FOREGROUND OCCLUDER. It is painted standing in the roadway
        (plinth at y=480 where its column's kerb is y=427). Shipped as an RGBA
        overlay drawn AFTER the rigs, so the pursuit passes behind it. No
        inpainting is needed and none is done: the overlay lands pixel-exact on
        the lamp the plate already has, so it is a perfect restore of the plate's
        own pixels over whatever the rig covered.
      * THE FOG CARD, measured as a pale low-chroma veil and clipped to the
        envelope.
      * DOOR-OUT, a measured tone transfer that puts Briony Lodge's light out,
        sampled from this terrace's OWN unlit doors rather than from a guess.

stdlib + numpy + PIL. Deterministic, no network.
"""
import hashlib
import json
import os
import sys
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chase_geom as G  # noqa: E402


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def blur(m, r):
    return np.asarray(Image.fromarray(np.clip(m * 255, 0, 255).astype(np.uint8))
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
    for _ in range(400):
        nxt = morph(reach, 'd', 3) & inv
        nxt[0, :] |= inv[0, :]; nxt[-1, :] |= inv[-1, :]
        nxt[:, 0] |= inv[:, 0]; nxt[:, -1] |= inv[:, -1]
        if nxt.sum() == reach.sum():
            break
        reach = nxt
    return m | (inv & ~reach)


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


def poly_terms(x, y):
    return [np.ones_like(x), x, y, x * x, x * y, y * y,
            x ** 3, x * x * y, x * y * y, y ** 3]


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else '/tmp/chase-layers'
    os.makedirs(outdir, exist_ok=True)
    im = Image.open(G.MASTER).convert('RGB')
    W, H = im.size
    a = np.asarray(im, dtype=np.float64)
    yy, xx = np.mgrid[0:H, 0:W]
    nx, ny = (xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2)
    meta = {}
    files = {}

    def put(name, img):
        p = os.path.join(outdir, name)
        img.save(p, optimize=True)
        files[name] = {'bytes': os.path.getsize(p), 'sha256': sha(p)[:16],
                       'size': list(img.size)}
        print('    %-24s %8d B  %s' % (name, os.path.getsize(p), img.size), flush=True)

    # ---------------------------------------------------- 1. the void model
    bgc = np.ones((H, W), bool)
    bgc[:, 150:1330] &= (yy[:, 150:1330] < 40) | (yy[:, 150:1330] > 700)
    T = np.stack(poly_terms(nx, ny), -1)
    void = np.zeros_like(a)
    for it in range(5):
        V = T[bgc]
        coefs = []
        for c in range(3):
            co, *_ = np.linalg.lstsq(V, a[bgc][:, c], rcond=None)
            coefs.append(co.tolist())
            void[..., c] = (T @ co)
        d = np.sqrt(((a - void) ** 2).sum(axis=2))
        bgc = ~morph(morph(d > 6, 'd', 3), 'e', 5)
    rms = float(np.sqrt(((a[bgc] - void[bgc]) ** 2).sum(axis=1).mean()))
    meta['void'] = {'model': 'bivariate polynomial, total degree 3, per channel',
                    'coeffs': coefs, 'residualRmsOnVoid': round(rms, 3),
                    'voidFractionOfFrame': round(float(bgc.mean() * 100), 2)}
    print('[1/6] void fitted, residual RMS %.2f on %.1f%% of frame'
          % (rms, bgc.mean() * 100), flush=True)

    # ------------------------------------------- 2. measure the five blooms
    L = a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114
    warmx = a[..., 0] - a[..., 2]
    halo = np.zeros_like(a)
    sources = []
    for i, (sx, sy, R) in enumerate(list(G.LAMPS) + [G.DOOR]):
        name = 'lamp%d' % (i + 1) if i < len(G.LAMPS) else 'door'
        rho = np.hypot(xx - sx, yy - sy)
        bins = np.arange(0, R + 1, 3.0)
        prof = np.zeros(len(bins))
        for j, rr in enumerate(bins):
            sel = np.abs(rho - rr) < 3
            prof[j] = float(np.median(warmx[sel])) if sel.sum() > 20 else np.nan
        ok = ~np.isnan(prof)
        prof = np.interp(bins, bins[ok], prof[ok])
        prof = np.clip(prof - prof[-1], 0, None)          # additive excess only
        prof[bins > R - 8] = 0
        # the source's own hue, from its brightest core
        core = rho < 12
        hue = a[core].mean(axis=0)
        hue = hue / max(1e-6, hue.max())
        amp = np.interp(np.clip(rho, 0, R), bins, prof)
        amp *= blur((rho < R).astype(np.float32), 5)
        for c in range(3):
            halo[..., c] += amp * hue[c]
        sources.append({'id': name, 'centre': [sx, sy], 'radius': R,
                        'peakWarmExcess': round(float(prof[0]), 1),
                        'hueRgbNorm': [round(float(v), 3) for v in hue]})
        print('    %-6s peak warm excess %5.1f  hue %s'
              % (name, prof[0], np.round(hue, 2)), flush=True)
    meta['bloom'] = {'sources': sources,
                     'note': 'MEASURED but NOT subtracted -- the plate keeps its '
                             'painted light; this layer is the breath only'}
    print('[2/6] five blooms measured', flush=True)

    # -------------------------------------------------- 3. the silhouette
    d = np.sqrt(((a - void) ** 2).sum(axis=2))
    sil = morph(morph(d > 7.0, 'd', 5), 'e', 7)
    sil = fill_holes(morph(sil, 'd', 3))
    silf = blur(sil.astype(np.float32), 1.0)
    meta['silhouettePct'] = round(float(sil.mean() * 100), 2)
    print('[3/6] envelope %.1f%% of frame' % (sil.mean() * 100), flush=True)

    # ------------------------------------------------------ 4. depth bands
    kerb = np.array([G.kerb_y(x) for x in range(W)])
    outer = np.array([G.outer_y(x) for x in range(W)])
    above_kerb = (yy < kerb[None, :])
    below_outer = (yy > outer[None, :])
    terrace_a = blur(above_kerb.astype(np.float32), 1.2) * silf
    hull_a = blur(below_outer.astype(np.float32), 1.2) * silf
    road_a = np.clip(silf - terrace_a - hull_a, 0, 1)
    cov = {k: round(float((m > .5).mean() * 100), 2) for k, m in
           (('terrace', terrace_a), ('road', road_a), ('hull', hull_a))}
    meta['bandCoveragePct'] = cov
    print('[4/6] bands', cov, flush=True)

    # ------------------------------- 5. inpaint each band's occluded strip
    print('[5/6] inpainting band neighbourhoods ...', flush=True)
    layers = {}
    for nm, m in (('terrace', terrace_a), ('road', road_a), ('hull', hull_a)):
        ext = morph(m > .5, 'd', 3, 11) & sil
        rgbf = harmonic_fill(a.astype(np.float32), ext & ~(m > .3))
        rgbv = np.where((m > .3)[..., None], a, rgbf)
        alpha = np.maximum(m, blur(ext.astype(np.float32), 5) * (ext | (m > .3)))
        layers[nm] = (rgbv, np.clip(alpha, 0, 1))

    # ------------------------------------------------------------ 6. write
    put('band-terrace.png', rgba(*layers['terrace']))
    put('band-road.png', rgba(*layers['road']))
    put('band-hull.png', rgba(*layers['hull']))
    put('void.png', Image.fromarray(np.clip(void, 0, 255).astype(np.uint8)))

    # the halo breath, one layer, screen-blended
    put('halos.png', Image.fromarray(np.clip(halo * 1.0, 0, 255).astype(np.uint8)))
    # and each source cropped on its own, so a single lamp can breathe alone
    for s in sources:
        sx, sy, R = s['centre'][0], s['centre'][1], s['radius']
        x0, y0 = max(0, sx - R), max(0, sy - R)
        x1, y1 = min(W, sx + R), min(H, sy + R)
        h1 = np.zeros_like(a)
        rho = np.hypot(xx - sx, yy - sy)
        sel = rho < R
        h1[sel] = halo[sel]
        put('glow-%s.png' % s['id'],
            Image.fromarray(np.clip(h1[y0:y1, x0:x1], 0, 255).astype(np.uint8)))
        s['crop'] = [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]

    # ---- the fog card: pale, low-chroma, high-luma, clipped to the envelope
    chroma = a.max(axis=2) - a.min(axis=2)
    base = np.percentile(L[sil], 40)
    fogv = np.clip((L - base) / 90.0, 0, 1) * np.clip(1 - chroma / 55.0, 0, 1)
    ramp = np.clip((xx - G.FOG_X0) / float(G.FOG_X1 - G.FOG_X0), 0, 1) ** 1.4
    fog_a = blur(fogv * ramp, 9) * silf
    fog_a = np.clip(fog_a * 1.35, 0, 1)
    fog_rgb = np.zeros_like(a)
    fogcol = a[(fog_a > 0.35)].mean(axis=0) if (fog_a > 0.35).any() else np.array([200., 205., 210.])
    for c in range(3):
        fog_rgb[..., c] = fogcol[c]
    ys, xs = np.nonzero(fog_a > 0.02)
    fx0, fy0, fx1, fy1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    put('fog.png', rgba(fog_rgb[fy0:fy1, fx0:fx1], fog_a[fy0:fy1, fx0:fx1]))
    meta['fog'] = {'crop': [fx0, fy0, fx1 - fx0, fy1 - fy0],
                   'colour': [round(float(v), 1) for v in fogcol],
                   'maxAlpha': round(float(fog_a.max()), 3),
                   'leakOutsideEnvelopePx': int(((fog_a > 0.02) & ~sil).sum()),
                   'note': 'clipped to the diorama envelope by construction'}

    # ---- lamp 2, the foreground occluder, cut from the plate itself
    x0, y0, x1, y1 = G.LAMP2_BOX
    sub = a[y0:y1, x0:x1]
    subL = L[y0:y1, x0:x1]
    dark = subL < 46                       # the iron post against a lit facade
    bright = subL > 150                    # its own lantern
    m2 = fill_holes(morph(morph(dark | bright, 'd', 3), 'e', 3))
    al = blur(m2.astype(np.float32), 0.8)
    put('lamp2-front.png', rgba(sub, al))
    meta['lamp2'] = {'box': list(G.LAMP2_BOX), 'coveragePct':
                     round(float((al > .5).mean() * 100), 2),
                     'drawOrder': 'AFTER the rigs -- pixel-exact restore of the '
                                  'plate, so no inpaint is required'}

    # ---- door-out: put Briony Lodge's light out, using this terrace's own
    #      unlit doors as the target tone rather than a guessed darkness.
    #      A per-channel GAIN was tried first and produced an olive door: the
    #      lit door's medians are (122, 84, 61) and the unlit ones (49, 37, 39),
    #      so a ratio crushes red, leaves green and LIFTS blue's share -- the
    #      transfer has to move the mean AND the spread, not just scale. This is
    #      a mean/std (Reinhard) transfer, and the box was widened to take the
    #      light SPILL on the pavement and steps with it, which the tight box
    #      left burning in front of a dark door.
    dx0, dy0, dx1, dy1 = G.DOOR_OUT_BOX
    lit = a[dy0:dy1, dx0:dx1]
    darkrefs = np.concatenate([a[b[1]:b[3], b[0]:b[2]].reshape(-1, 3)
                               for b in G.UNLIT_DOOR_SAMPLES])
    rm, rs = darkrefs.mean(axis=0), darkrefs.std(axis=0)
    lm, ls = lit.reshape(-1, 3).mean(axis=0), lit.reshape(-1, 3).std(axis=0)
    k = np.clip(rs / np.maximum(ls, 1e-6), 0.25, 1.6)
    out = np.clip((lit - lm) * k + rm, 0, 255)
    fh, fw = out.shape[0], out.shape[1]
    fa = np.zeros((fh, fw), np.float32)
    fa[14:-14, 14:-14] = 1.0
    fa = blur(fa, 11)
    put('door-out.png', rgba(out, fa))
    meta['doorOut'] = {'box': list(G.DOOR_OUT_BOX),
                       'unlitSampleBoxes': G.UNLIT_DOOR_SAMPLES,
                       'transfer': 'mean/std (Reinhard), gain clipped 0.25..1.6',
                       'litMeanRgb': [round(float(v), 1) for v in lm],
                       'litStdRgb': [round(float(v), 1) for v in ls],
                       'unlitMeanRgb': [round(float(v), 1) for v in rm],
                       'unlitStdRgb': [round(float(v), 1) for v in rs],
                       'resultMeanRgb': [round(float(v), 1)
                                         for v in out.reshape(-1, 3).mean(axis=0)]}

    # ---- debug band map
    dbg = np.clip(a * 0.34, 0, 255)
    dbg[..., 0] += terrace_a * 150
    dbg[..., 1] += road_a * 150
    dbg[..., 2] += hull_a * 190
    put('debug-bands.png', Image.fromarray(np.clip(dbg, 0, 255).astype(np.uint8)))

    # ---- the rail, published for the grammar lane
    rail = [{'u': round(u / 40, 3),
             'x': round(G.rail(u / 40)[0], 1),
             'y': round(G.rail(u / 40)[1], 1),
             's': round(G.rail(u / 40)[2], 4)} for u in range(41)]
    meta['rail'] = {'laneT': G.LANE_T, 'x0': G.RAIL_X0, 'x1': G.RAIL_X1,
                    'scaleMeasure': 'road band width at x, normalised at x0',
                    'samples': rail}

    man = {'lane': 'lanechase-layers',
           'created': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
           'generator': 'tools/lanechase/slice_chase.py',
           'source': {'path': G.MASTER, 'sha256': sha(G.MASTER), 'size': [W, H]},
           'geometry': {'kerb': G.KERB, 'outer': G.OUTER, 'nearCut': G.NEAR_CUT,
                        'lamps': G.LAMPS, 'door': G.DOOR},
           'analysis': meta, 'files': files}
    with open(os.path.join(outdir, 'manifest.json'), 'w') as f:
        json.dump(man, f, indent=1)
    print('[6/6] -> %s' % outdir, flush=True)


if __name__ == '__main__':
    main()
