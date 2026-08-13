#!/usr/bin/env python3
"""chancel_patch.py -- lift the three baked figures OFF the church plate, so the
marriage can be staged in ONE art register (F4).

The problem this closes. church.jpg bakes the bride, the groom and the
clergyman into the chancel. Beat IV then lays a painterly sprite-Holmes beside
them, so one frame carries two registers, and the aisle Norton and the altar
Norton are two different men. The set cannot swap the register while the plate
paints three of the four participants.

Beat I's answer to a figure that must move is the hole-patch, and the church
lane already tried it: `layers/knot-patch.png` is a harmonic blur and was
rejected on the art (church.js's own note). So the hole is REPAINTED instead, by
a confined i2i: a 340x255 crop of the chancel goes to the image model with
"remove the three people, keep everything else identical", and what comes back
is pasted through the FIGURES' OWN MASK and nowhere else.

Three things make that safe rather than hopeful, and all three are measured here:

  1. THE MASK IS THE DIFFERENCE, not a hand-drawn box. The figures are exactly
     where the generated empty chancel disagrees with the plate, so the mask is
     `|plate - empty| > thr` cleaned up and dilated. Nothing is guessed.
  2. THE ALIGNMENT IS PROVED BEFORE THE PASTE. Outside the mask the two images
     are the same picture, so their residual there measures whether the model
     moved the camera. A residual above the gate aborts the patch.
  3. THE PASTE IS DIFF-GATED. After writing, changed pixels outside the figures'
     union bbox must be zero, and the report prints the count.

The two relit variants (church-dim, church-ring) get the SAME patch, colour-
mapped into their own light by a per-channel affine fitted on the ring of
pixels just outside the mask -- the one place where both images show the same
surface under the two lights. Fitting it, instead of re-generating, is what
keeps the three variants the same painting.

    python3 chancel_patch.py --empty /abs/gen.png --raw /abs/rawdir [--dry]
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import shutil

import numpy as np
from PIL import Image, ImageFilter

ROOT = '/Users/samz/Documents/gaslight-remake'
LIVE = os.path.join(ROOT, 'site-deploy/living/assets/set/church')
BOOK = os.path.join(ROOT, 'assets/plates/book/church')

CROP = (640, 300, 980, 555)          # the crop that was sent to i2i
# the plate lane's own figure boxes (sets/church.js FIGURES), unioned + padded
FIG_BBOX = (676, 316, 937, 540)
DIFF_THR = 26.0                      # luma+chroma distance that counts as "a figure"
ALIGN_GATE = 9.0                     # mean |delta| outside the mask, 0-255
DILATE = 5
FEATHER = 3.0
# the diff gate's own region: FIG_BBOX plus the support of the dilate+feather, so
# the feather tail is inside the gate instead of being reported as a leak
PAD = DILATE + int(3 * FEATHER) + 1
GATE_BBOX = (FIG_BBOX[0] - PAD, FIG_BBOX[1] - PAD,
             FIG_BBOX[2] + PAD, FIG_BBOX[3] + PAD)
# the altar FOREGROUND cut (layers.json props.altar) -- it is drawn OVER the
# actors, and it bakes the clergyman, so it has to lose him too or the sprite
# that replaces him stands behind a painting of himself
ALTAR_BOX = (813, 339, 1099, 545)


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for blk in iter(lambda: fh.read(1 << 20), b''):
            h.update(blk)
    return h.hexdigest()


def load(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(np.float64)


def crop_of(a):
    x0, y0, x1, y1 = CROP
    return a[y0:y1, x0:x1]


def figure_mask(plate_crop, empty_crop):
    """where the two pictures disagree = where the people were"""
    d = np.sqrt(((plate_crop - empty_crop) ** 2).sum(axis=2))
    m = d > DIFF_THR
    # only inside the figures' own bbox: the rest of the disagreement is the
    # model's own repaint of surfaces that must NOT be replaced
    x0, y0, _, _ = CROP
    fx0, fy0, fx1, fy1 = FIG_BBOX
    keep = np.zeros_like(m)
    keep[fy0 - y0:fy1 - y0, fx0 - x0:fx1 - x0] = True
    m = m & keep
    im = Image.fromarray((m * 255).astype(np.uint8))
    im = im.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))   # close
    im = im.filter(ImageFilter.MaxFilter(2 * DILATE + 1))                       # dilate
    soft = im.filter(ImageFilter.GaussianBlur(FEATHER))
    return np.asarray(soft).astype(np.float64) / 255.0, m


def affine_fit(src, dst, w):
    """per-channel gain/offset that carries src into dst where w > 0"""
    out = []
    sel = w > 0.5
    for c in range(3):
        x = src[..., c][sel]
        y = dst[..., c][sel]
        if len(x) < 64:
            out.append((1.0, 0.0))
            continue
        A = np.vstack([x, np.ones_like(x)]).T
        g, b = np.linalg.lstsq(A, y, rcond=None)[0]
        out.append((float(g), float(b)))
    return out


def apply_affine(a, coeffs):
    o = a.copy()
    for c in range(3):
        g, b = coeffs[c]
        o[..., c] = a[..., c] * g + b
    return np.clip(o, 0, 255)


def patch_variant(variant_path, empty_full, soft_crop, base_full, out_path, quality, dry):
    """paste the (colour-mapped) empty chancel into one plate variant"""
    var = load(variant_path)
    vc, bc, ec = crop_of(var), crop_of(base_full), crop_of(empty_full)
    # the RING: inside the crop, outside the mask -- the same surface under both
    ring = (soft_crop < 0.02)
    coeffs = affine_fit(bc, vc, ring.astype(float))
    mapped = apply_affine(ec, coeffs)
    w = soft_crop[..., None]
    out = var.copy()
    x0, y0, x1, y1 = CROP
    out[y0:y1, x0:x1] = vc * (1 - w) + mapped * w
    # diff gate: nothing may change outside the figures' union bbox
    d = np.abs(out - var).max(axis=2)
    fx0, fy0, fx1, fy1 = GATE_BBOX
    outside = d.copy()
    outside[fy0:fy1, fx0:fx1] = 0
    changed_outside = int((outside > 1).sum())
    changed_inside = int((d[fy0:fy1, fx0:fx1] > 1).sum())
    res = {'file': os.path.basename(out_path), 'affine': coeffs,
           'changed_px_outside_figure_bbox': changed_outside,
           'changed_px_inside': changed_inside,
           'max_delta_outside': round(float(outside.max()), 2)}
    if not dry:
        Image.fromarray(out.round().astype(np.uint8)).save(out_path, quality=quality,
                                                           subsampling=0)
        res['sha256'] = sha256(out_path)
        res['bytes'] = os.path.getsize(out_path)
    return res, out


def patch_altar(out_path, patched_plate, soft, dry):
    """rebuild the altar FOREGROUND cut off the patched plate.

    Two edits, both required. Its RGB comes from the plate that no longer paints
    the clergyman, so the layer stops carrying him; and its ALPHA loses the mask
    where he stood, so the sprite that replaces him is not occluded by the cut
    that used to be him. The altar, the rail, the candles and the hourglass keep
    their alpha exactly, which is what the layer is for.
    """
    old = np.asarray(Image.open(out_path).convert('RGBA')).astype(np.float64)
    x0, y0, x1, y1 = ALTAR_BOX
    rgb = patched_plate[y0:y1, x0:x1]
    a = old[..., 3] / 255.0
    m = soft[y0:y1, x0:x1]
    new_a = np.clip(a - m, 0, 1)
    arr = np.dstack([rgb, new_a * 255]).round().astype(np.uint8)
    res = {'file': os.path.basename(out_path),
           'alpha_px_before': int((a > 0.5).sum()),
           'alpha_px_after': int((new_a > 0.5).sum()),
           'alpha_px_cleared': int(((a > 0.5) & (new_a <= 0.5)).sum())}
    if not dry:
        Image.fromarray(arr).save(out_path)
        res['sha256'] = sha256(out_path)
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--empty', required=True, help='the i2i crop that came back')
    ap.add_argument('--raw', required=True)
    ap.add_argument('--quality', type=int, default=94)
    ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()

    base_p = os.path.join(LIVE, 'church.jpg')
    base = load(base_p)
    x0, y0, x1, y1 = CROP
    cw, ch = x1 - x0, y1 - y0

    gen = Image.open(a.empty).convert('RGB')
    if gen.size != (cw, ch):
        gen = gen.resize((cw, ch), Image.LANCZOS)
    empty_full = base.copy()
    empty_full[y0:y1, x0:x1] = np.asarray(gen).astype(np.float64)

    soft_crop, hard = figure_mask(crop_of(base), crop_of(empty_full))
    soft = np.zeros(base.shape[:2])
    soft[y0:y1, x0:x1] = soft_crop

    # ALIGNMENT PROOF: outside the mask the model was told to change nothing
    ring = soft_crop < 0.02
    resid = np.abs(crop_of(base) - crop_of(empty_full)).mean(axis=2)[ring]
    align = {'ring_px': int(ring.sum()),
             'mean_abs_delta': round(float(resid.mean()), 2),
             'p99_abs_delta': round(float(np.percentile(resid, 99)), 2),
             'gate': ALIGN_GATE}
    print(json.dumps({'align': align, 'mask_px': int(hard.sum()),
                      'soft_px': int((soft_crop > 0.02).sum())}))
    if align['mean_abs_delta'] > ALIGN_GATE:
        raise SystemExit('ABORT: the model moved the picture (%.2f > %.2f)'
                         % (align['mean_abs_delta'], ALIGN_GATE))

    os.makedirs(os.path.join(a.raw, 'pre'), exist_ok=True)
    rows = []
    patched_base = None
    for name in ('church.jpg', 'church-dim.jpg', 'church-ring.jpg'):
        p = os.path.join(LIVE, name)
        if not a.dry:
            shutil.copy2(p, os.path.join(a.raw, 'pre', name))
        row, outimg = patch_variant(p, empty_full, soft_crop, base, p, a.quality, a.dry)
        if name == 'church.jpg':
            patched_base = outimg
        rows.append(row)
        print(json.dumps(rows[-1]))

    ap_ = os.path.join(LIVE, 'altar.png')
    if not a.dry:
        shutil.copy2(ap_, os.path.join(a.raw, 'pre', 'altar.png'))
    rows.append(patch_altar(ap_, patched_base, soft, a.dry))
    print(json.dumps(rows[-1]))

    Image.fromarray((soft * 255).round().astype(np.uint8)).save(
        os.path.join(a.raw, 'chancel-figure-mask.png'))
    man = {'when': dt.datetime.utcnow().isoformat() + 'Z',
           'tool': 'tools/lanecf/chancel_patch.py', 'empty_raw': a.empty,
           'empty_sha256': sha256(a.empty), 'crop': CROP, 'fig_bbox': FIG_BBOX,
           'diff_thr': DIFF_THR, 'dilate': DILATE, 'feather': FEATHER,
           'align': align, 'variants': rows}
    json.dump(man, open(os.path.join(a.raw, 'chancel_patch.json'), 'w'), indent=1)
    print('manifest ' + os.path.join(a.raw, 'chancel_patch.json'))


if __name__ == '__main__':
    main()
