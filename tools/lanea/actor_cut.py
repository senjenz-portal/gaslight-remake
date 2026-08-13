#!/usr/bin/env python3
"""actor_cut.py -- cut the standing figure out of the plate and put the room back.

Two stages, because the honest matte needs the answer to the inpaint:

  prep   export the padded context crop that goes to the image model, plus a
         flat-filled "hole" variant, plus the coarse polygon mask.
  matte  take the model's inpainted crop, align it back to plate pixels, then
         derive the figure's alpha from |plate - inpaint| INSIDE the polygon.
         Writes: the RGBA cutout, the five puppet parts, a room layer with the
         figure removed (paste confined to the dilated polygon), and a diff
         report proving nothing outside that region moved.

stdlib + numpy + PIL. Deterministic. No network (nbpro_edit.py does that bit).
"""
import argparse
import hashlib
import json
import os
import sys
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from holmes_geom import (CROP, HOLMES_POLY, PARTS, PLATE, ROOM_ORIGIN,  # noqa: E402
                         ROOM_SIZE, floor_y)
from slice_plate import harmonic_fill                                   # noqa: E402

ROOT = '/Users/samz/Documents/gaslight-remake'
SRC = os.path.join(ROOT, 'assets/plates/backdrop.png')
ROOM = os.path.join(ROOT, 'site-deploy/king-demo/living-plate/room.png')
UPS = 3                                   # crop upscale handed to the model


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def poly_mask(size, pts):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return np.asarray(m, dtype=np.float32) / 255.0


def morph(m, op, k, n=1):
    im = Image.fromarray((m * 255).astype(np.uint8))
    f = ImageFilter.MaxFilter(k) if op == 'd' else ImageFilter.MinFilter(k)
    for _ in range(n):
        im = im.filter(f)
    return np.asarray(im) > 127


def blur(a, r):
    return np.asarray(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255.0


def shift_tolerant_diff(a, b, rad=3):
    """per-pixel min over |a(p) - b(p+s)| for s in the +-rad square, both ways.

    b is the generative fill: it re-renders everything, so structure that only
    MOVED scores near zero, while a body that is absent from b scores high at
    every offset."""
    H, W, _ = a.shape
    best = np.full((H, W), np.inf, np.float32)
    ab = np.asarray(Image.fromarray(a.astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(0.7)), np.float32)
    bb = np.asarray(Image.fromarray(b.astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(0.7)), np.float32)
    for dy in range(-rad, rad + 1):
        for dx in range(-rad, rad + 1):
            sh = np.roll(np.roll(bb, dy, axis=0), dx, axis=1)
            best = np.minimum(best, np.sqrt(((ab - sh) ** 2).sum(2)))
            sh2 = np.roll(np.roll(ab, dy, axis=0), dx, axis=1)
            best = np.minimum(best, np.sqrt(((sh2 - bb) ** 2).sum(2)))
    return best


def largest_blob(m):
    """keep the connected component that contains the figure's centre of mass"""
    lab = np.zeros(m.shape, np.int32)
    cur = 0
    best, bestn = 0, 0
    idx = np.argwhere(m)
    seen = np.zeros(m.shape, bool)
    H, W = m.shape
    for sy, sx in idx:
        if seen[sy, sx]:
            continue
        cur += 1
        stack = [(sy, sx)]
        seen[sy, sx] = True
        n = 0
        while stack:
            y, x = stack.pop()
            lab[y, x] = cur
            n += 1
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        if n > bestn:
            bestn, best = n, cur
    return lab == best


# ------------------------------------------------------------------ prep ----
def prep(outdir):
    os.makedirs(outdir, exist_ok=True)
    plate = Image.open(SRC).convert('RGB')
    x0, y0, x1, y1 = CROP
    crop = plate.crop(CROP)
    big = crop.resize(((x1 - x0) * UPS, (y1 - y0) * UPS), Image.LANCZOS)
    p_ctx = os.path.join(outdir, 'inpaint-context.png')
    big.save(p_ctx)

    m = poly_mask(PLATE[:2], HOLMES_POLY)
    mc = m[y0:y1, x0:x1]
    hole = np.asarray(crop, np.float32).copy()
    # flat fill the figure with the crop's median so the model sees a hole,
    # not a person -- the belt-and-braces variant if the plain ask wanders
    med = np.median(np.asarray(crop, np.float32)[mc < 0.5], axis=0)
    hole[mc > 0.5] = med
    p_hole = os.path.join(outdir, 'inpaint-hole.png')
    Image.fromarray(hole.astype(np.uint8)).resize(big.size, Image.LANCZOS).save(p_hole)

    Image.fromarray((mc * 255).astype(np.uint8)).save(os.path.join(outdir, 'poly-mask.png'))
    man = {
        'lane': 'lanea-actors', 'stage': 'prep',
        'created': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'generator': 'tools/lanea/actor_cut.py prep',
        'source': {'path': SRC, 'sha256': sha(SRC), 'size': list(PLATE)},
        'crop': list(CROP), 'upscale': UPS, 'cropSize': list(big.size),
        'polygon': HOLMES_POLY,
        'coarseCoveragePct': round(float(mc.mean() * 100), 2),
        'files': {os.path.basename(p): {'bytes': os.path.getsize(p), 'sha256': sha(p)}
                  for p in (p_ctx, p_hole)},
    }
    json.dump(man, open(os.path.join(outdir, 'manifest-prep.json'), 'w'), indent=1)
    print(json.dumps({'ok': True, 'context': p_ctx, 'hole': p_hole,
                      'cropSize': big.size, 'coverage': man['coarseCoveragePct']}))


# ----------------------------------------------------------------- matte ----
def matte(outdir, inpaint_path, ship_dir):
    plate = np.asarray(Image.open(SRC).convert('RGB'), np.float32)
    x0, y0, x1, y1 = CROP
    cw, ch = x1 - x0, y1 - y0

    ip = Image.open(inpaint_path).convert('RGB')
    if ip.size != (cw, ch):
        ip = ip.resize((cw, ch), Image.LANCZOS)
    ipa = np.asarray(ip, np.float32)
    orig = plate[y0:y1, x0:x1]

    poly = poly_mask(PLATE[:2], HOLMES_POLY)[y0:y1, x0:x1]
    polyd = morph(poly > 0.5, 'd', 5, 3).astype(np.float32)     # +6 px headroom

    # how faithful was the model OUTSIDE the figure? (reported, not enforced)
    out = polyd < 0.5
    outside_rms = float(np.sqrt(((orig - ipa) ** 2).sum(2)[out].mean()))
    inside_rms = float(np.sqrt(((orig - ipa) ** 2).sum(2)[polyd > 0.5].mean()))

    # a global levels match on the OUTSIDE pixels pulls the model's exposure
    # back onto the plate's, so the seam does not read as a patch
    fix = ipa.copy()
    for c in range(3):
        o, m = orig[..., c][out], ipa[..., c][out]
        s = float(o.std() / max(m.std(), 1e-6))
        s = min(max(s, 0.75), 1.33)
        fix[..., c] = (ipa[..., c] - m.mean()) * s + o.mean()
    fix = np.clip(fix, 0, 255)
    fixed_out_rms = float(np.sqrt(((orig - fix) ** 2).sum(2)[out].mean()))

    # ---- the matte: the figure is where the plate disagrees with the fill
    # A generative fill re-renders the WHOLE crop, so unchanged structures come
    # back a pixel or two off and a naive diff calls them "figure". Score each
    # pixel by the BEST agreement over a small shift window instead: geometry
    # that merely moved forgives, a body that is simply not there cannot.
    # The plain diff says "this pixel changed"; the shift-tolerant one says
    # "and no small offset explains it". Requiring both keeps low-contrast
    # figure (dark trousers on dark floor) while dropping structure the fill
    # merely re-drew a pixel or two over (the fireplace jamb beside him).
    d = np.sqrt(((orig - fix) ** 2).sum(2))
    dshift = shift_tolerant_diff(orig, fix, rad=3)
    thr, thr_shift = 26.0, 10.0
    # ...and one colour veto. A fire-lit post of the fireplace surround stands
    # immediately to his left; the fill re-draws it in a slightly different
    # place, so no diff can tell it from him. Below the pipe hand the figure is
    # only gown, trousers and shoes -- all of which read blue-of-red -- while
    # the post is pure firelight, so hue settles it where geometry cannot.
    yy = np.arange(orig.shape[0])[:, None] + y0
    warm = (orig[..., 0] - orig[..., 2]) > 45
    veto = (yy > 352) & warm
    raw = (d > thr) & (dshift > thr_shift) & (poly > 0.5) & ~veto
    raw = morph(morph(raw, 'd', 3), 'e', 3)
    raw = largest_blob(raw)
    raw = morph(raw, 'd', 3)
    alpha = np.clip(blur(raw.astype(np.float32), 0.9) * 1.25, 0, 1)
    alpha[poly < 0.5] = 0.0

    # ---- the clean room: paste the fill, confined to the dilated polygon
    feather = blur(polyd, 2.0)
    clean_crop = orig * (1 - feather[..., None]) + fix * feather[..., None]
    clean = plate.copy()
    clean[y0:y1, x0:x1] = clean_crop

    os.makedirs(outdir, exist_ok=True)
    files = {}

    def put(path, img):
        img.save(path, optimize=True)
        files[os.path.basename(path)] = {'bytes': os.path.getsize(path),
                                         'sha256': sha(path)}
        return path

    # diff proof: plate vs clean plate, per region
    dd = np.sqrt(((plate - clean) ** 2).sum(2))
    allowed = np.zeros(dd.shape, bool)
    allowed[y0:y1, x0:x1] = morph(polyd > 0.5, 'd', 5, 2)       # +4 px of feather
    changed = dd > 6.0
    leak = int((changed & ~allowed).sum())
    inside_changed = int((changed & allowed).sum())

    put(os.path.join(outdir, 'diff-mask.png'),
        Image.fromarray(np.stack([
            np.clip(dd * 4, 0, 255),
            allowed * 90.0,
            np.clip(dd * 4, 0, 255) * 0,
        ], -1).astype(np.uint8)))
    put(os.path.join(outdir, 'plate-clean.png'),
        Image.fromarray(clean.astype(np.uint8)))

    # ---- the cutout, tight-cropped
    ys, xs = np.where(alpha > 0.02)
    by0, by1 = int(ys.min()) + y0, int(ys.max()) + 1 + y0
    bx0, bx1 = int(xs.min()) + x0, int(xs.max()) + 1 + x0
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    rgba[..., :3] = orig.astype(np.uint8)
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    cut = Image.fromarray(rgba).crop((bx0 - x0, by0 - y0, bx1 - x0, by1 - y0))
    put(os.path.join(outdir, 'holmes.png'), cut)

    # ---- the puppet parts: one strict partition of the matte.
    # Claims are resolved in order into a label map, then each label is
    # softened by a sub-pixel blur and the set is renormalised to a partition
    # of UNITY. Overlapping boxes would double-draw the sleeve; hard labels
    # would open a one-pixel crack the moment two parts rotated apart. This
    # does neither: every pixel's weight is spent exactly once.
    yyp = np.arange(alpha.shape[0])[:, None] + y0
    claim = np.zeros(alpha.shape, np.int32)
    order = []
    for i, (name, spec) in enumerate(PARTS, start=1):
        if 'poly' in spec:
            m = poly_mask(PLATE[:2], spec['poly'])[y0:y1, x0:x1] > 0.5
        else:
            b0, b1 = spec['band']
            m = (yyp >= b0) & (yyp < b1)
        claim[(claim == 0) & m] = i
        order.append((i, name, spec))
    # Each label is grown by one pixel before it is softened. Two parts that
    # SUM to the figure's alpha do not COMPOSITE to it -- two 50 % edges stack
    # to 75 % and the seam reads as a crack of daylight through him. Overlap by
    # a pixel instead: while he is at rest the overlap is the same paint twice
    # and cannot be seen, and when two parts swing apart it is the pixel that
    # keeps the join closed.
    softs = {i: np.clip(blur(morph(claim == i, 'd', 3).astype(np.float32), 0.7) * 1.7,
                        0, 1) for i, _, _ in order}
    parts = {}
    zof = {i: spec['z'] for i, _, spec in order}
    for i, name, spec in order:
        pa = alpha * softs[i]
        if pa.max() < 0.05:
            continue
        # HEADROOM. A cut-out puppet has nothing behind its own arm: swing the
        # arm and the fireplace shows through the hole it left. So every part
        # is extended UNDER the parts that cover it -- 14 px of it -- and those
        # pixels are harmonically filled from the part's own paint. The gown
        # continues behind the sleeve, so the sleeve has somewhere to move to.
        above = np.zeros(alpha.shape, bool)
        for j, _, sj in order:
            if sj['z'] > spec['z']:
                above |= (claim == j)
        ext = above & morph(claim == i, 'd', 3, 7) & (alpha > 0.35)
        rgbp = orig
        if ext.any():
            # the fill must be fed the PART's paint, not the room's: seed
            # everything off the figure with the part's own mean so the
            # Laplacian cannot reach around the silhouette and drag the
            # fireplace in behind his sleeve
            own = (claim == i) & (alpha > 0.5)
            seed = orig.copy()
            if own.any():
                seed[alpha <= 0.35] = orig[own].mean(0)
            rgbp = harmonic_fill(seed.astype(np.float32), ext)
            rgbp = np.where(ext[..., None], rgbp, orig)
            pa = np.maximum(pa, alpha * blur(ext.astype(np.float32), 1.0))
        pys, pxs = np.where(pa > 0.02)
        ay0, ay1 = int(pys.min()), int(pys.max()) + 1
        ax0, ax1 = int(pxs.min()), int(pxs.max()) + 1
        arr = np.zeros((ay1 - ay0, ax1 - ax0, 4), np.uint8)
        arr[..., :3] = np.clip(rgbp[ay0:ay1, ax0:ax1], 0, 255).astype(np.uint8)
        arr[..., 3] = (pa[ay0:ay1, ax0:ax1] * 255).astype(np.uint8)
        p = put(os.path.join(outdir, 'part-%s.png' % name), Image.fromarray(arr))
        parts[name] = {
            'file': os.path.basename(p),
            'x': ax0 + x0, 'y': ay0 + y0, 'w': ax1 - ax0, 'h': ay1 - ay0,
            'pivot': list(spec['pivot']), 'z': spec['z'],
            'coveragePx': int((pa > 0.5).sum()),
        }

    # the partition has to put him back together again: composite the five
    # parts at their own offsets and diff the alpha against the whole cutout
    recomp = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
    for name, spec in sorted(parts.items(), key=lambda kv: kv[1]['z']):
        recomp.alpha_composite(Image.open(os.path.join(outdir, spec['file'])),
                               (spec['x'] - x0, spec['y'] - y0))
    ra = np.asarray(recomp, np.float32)[..., 3]
    da = np.abs(ra - alpha * 255)
    partition_resid = {'maxAlphaDelta': float(da.max()),
                       'pxOver16': int((da > 16).sum()),
                       'ofFigurePx': int((alpha > 0.5).sum())}

    man = {
        'lane': 'lanea-actors', 'stage': 'matte',
        'partitionResidual': partition_resid,
        'created': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'generator': 'tools/lanea/actor_cut.py matte',
        'source': {'path': SRC, 'sha256': sha(SRC)},
        'inpaint': {'path': os.path.abspath(inpaint_path),
                    'sha256': sha(inpaint_path)},
        'crop': list(CROP),
        'inpaintFidelity': {
            'outsidePolygonRms': round(outside_rms, 2),
            'outsideAfterLevelsMatch': round(fixed_out_rms, 2),
            'insidePolygonRms': round(inside_rms, 2),
            'note': 'the model is only trusted INSIDE the polygon; the paste is '
                    'masked, and diffLeakPx proves the rest of the plate is untouched',
        },
        'diff': {'thresholdRgbDist': 6.0, 'changedInsideAllowedPx': inside_changed,
                 'changedOutsideAllowedPx': leak,
                 'allowedRegionPx': int(allowed.sum())},
        'cutout': {'file': 'holmes.png', 'x': bx0, 'y': by0,
                   'w': bx1 - bx0, 'h': by1 - by0,
                   'alphaPx': int((alpha > 0.5).sum())},
        'parts': parts,
        'floor': {'shoeBaseY': round(floor_y((bx0 + bx1) / 2), 1),
                  'cutoutBottomY': by1},
        'files': files,
    }
    json.dump(man, open(os.path.join(outdir, 'manifest-matte.json'), 'w'), indent=1)

    # ---- ship: the room depth layer with the figure removed
    if ship_dir:
        rx, ry = ROOM_ORIGIN
        room = Image.open(ROOM).convert('RGBA')
        ra = np.asarray(room, np.float32).copy()
        sub = clean[ry:ry + ROOM_SIZE[1], rx:rx + ROOM_SIZE[0]]
        w = np.zeros(ra.shape[:2], np.float32)
        w[y0 - ry:y1 - ry, x0 - rx:x1 - rx] = feather
        ra[..., :3] = ra[..., :3] * (1 - w[..., None]) + sub * w[..., None]
        # the figure stood clear of the room silhouette's edge, so alpha is
        # untouched -- but make sure the vacated pixels are opaque
        ra[..., 3] = np.maximum(ra[..., 3], (w > 0.5) * 255.0)
        out_room = os.path.join(ship_dir, 'room-clean.png')
        Image.fromarray(ra.astype(np.uint8)).save(out_room, optimize=True)
        man['ship'] = {'roomClean': out_room, 'bytes': os.path.getsize(out_room),
                       'sha256': sha(out_room)}
        json.dump(man, open(os.path.join(outdir, 'manifest-matte.json'), 'w'), indent=1)

    print(json.dumps({'ok': True, 'leakPx': leak, 'insidePx': inside_changed,
                      'outsideRms': round(outside_rms, 2),
                      'outsideAfterMatch': round(fixed_out_rms, 2),
                      'cutout': man['cutout'],
                      'parts': {k: v['coveragePx'] for k, v in parts.items()}}))


# -------------------------------------------------------------- occluder ----
def occluder(outdir, inpaint_path, ship_dir):
    """Watson + his armchair, cut from the PLATE ITSELF as a front layer.

    Same trick as the figure: a fill that has them removed, diffed against the
    plate, gives the silhouette. The alpha is then applied to the plate's own
    pixels -- so wherever this layer is opaque it paints exactly what the room
    layer already painted, and the only thing it can ever change is what a
    walking actor behind it is allowed to show."""
    from holmes_geom import CHAIR_CROP, CHAIR_POLY
    plate = np.asarray(Image.open(SRC).convert('RGB'), np.float32)
    x0, y0, x1, y1 = CHAIR_CROP
    cw, ch = x1 - x0, y1 - y0
    ip = Image.open(inpaint_path).convert('RGB')
    if ip.size != (cw, ch):
        ip = ip.resize((cw, ch), Image.LANCZOS)
    fill = np.asarray(ip, np.float32)
    orig = plate[y0:y1, x0:x1]

    poly = poly_mask(PLATE[:2], CHAIR_POLY)[y0:y1, x0:x1]
    d = np.sqrt(((orig - fill) ** 2).sum(2))
    dshift = shift_tolerant_diff(orig, fill, rad=3)
    raw = (d > 24) & (dshift > 9) & (poly > 0.5)
    raw = morph(morph(raw, 'd', 3), 'e', 3)
    raw = largest_blob(raw)
    raw = fill_holes(raw)
    raw = morph(raw, 'd', 3)                     # a touch generous: better the
    alpha = np.clip(blur(raw.astype(np.float32), 0.8) * 1.3, 0, 1)  # occluder
    alpha[poly < 0.5] = 0.0                      # eats 1 px than leaks 1 px

    ys, xs = np.where(alpha > 0.02)
    by0, by1 = int(ys.min()), int(ys.max()) + 1
    bx0, bx1 = int(xs.min()), int(xs.max()) + 1
    arr = np.zeros((by1 - by0, bx1 - bx0, 4), np.uint8)
    arr[..., :3] = orig[by0:by1, bx0:bx1].astype(np.uint8)
    arr[..., 3] = (alpha[by0:by1, bx0:bx1] * 255).astype(np.uint8)

    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(ship_dir or outdir, 'chair.png')
    Image.fromarray(arr).save(out, optimize=True)

    # proof it is a free layer: composite over the plate, expect zero change
    comp = Image.fromarray(plate.astype(np.uint8)).convert('RGBA')
    comp.alpha_composite(Image.fromarray(arr), (bx0 + x0, by0 + y0))
    rt = np.sqrt(((plate - np.asarray(comp.convert('RGB'), np.float32)) ** 2).sum(2))
    man = {
        'lane': 'lanea-actors', 'stage': 'occluder',
        'created': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'generator': 'tools/lanea/actor_cut.py occ',
        'source': {'path': SRC, 'sha256': sha(SRC)},
        'inpaint': {'path': os.path.abspath(inpaint_path), 'sha256': sha(inpaint_path)},
        'crop': list(CHAIR_CROP), 'polygon': CHAIR_POLY,
        'layer': {'file': 'chair.png', 'x': bx0 + x0, 'y': by0 + y0,
                  'w': bx1 - bx0, 'h': by1 - by0,
                  'opaquePx': int((alpha > 0.5).sum()),
                  'bytes': os.path.getsize(out), 'sha256': sha(out)},
        'freeLayerProof': {'meanRgbDistVsPlate': round(float(rt.mean()), 4),
                           'maxRgbDist': round(float(rt.max()), 2),
                           'pxOver6': int((rt > 6).sum())},
    }
    json.dump(man, open(os.path.join(outdir, 'manifest-occluder.json'), 'w'), indent=1)
    print(json.dumps({'ok': True, 'out': out, 'layer': man['layer'],
                      'freeLayer': man['freeLayerProof']}))


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


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['prep', 'matte', 'occ'])
    ap.add_argument('--out', required=True)
    ap.add_argument('--inpaint')
    ap.add_argument('--ship')
    a = ap.parse_args()
    if a.cmd == 'prep':
        prep(a.out)
    elif a.cmd == 'occ':
        occluder(a.out, a.inpaint, a.ship)
    else:
        matte(a.out, a.inpaint, a.ship)
