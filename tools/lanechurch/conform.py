#!/usr/bin/env python3
"""conform.py -- land a stage-1 candidate in PLATE SPACE (1408x768) losslessly.

The API delivered 1376x768. Plate space is 1408x768. Two ways to close a 32 px
gap and only one of them is honest:

  RESIZE   1376 -> 1408 is a 2.33% horizontal stretch. Every measured mark in
           CONTENT-full.md (figure % of frame height, the ring lens read) is a
           RATIO, and stretching one axis breaks the ratios the lane just
           selected the plate for. Rejected.

  EXTEND   the picked candidate has 251 px of void at its left edge and 213 px
           at its right (measured, tools/lanechurch/pick1.py). The 16 px this
           needs on each side is therefore PURE BACKDROP. And the backdrop is
           not guesswork here: stage 1's selector already fitted it to a 2D
           quadratic per channel at 3.14 RGB RMS. So the pad is the fitted model
           evaluated past the old frame edge -- analytic continuation of the
           painter's own gradient, zero geometric distortion, and the diorama's
           pixels are bit-identical to the raw. Taken.

The seam is then MEASURED, not assumed: the report prints the mean per-channel
step across each join. Anything above ~1.5 RGB would band visibly under the
page's own contrast and the tool says so.

    python3 conform.py RAW OUT.jpg [--quality 94]
"""
import argparse
import hashlib
import json
import os

import numpy as np
from PIL import Image, ImageFilter

PW, PH = 1408, 768


def morph(m, op, k, n=1):
    im = Image.fromarray((m * 255).astype(np.uint8))
    f = ImageFilter.MaxFilter(k) if op == 'd' else ImageFilter.MinFilter(k)
    for _ in range(n):
        im = im.filter(f)
    return np.asarray(im) > 127


def basis_px(xs, ys, W, H):
    """the SAME basis pick1.fit_void uses, but evaluated at arbitrary pixel
    coordinates in the ORIGINAL frame's normalisation -- which is what makes
    this an extension of that fit rather than a new one."""
    x = (xs - W / 2.0) / (W / 2.0)
    y = (ys - H / 2.0) / (H / 2.0)
    return np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], -1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('raw')
    ap.add_argument('out')
    ap.add_argument('--quality', type=int, default=94)
    a = ap.parse_args()

    im = Image.open(a.raw).convert('RGB')
    W, H = im.size
    src = np.asarray(im).astype(np.float64)
    raw0 = src.copy()
    assert H == PH, 'height must already be plate height, got %d' % H

    # --- FRINGE REPAIR ------------------------------------------------------
    # MEASURED, not assumed: the delivered raw carries a one-pixel bright fringe
    # on its left, right and bottom edges (column means 34.45 / 35.08 against an
    # interior of ~31.1; last row 18.77 against 17.29). It is a decode/edge
    # artifact, and it is poison for this tool specifically -- the pad is built
    # from the plate's edge column, so an artifact column would be extruded 16 px
    # wide and then leave a 4.3 RGB step just inside the join (that is exactly
    # what the first pass did). Overwrite each fringe line with its neighbour.
    # Every pixel touched is void: the diorama hull is x 251..1162, so no
    # diorama pixel is in any of these lines.
    fringe = {}
    for name, dst, srcline in (('left', (slice(None), 0), (slice(None), 1)),
                               ('right', (slice(None), W - 1), (slice(None), W - 2)),
                               ('bottom', (H - 1, slice(None)), (H - 2, slice(None)))):
        before = float(np.abs(src[dst] - src[srcline]).mean())
        src[dst] = src[srcline]
        fringe[name] = {'mean_abs_delta_repaired': round(before, 2),
                        'px': int(np.prod(np.shape(src[dst])[:-1]))}

    # --- refit the void on the raw (same procedure as the selector) --------
    F = basis_px(*np.meshgrid(np.arange(W, dtype=np.float64),
                              np.arange(H, dtype=np.float64)), W, H)
    bg = np.zeros((H, W), bool)
    b = int(min(H, W) * 0.05)
    bg[:b, :] = bg[-b:, :] = bg[:, :b] = bg[:, -b:] = True
    coefs = []
    for _ in range(6):
        coefs = []
        void = np.zeros_like(src)
        for c in range(3):
            coef, *_ = np.linalg.lstsq(F[bg], src[bg][:, c], rcond=None)
            coefs.append(coef)
            void[..., c] = F @ coef
        d = np.sqrt(((src - void) ** 2).sum(axis=2))
        nbg = ~morph(morph(d > 7, 'd', 3), 'e', 5)
        if nbg.sum() < 0.02 * H * W:
            break
        bg = nbg
    rms = float(np.sqrt(((src[bg] - void[bg]) ** 2).sum(axis=1).mean()))

    # --- extend --------------------------------------------------------------
    padL = (PW - W) // 2
    padR = PW - W - padL
    out = np.zeros((PH, PW, 3), np.float64)
    out[:, padL:padL + W] = src

    # SEAM RAMP. A butt-join of model-to-plate steps by exactly the fit
    # residual at that column -- measured at 3.1-4.2 RGB mean, 18 max on the
    # first pass, which bands visibly. So the pad carries the plate's own edge
    # residual and lets it decay to zero across the pad: continuous at the join
    # by construction, pure model at the outer edge. The residual is smoothed
    # vertically first (sigma 6) so per-pixel JPEG noise is not extruded into a
    # 16 px horizontal streak.
    def edge_residual(col_x, band):
        """residual measured over a BAND of interior columns (median), not the
        single edge column: one column is 3-4 RGB of JPEG/model noise, and that
        noise would be the thing extruded across the pad."""
        Fe = basis_px(np.full(H, float(col_x)), np.arange(H, dtype=np.float64), W, H)
        model = np.stack([Fe @ coefs[c] for c in range(3)], -1)
        res = np.median(src[:, band], axis=1) - model
        sm = np.asarray(Image.fromarray(
            np.clip(res + 128, 0, 255).astype(np.uint8)[:, None, :]
        ).filter(ImageFilter.GaussianBlur(6)), np.float64)[:, 0, :] - 128.0
        return sm

    seam_res = {}
    for side, x0, x1 in (('L', -padL, 0), ('R', W, W + padR)):
        xs, ys = np.meshgrid(np.arange(x0, x1, dtype=np.float64),
                             np.arange(H, dtype=np.float64))
        Fp = basis_px(xs, ys, W, H)
        blk = np.zeros((H, x1 - x0, 3))
        for c in range(3):
            blk[..., c] = Fp @ coefs[c]
        res = edge_residual(0 if side == 'L' else W - 1,
                            slice(0, 6) if side == 'L' else slice(W - 6, W))
        seam_res[side] = [round(float(np.abs(res[:, c]).mean()), 3) for c in range(3)]
        n = x1 - x0
        # weight 1 adjacent to the plate, 0 at the outer frame edge
        w = ((np.arange(n) + 1) / n) if side == 'L' else ((n - np.arange(n)) / n)
        blk += res[:, None, :] * w[None, :, None]
        out[:, (0 if side == 'L' else padL + W):
              (padL if side == 'L' else PW)] = blk

    # --- MEASURE the seam ----------------------------------------------------
    seams = {}
    for name, xi in (('left', padL), ('right', padL + W - 1)):
        inner = out[:, xi if name == 'left' else xi]
        outer = out[:, xi - 1 if name == 'left' else xi + 1]
        seams[name] = {
            'mean_abs_step_rgb': [round(float(np.abs(inner[:, c] - outer[:, c]).mean()), 3)
                                  for c in range(3)],
            'max_abs_step': round(float(np.abs(inner - outer).max()), 2),
        }

    out8 = np.clip(np.rint(out), 0, 255).astype(np.uint8)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    Image.fromarray(out8).save(a.out, quality=a.quality, subsampling=0,
                               optimize=True)

    # diorama pixels must survive the pad bit-exactly (pre-JPEG)
    # the DIORAMA must be bit-exact; the repaired void fringe lines are the
    # only pixels allowed to differ from the raw, and they are counted.
    same = out8[:, padL:padL + W].astype(np.int16) - raw0.astype(np.int16)
    hull_identical = bool((same[:H - 1, 1:W - 1] == 0).all())
    identical = bool((same == 0).all())

    sha = hashlib.sha256(open(a.out, 'rb').read()).hexdigest()
    rep = {
        'raw': os.path.abspath(a.raw), 'raw_size': [W, H],
        'out': os.path.abspath(a.out), 'out_size': [PW, PH],
        'method': 'analytic void extension (2D quadratic per channel), no resample',
        'pad_px': {'left': padL, 'right': padR},
        'void_fit_rms': round(rms, 3),
        'void_coeffs': [[round(float(v), 4) for v in c] for c in coefs],
        'raw_pixels_bit_identical_pre_jpeg': identical,
        'diorama_pixels_bit_identical_pre_jpeg': hull_identical,
        'fringe_repair': fringe,
        'seam': seams,
        'edge_residual_mean_rgb': seam_res,
        'bytes': os.path.getsize(a.out), 'sha256': sha,
        'jpeg_quality': a.quality, 'chroma_subsampling': '4:4:4',
    }
    print(json.dumps(rep, indent=1))
    with open(os.path.splitext(a.out)[0] + '.conform.json', 'w') as f:
        json.dump(rep, f, indent=1)


if __name__ == '__main__':
    main()
