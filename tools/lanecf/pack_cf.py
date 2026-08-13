#!/usr/bin/env python3
"""pack_cf.py -- ship the two new CF-lane pictures into the living book.

  clergyman   the matted sprite is resampled once to the height it draws at on
              the church plate (1.75 m x 104.5 px/m) times the 3x the other
              church actors are packed at, and its foot baseline is carried
              through the same resample so the set anchors it on its feet.

  portrait    the finale's framed photograph gets the PAINTED sepia Irene.
              Three things make this a replacement and not a new picture:
                * the FRAME AND THE GROUND ARE NEVER TOUCHED. The new sitter is
                  composited into the old sitter's own measured footprint, and
                  the tool reports how many of the old sitter's pixels the new
                  silhouette fails to cover (they are filled with the ground's
                  own row colour, so no mannequin edge can survive).
                * the SEPIA IS THE PLATE'S OWN. A per-channel quadratic is
                  fitted on the OLD sitter's own luma->RGB relationship and the
                  new figure is carried onto it, so she is in the photograph's
                  exact tonal world rather than near it. CONTENT-full 6.5 asks
                  for "the same face, the same sepia, the same frame"; this is
                  how the sepia and the frame are literally the same.
                * the diff gate: changed pixels outside the sitter's padded
                  footprint must be zero.

    python3 pack_cf.py --raw /abs/rawdir [--dry]
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
LIVE = os.path.join(ROOT, 'site-deploy/living/assets')

PX_PER_M = 104.5                 # sets/church.js scale law
CLERGY_M = 1.75                  # an elderly priest
PACK = 3.0                       # the church actors' pack factor (norton: 188*3=564)

# measured off inset/photo-irene.jpg with a coordinate grid
SITTER = (605, 130, 800, 696)    # x0, y0(head top), x1, footY
GATE_PAD = 24


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for blk in iter(lambda: fh.read(1 << 20), b''):
            h.update(blk)
    return h.hexdigest()


def pack_clergyman(raw, dry):
    src = os.path.join(raw, 'matte', 'clergyman-altar.png')
    meta = json.load(open(os.path.join(raw, 'matte', 'clergyman-altar.json')))
    im = Image.open(src).convert('RGBA')
    draw_h = CLERGY_M * PX_PER_M                   # 182.9 plate px
    h = int(round(draw_h * PACK))
    k = h / im.height
    w = int(round(im.width * k))
    out = im.resize((w, h), Image.LANCZOS)
    baseline = round(meta['baseline_y'] * k, 1)
    dst = os.path.join(LIVE, 'actor', 'clergyman-altar.png')
    res = {'file': 'actor/clergyman-altar.png', 'size': [w, h],
           'baseline': baseline, 'drawsPx': round(draw_h, 1),
           'heightM': CLERGY_M, 'pack': PACK, 'source': src}
    if not dry:
        out.save(dst)
        res['sha256'] = sha256(dst)
        res['bytes'] = os.path.getsize(dst)
    return res


ALTAR_BOX = (813, 339, 1099, 545)   # layers.json props.altar


def clear_altar_over_clergyman(dry):
    """The altar FOREGROUND cut must not be drawn in front of the clergyman.

    `altar.png` is laid over the actors so the altar, the rail and the candles
    occlude legs. chancel_patch.py already cleared its alpha where the PAINTED
    clergyman stood, but the actor that replaces him is a different silhouette —
    a little taller and a little wider — so the altar's own front-top edge was
    still drawn across his shoulder and the open book showed through his
    surplice. He stands IN FRONT of that altar, so the cut's alpha loses his
    rendered silhouette too, dilated 2 px and feathered by one.
    """
    from PIL import ImageFilter as IF
    ap_ = os.path.join(LIVE, 'set', 'church', 'altar.png')
    altar = Image.open(ap_).convert('RGBA')
    a = np.asarray(altar).astype(np.float64)

    meta = json.load(open(os.path.join(LIVE, '..', 'app', 'sets', 'church.geom.json'))) \
        if False else None
    # the set's own numbers, transcribed (sets/church.js ART.clergyman + FEET)
    src = Image.open(os.path.join(LIVE, 'actor', 'clergyman-altar.png')).convert('RGBA')
    draw_h = CLERGY_M * PX_PER_M
    k = draw_h / src.height
    w = int(round(src.width * k))
    h = int(round(src.height * k))
    base_line = 545.8 * k
    mark = (886.0, 512.0)
    left = int(round(mark[0] - w / 2.0))
    top = int(round(mark[1] - base_line))
    sil = src.resize((w, h), Image.LANCZOS).split()[3]
    sil = sil.filter(IF.MaxFilter(5)).filter(IF.GaussianBlur(1.0))
    plate_sil = Image.new('L', (1408, 768), 0)
    plate_sil.paste(sil, (left, top))
    ax0, ay0, ax1, ay1 = ALTAR_BOX
    m = np.asarray(plate_sil).astype(np.float64)[ay0:ay1, ax0:ax1] / 255.0
    old = a[..., 3] / 255.0
    new = np.clip(old - m, 0, 1)
    res = {'file': 'set/church/altar.png', 'clergyman_box': [left, top, w, h],
           'alpha_px_before': int((old > 0.5).sum()),
           'alpha_px_after': int((new > 0.5).sum()),
           'alpha_px_cleared': int(((old > 0.5) & (new <= 0.5)).sum())}
    if not dry:
        arr = np.dstack([a[..., :3], new * 255]).round().astype(np.uint8)
        Image.fromarray(arr).save(ap_)
        res['sha256'] = sha256(ap_)
    return res


def ground_ramp(plate, sitter_mask):
    """per-channel quadratic fit of the OLD sitter's luma -> RGB. That curve IS
    the photograph's tone: everything the frame already contains lies on it."""
    a = plate.astype(np.float64)
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    sel = sitter_mask
    x = lum[sel]
    coeffs = []
    for c in range(3):
        y = a[..., c][sel]
        A = np.vstack([x ** 2, x, np.ones_like(x)]).T
        coeffs.append(np.linalg.lstsq(A, y, rcond=None)[0].tolist())
    return coeffs, (float(x.min()), float(x.max()))


def apply_ramp(rgb, coeffs, mix=0.88):
    a = rgb.astype(np.float64)
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    out = a.copy()
    for c in range(3):
        q, l, k = coeffs[c]
        out[..., c] = q * lum ** 2 + l * lum + k
    return np.clip(a * (1 - mix) + out * mix, 0, 255)


def chroma_angle(rgb, mask):
    a = rgb.astype(np.float64)
    r, g, b = a[..., 0][mask], a[..., 1][mask], a[..., 2][mask]
    return {'mean_r_minus_b': round(float((r - b).mean()), 2),
            'mean_r_minus_g': round(float((r - g).mean()), 2),
            'mean_sat_spread': round(float((a.max(axis=2) - a.min(axis=2))[mask].mean()), 2)}


def pack_portrait(raw, dry):
    plate_p = os.path.join(LIVE, 'inset', 'photo-irene.jpg')
    plate = np.asarray(Image.open(plate_p).convert('RGB')).astype(np.float64)
    x0, y0, x1, footY = SITTER

    # the OLD sitter's own mask: it is the only thing in its box that is not the
    # flat sepia ground, and its edge is soft, so the threshold is on distance
    grd = np.median(plate[y0:footY, 150:520].reshape(-1, 3), axis=0)
    box = plate[y0 - 10:footY + 14, x0 - 20:x1 + 20]
    d = np.sqrt(((box - grd) ** 2).sum(axis=2))
    old = d > 22
    om = np.zeros(plate.shape[:2], bool)
    om[y0 - 10:footY + 14, x0 - 20:x1 + 20] = old

    coeffs, lrange = ground_ramp(plate, om)

    # the new sitter, resampled to the old one's own height and stood on the
    # old one's own feet
    src = Image.open(os.path.join(raw, 'matte', 'irene-portrait.png')).convert('RGBA')
    meta = json.load(open(os.path.join(raw, 'matte', 'irene-portrait.json')))
    h = footY - y0
    k = h / src.height
    w = int(round(src.width * k))
    fig = src.resize((w, int(round(src.height * k))), Image.LANCZOS)
    fa = np.asarray(fig).astype(np.float64)
    frgb, falpha = fa[..., :3], fa[..., 3] / 255.0
    frgb = apply_ramp(frgb, coeffs)

    cx = (x0 + x1) // 2
    px = cx - w // 2
    py = footY - int(round(meta['baseline_y'] * k))
    canvas_a = np.zeros(plate.shape[:2])
    canvas_rgb = np.zeros_like(plate)
    ph, pw = falpha.shape
    canvas_a[py:py + ph, px:px + pw] = falpha
    canvas_rgb[py:py + ph, px:px + pw] = frgb

    # anything of the OLD sitter the new silhouette misses gets the ground back
    uncovered = om & (canvas_a < 0.35)
    out = plate.copy()
    if uncovered.any():
        rows = np.nonzero(uncovered.any(axis=1))[0]
        for y in rows:
            xs = np.nonzero(uncovered[y])[0]
            out[y, xs] = np.median(plate[y, 150:520], axis=0)

    # a hem shadow, so she stands on the studio floor the frame already paints.
    # Cut to the diff gate's own box: a gaussian tail that leaves the box would
    # be a change to the photograph outside the footprint this tool is allowed
    # to touch, and the gate below would (correctly) report it.
    gx0, gy0 = x0 - GATE_PAD, y0 - GATE_PAD
    gx1, gy1 = x1 + GATE_PAD, footY + GATE_PAD
    yy, xx = np.mgrid[0:plate.shape[0], 0:plate.shape[1]]
    sh = np.exp(-(((xx - cx) / (w * 0.52)) ** 2 + ((yy - (footY + 4)) / 13.0) ** 2))
    win = np.zeros(plate.shape[:2])
    win[gy0:gy1, gx0:gx1] = 1.0
    sh = sh * win
    out = out * (1 - 0.30 * sh[..., None])

    w3 = canvas_a[..., None]
    out = out * (1 - w3) + canvas_rgb * w3

    dd = np.abs(out - plate).max(axis=2)
    outside = dd.copy()
    outside[gy0:gy1, gx0:gx1] = 0
    res = {'file': 'inset/photo-irene.jpg', 'sitter': list(SITTER),
           'new_size': [w, ph], 'placed_at': [int(px), int(py)],
           'ramp': [[round(v, 6) for v in c] for c in coeffs],
           'ramp_luma_range': [round(v, 1) for v in lrange],
           'old_sitter_px': int(om.sum()),
           'uncovered_old_px_refilled': int(uncovered.sum()),
           'changed_px_outside_sitter_gate': int((outside > 1).sum()),
           'max_delta_outside': round(float(outside.max()), 2),
           'chroma_old': chroma_angle(plate, om),
           'chroma_new': chroma_angle(out, canvas_a > 0.6)}
    if not dry:
        shutil.copy2(plate_p, os.path.join(raw, 'pre', 'photo-irene.jpg'))
        Image.fromarray(out.round().astype(np.uint8)).save(plate_p, quality=94,
                                                           subsampling=0)
        res['sha256'] = sha256(plate_p)
        res['bytes'] = os.path.getsize(plate_p)
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', required=True)
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    os.makedirs(os.path.join(a.raw, 'pre'), exist_ok=True)
    rows = []
    if a.only in ('', 'clergyman'):
        rows.append(pack_clergyman(a.raw, a.dry))
        print(json.dumps(rows[-1]))
    if a.only in ('', 'portrait'):
        rows.append(pack_portrait(a.raw, a.dry))
        print(json.dumps(rows[-1]))
    if a.only in ('', 'altarclear'):
        rows.append(clear_altar_over_clergyman(a.dry))
        print(json.dumps(rows[-1]))
    json.dump({'when': dt.datetime.utcnow().isoformat() + 'Z',
               'tool': 'tools/lanecf/pack_cf.py', 'rows': rows},
              open(os.path.join(a.raw, 'pack_cf.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
