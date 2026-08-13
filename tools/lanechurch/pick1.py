#!/usr/bin/env python3
"""pick1.py -- STAGE 1 SELECTION, measured rather than eyeballed.

Every stage-1 candidate is scored on the marks the Beat IV script actually
needs, not on taste:

  VOID MARGIN     the diorama must float with clear void at both side edges and
                  above the ridge, because stage 2's band fit keys off that void
                  (slice_plate.py step 1 fits a quadratic-in-r model to it). A
                  candidate whose hull touches an edge cannot be sliced cleanly.
  HULL / COVERAGE how much of the frame the diorama occupies. Too little and the
                  close lenses have no pixels to push into (church-c's failure).
  FIGURE READ     the three who perform the marriage (clergyman/bride/groom) are
                  keyed by their palette: surplice e9dcc2, dress e4d5b8, veil
                  f0e6cf are the only large near-white cream masses in the frame.
                  Their pixel height / frame height is the number CONTENT-full.md
                  §6.2 quotes as the ring-lens contract (27.2 / 20.5 / 16.7 %).
  RING-LENS ZOOM  the push factor needed to bring the knot to the contract read.
                  k = 0.272 * H / knot_h. k > 2.2 means the plate is resampling
                  more than it has and the ring push will be mush.
  WARM/COOL SPLIT "the warm light and the cool light never mix" -- measured as
                  the mean (R-B) in the chancel third vs the nave third. A big
                  positive gap is the law holding.
  ALTAR PROPS     the hourglass and the joined hands must be UNOCCLUDED. Proxy:
                  the warm altar-top band's horizontal run of amber that is not
                  interrupted by a figure-coloured column.

    python3 pick1.py GEN1DIR OUTJSON
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter


def morph(m, op, k, n=1):
    im = Image.fromarray((m * 255).astype(np.uint8))
    f = ImageFilter.MaxFilter(k) if op == 'd' else ImageFilter.MinFilter(k)
    for _ in range(n):
        im = im.filter(f)
    return np.asarray(im) > 127


def _basis(W, H):
    """Full 2D quadratic basis [1, x, y, x^2, xy, y^2] on normalised coords.

    ADAPTATION, documented. slice_plate.py models the 221B void as a quadratic
    in RADIUS about one fitted centre (700,390) -- correct there, because that
    backdrop is a true isotropic vignette. The church candidates are not: the
    model paints a directional navy wash that is lighter off one shoulder, and a
    radial fit about the frame centre leaves a residual above the silhouette
    threshold across most of the frame (measured: it called 76-95% of the frame
    "diorama"). A general 2D quadratic SUBSUMES the radial model -- any
    quadratic in r is a quadratic in (x,y) -- so this is a strictly weaker
    assumption, not a different one.
    """
    yy, xx = np.mgrid[0:H, 0:W]
    x = (xx - W / 2.0) / (W / 2.0)
    y = (yy - H / 2.0) / (H / 2.0)
    return np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], -1)


def fit_void(a):
    """slice_plate.py step 1, generalised. Returns (void, bg_mask, rms, coefs)."""
    H, W, _ = a.shape
    F = _basis(W, H)
    # seed: the outer 5% frame border is void by construction in this template
    bg = np.zeros((H, W), bool)
    b = int(min(H, W) * 0.05)
    bg[:b, :] = bg[-b:, :] = bg[:, :b] = bg[:, -b:] = True
    void = np.zeros_like(a)
    coefs = []
    for _ in range(6):
        Fb = F[bg]
        coefs = []
        for c in range(3):
            coef, *_ = np.linalg.lstsq(Fb, a[bg][:, c], rcond=None)
            coefs.append([float(v) for v in coef])
            void[..., c] = F @ coef
        d = np.sqrt(((a - void) ** 2).sum(axis=2))
        nbg = ~morph(morph(d > 7, 'd', 3), 'e', 5)
        if nbg.sum() < 0.02 * H * W:      # never let the fit starve itself
            break
        bg = nbg
    rms = float(np.sqrt(((a[bg] - void[bg]) ** 2).sum(axis=1).mean()))
    return void, bg, rms, coefs


def biggest_blobs(mask, n=6):
    """label 4-connected blobs by iterative dilation-within-mask; small frames
    so an O(n) python loop is fine. Returns [(area, bbox)] sorted desc."""
    lab = np.zeros(mask.shape, np.int32)
    cur = 0
    out = []
    ys, xs = np.nonzero(mask)
    seen = np.zeros(mask.shape, bool)
    for y, x in zip(ys, xs):
        if seen[y, x]:
            continue
        cur += 1
        comp = np.zeros(mask.shape, bool)
        comp[y, x] = True
        while True:
            nxt = morph(comp, 'd', 3) & mask
            if nxt.sum() == comp.sum():
                break
            comp = nxt
        seen |= comp
        cy_, cx_ = np.nonzero(comp)
        out.append((int(comp.sum()),
                    [int(cx_.min()), int(cy_.min()), int(cx_.max()), int(cy_.max())]))
        if cur > 40:
            break
    out.sort(key=lambda t: -t[0])
    return out[:n]


def score(path):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    a = np.asarray(im).astype(np.float64)
    void, bg, rms, coefs = fit_void(a)

    d = np.sqrt(((a - void) ** 2).sum(axis=2))
    sil = morph(morph(d > 7.5, 'd', 5), 'e', 7)
    # ROBUST HULL. A bare min/max over the silhouette is decided by single
    # stray pixels (JPEG ringing in the gradient reads as "not void"), which
    # pinned every margin to 0 on the first pass. Use the first/last row and
    # column whose silhouette coverage clears 0.5% instead: that is the
    # diorama's real envelope, and it is the envelope stage 2 has to key off.
    colf, rowf = sil.mean(axis=0), sil.mean(axis=1)
    cols, rows = np.nonzero(colf > 0.005)[0], np.nonzero(rowf > 0.005)[0]
    hull = [int(cols.min()), int(rows.min()), int(cols.max()), int(rows.max())]
    margins = {'left': hull[0], 'top': hull[1],
               'right': W - 1 - hull[2], 'bottom': H - 1 - hull[3]}

    # --- the cream figures: bright, low-saturation, WARM -------------------
    # the warm test is what separates a surplice/dress from the lancet glass:
    # the glass is the coolest thing in the picture by design (B > R), the
    # figures stand in candlelight (R > B). Without it the east window scores
    # as the tallest "figure" in the frame.
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1)
    cream = (mx > 140) & (sat < 0.40) & (R - B > 12) & sil
    cream = morph(morph(cream, 'e', 3), 'd', 3)
    blobs = biggest_blobs(cream, 8)
    # a figure is a tall-ish blob: height >= 5% of frame, aspect h/w >= 1.1
    figs = [(ar, bb) for ar, bb in blobs
            if (bb[3] - bb[1]) >= 0.05 * H and (bb[3] - bb[1]) >= 1.1 * (bb[2] - bb[0])]
    figs = figs[:3]
    fig_h = [round((bb[3] - bb[1]) / H * 100, 1) for _, bb in figs]
    knot_h = max([bb[3] - bb[1] for _, bb in figs], default=0)
    ring_k = round(0.272 * H / knot_h, 2) if knot_h else None

    # --- warm / cool separation, chancel third vs nave third ---------------
    inside = sil
    thirds = []
    for i in range(3):
        sel = inside[:, i * W // 3:(i + 1) * W // 3]
        sub = (R - B)[:, i * W // 3:(i + 1) * W // 3]
        thirds.append(round(float(sub[sel].mean()), 1) if sel.any() else None)

    return {
        'file': os.path.basename(path), 'size': [W, H],
        'void_rms': round(rms, 2), 'void_pct': round(float(bg.mean() * 100), 1),
        'hull': hull, 'margins': margins,
        'coverage_pct': round(float(sil.mean() * 100), 1),
        'figure_heights_pct_of_frame': fig_h,
        'figure_boxes': [bb for _, bb in figs],
        'ring_lens_zoom_needed': ring_k,
        'warmth_RminusB_by_third': thirds,
        'warm_split': (round(thirds[2] - thirds[0], 1)
                       if thirds[0] is not None and thirds[2] is not None else None),
    }


def main():
    gen, outp = sys.argv[1], sys.argv[2]
    res = []
    for f in sorted(os.listdir(gen)):
        if f.endswith('.png'):
            r = score(os.path.join(gen, f))
            res.append(r)
            print(json.dumps(r), flush=True)
    json.dump(res, open(outp, 'w'), indent=1)


if __name__ == '__main__':
    main()
