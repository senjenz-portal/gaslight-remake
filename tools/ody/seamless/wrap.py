#!/usr/bin/env python3
"""
wrap.py — R2 of the SYNTHESIS (tools/ody/research/SYNTHESIS.md): LIGHT WRAP +
EDGE DECONTAMINATION, baked into the matte/regrade pass. The audit
(seamless/audit-integration.md, section c) measured actor rims ~1.5-2.3x
steeper than the plate's own edges (avg 1.8x) — the "sticker edge". The $0
fix, per the synthesis's R2:

  1. ERODE the alpha ~0.5-1.5 plate px (kills the matte fringe — the last
     ring of navy-studio pixels the key left on the silhouette), then
     FEATHER ~0.5 plate px (the plate's own edges are 2-9 px wide; a
     binary-crisp matte is the one edge register the painting never has).
  2. LIGHT WRAP: the outer ~1.5 plate px of the body takes the plate's own
     light — gaussian-blurred plate sampled AT THE MARK, screen-blended at
     30-60% strength ("feel it, never see it").
  3. THE SKIRT: band = dilate(alpha, 4-8 plate px) - alpha, filled with the
     same blurred plate and laid UNDER the body at a capped sub-50% alpha —
     over the real plate it is (nearly) plate-over-plate, invisible; across
     the silhouette it is the ramp that takes the rim gradient down into
     the plate's own register. Skirt alpha is CAPPED below 128 so the lap's
     [regrade] dE mean (alpha > 127) still measures the body, not the halo.

Everything is deterministic (PIL filters + numpy, no RNG); parameters are
declared in PLATE px and converted through the mount scale k = h_px / src_h,
so a cut wrapped for a 20 px shore man and one wrapped for the 165 px giant
carry the same edge in DRAWN pixels.

THE GATE (shipped with the change, lap-ody.mjs [wrap]): at the audited
settles the mounted actor's rim peak-gradient ratio vs the plate's own
edges must be <= 1.3x (audit measured 1.8x avg before). rim_ratio() below
is the bake-side instrument; the lap re-measures the same law in-page off
the served bytes.
"""

import math

import numpy as np
from PIL import Image, ImageFilter

WRAP_RIM_MAX = 1.3       # the gate: audit said 1.8x average, law is <= 1.3x


def _params(h_px):
    """Plate-px wrap parameters, scaled gently with the drawn height and
    clamped to the synthesis's own ranges (erode 0.5-1.5, band 4-8,
    screen 30-60%)."""
    return dict(
        erode_px=float(np.clip(0.014 * h_px, 0.5, 1.5)),
        feather_px=0.5,
        wrap_in_px=1.5,
        band_px=float(np.clip(0.08 * h_px, 4.0, 8.0)),
        screen_k=0.45,
        fill_blur_px=3.0,
    )


def _drawn_box(cut_shape, mark, h_px, pin, flip):
    """mount()'s own placement law (regrade.py), replicated exactly."""
    src_h, src_w = cut_shape[0], cut_shape[1]
    k = h_px / src_h
    rw, rh = max(1, round(src_w * k)), max(1, round(src_h * k))
    px = (src_w - pin[0]) * k if flip else pin[0] * k
    left = int(round(mark[0] - px))
    top = int(round(mark[1] - pin[1] * k))
    return left, top, rw, rh, k


def _plate_fill(plate_rgb, cut_shape, mark, h_px, pin, flip, blur_src_px):
    """The plate the cut stands against, back-projected into SOURCE space
    (one plate px -> 1/k source px) and blurred — the wrap's light source
    and the skirt's paint. Out-of-plate rows/cols clamp to the edge."""
    src_h, src_w = cut_shape[0], cut_shape[1]
    left, top, rw, rh, _k = _drawn_box(cut_shape, mark, h_px, pin, flip)
    ph, pw, _ = plate_rgb.shape
    xs = np.clip(np.arange(left, left + rw), 0, pw - 1)
    ys = np.clip(np.arange(top, top + rh), 0, ph - 1)
    crop = plate_rgb[np.ix_(ys, xs)]
    fill = np.asarray(Image.fromarray(crop.astype(np.uint8))
                      .resize((src_w, src_h), Image.BILINEAR), dtype=np.float64)
    if flip:
        fill = fill[:, ::-1]          # back into SOURCE orientation
    if blur_src_px >= 0.5:
        fill = np.asarray(Image.fromarray(fill.astype(np.uint8))
                          .filter(ImageFilter.GaussianBlur(blur_src_px)),
                          dtype=np.float64)
    return fill


def _odd(n):
    n = max(3, int(round(n)))
    return n if n % 2 else n + 1


def wrap_cut(cut_rgba, plate_rgb, mark, h_px, pin, flip=False):
    """Apply erode+feather (decontamination), interior light wrap (screen)
    and the exterior plate skirt to a (graded) cut. Returns (rgba uint8,
    report dict). Same canvas size as the input — pins and boxes untouched
    by construction (the gradedActor swap is src-only)."""
    P = _params(h_px)
    src_h = cut_rgba.shape[0]
    s = src_h / float(h_px)                      # source px per plate px

    rgb = cut_rgba[..., :3].astype(np.float64)
    a0 = cut_rgba[..., 3].astype(np.float64) / 255.0
    a_img = Image.fromarray((a0 * 255).astype(np.uint8))

    # 1. decontaminate: erode then feather (plate-px radii, source-px kernels).
    #    THIN-FEATURE GUARD: a blade or a strap a couple of plate px wide
    #    cannot survive a body-scaled erode — if the solid mass drops under
    #    55% of the original, the erode halves (then zeroes) and the feather
    #    tightens, deterministically, until the object survives.
    n0 = max(1, int((a0 > 0.5).sum()))
    for erode_px, feather_px in ((P["erode_px"], P["feather_px"]),
                                 (P["erode_px"] * 0.5, 0.3), (0.0, 0.25)):
        er = (a_img.filter(ImageFilter.MinFilter(_odd(2 * erode_px * s + 1)))
              if erode_px > 0 else a_img)
        a2 = np.asarray(er.filter(ImageFilter.GaussianBlur(feather_px * s)),
                        dtype=np.float64) / 255.0
        a2 = np.minimum(a2, a0)                  # feather may not grow the matte
        if (a2 > 0.5).sum() >= 0.55 * n0:
            break
    P["erode_px"], P["feather_px"] = round(erode_px, 3), round(feather_px, 3)

    fill = _plate_fill(plate_rgb, cut_rgba.shape, mark, h_px, pin, flip,
                       P["fill_blur_px"] * s)

    # 2. interior light wrap: the outer wrap_in_px of the BODY takes the
    #    plate's own blurred light at screen_k strength ("feel it, never see
    #    it"). MIX, not screen: a pure screen is >= max(actor, plate) and on
    #    a bright plate (the shore sand, the sea sky) it overshoots PAST the
    #    ring and breaks the [regrade] dE law (measured: council 13.8,
    #    jeer 10.1 with screen; the mix moves the rim TOWARD the plate,
    #    which is the wrap's whole point and lowers dE by construction).
    inner = np.asarray(
        a_img.filter(ImageFilter.MinFilter(_odd(2 * P["wrap_in_px"] * s + 1))),
        dtype=np.float64) / 255.0
    w_in = np.clip(a0 - inner, 0.0, 1.0) * P["screen_k"]
    body0 = rgb.copy()
    rgb = rgb + w_in[..., None] * (fill - rgb)

    # MEAN RE-ANCHOR: the wrap is an EDGE treatment, not a regrade. The
    # [regrade] dE law measures the mean colour over the SHIPPED alpha>127
    # mask — feathering shrinks that mask toward the body core, whose mean
    # is not the whole grade's mean, so the anchor restores the FINAL mask's
    # mean to the graded cut's own measured subject (mean over the original
    # solid mask). A uniform offset: structure and rim register untouched.
    m_final = a2 > (127.5 / 255.0)
    m0 = a0 > 0.5
    if m_final.sum() > 16 and m0.sum() > 16:
        rgb = rgb + (body0[m0].mean(axis=0)
                     - rgb[m_final].mean(axis=0))[None, None, :]
    rgb = np.clip(rgb, 0.0, 255.0)

    # 3. the exterior skirt: a soft halo of the blurred plate under the body
    halo = np.asarray(
        Image.fromarray((np.where(a0 > 0.5, 1.0, 0.0) * 255).astype(np.uint8))
        .filter(ImageFilter.GaussianBlur(P["band_px"] * s * 0.5)),
        dtype=np.float64) / 255.0
    skirt_a = np.clip(halo - a2, 0.0, 1.0) * P["screen_k"]
    skirt_a = np.minimum(skirt_a, 115.0 / 255.0)   # below the dE gate's 127
    out_a = a2 + skirt_a * (1.0 - a2)
    num = rgb * a2[..., None] + fill * (skirt_a * (1.0 - a2))[..., None]
    out_rgb = np.where(out_a[..., None] > 1e-4,
                       num / np.maximum(out_a[..., None], 1e-4), rgb)

    out = np.empty_like(cut_rgba)
    out[..., :3] = np.clip(np.round(out_rgb), 0, 255).astype(np.uint8)
    out[..., 3] = np.clip(np.round(out_a * 255.0), 0, 255).astype(np.uint8)
    report = {k: (round(v, 3) if isinstance(v, float) else v)
              for k, v in P.items()}
    report["skirtPxMax"] = int((out[..., 3] > 0).sum() - (cut_rgba[..., 3] > 0).sum())
    return out, report


# ------------------------------------------------------------------ the gate

def _grad_mag(L):
    gy, gx = np.gradient(L)
    return np.sqrt(gx * gx + gy * gy)


def rim_ratio(plate_rgb, cut_rgba, mark, h_px, pin, flip=False):
    """THE RIM-REGISTER INSTRUMENT (the audit's method, automated): mount the
    cut on the plate at true scale, take the p95 luminance gradient ON the
    silhouette boundary, and divide by the plate's own edge register (p99.5
    gradient of the BARE plate in a context window around the mount). The
    lap's [wrap] gate holds this ratio <= WRAP_RIM_MAX at the settles."""
    from regrade import mount                     # the adopted composite law
    comp, box = mount(plate_rgb, cut_rgba, mark, h_px, pin, flip)
    W = np.array([0.2126, 0.7152, 0.0722])
    gL = _grad_mag(comp.astype(np.float64) @ W)
    gP = _grad_mag(plate_rgb.astype(np.float64) @ W)

    # the drawn alpha mask, exactly as mounted
    src_h, src_w = cut_rgba.shape[0], cut_rgba.shape[1]
    k = h_px / src_h
    rw, rh = max(1, round(src_w * k)), max(1, round(src_h * k))
    am = Image.fromarray(cut_rgba[..., 3]).resize((rw, rh), Image.LANCZOS)
    am = np.asarray(am.transpose(Image.FLIP_LEFT_RIGHT) if flip else am)
    left, top = box[0], box[1]
    ph, pw = plate_rgb.shape[:2]
    solid = np.zeros((ph, pw), bool)
    x0, y0 = max(0, left), max(0, top)
    x1, y1 = min(pw, left + rw), min(ph, top + rh)
    if x1 <= x0 or y1 <= y0:
        return None
    solid[y0:y1, x0:x1] = am[y0 - top:y1 - top, x0 - left:x1 - left] >= 128

    # boundary = solid xor 4-neighbour erosion, dilated one px outward
    er = solid.copy()
    er[1:, :] &= solid[:-1, :]; er[:-1, :] &= solid[1:, :]
    er[:, 1:] &= solid[:, :-1]; er[:, :-1] &= solid[:, 1:]
    edge = solid & ~er
    bd = edge.copy()
    bd[1:, :] |= edge[:-1, :]; bd[:-1, :] |= edge[1:, :]
    bd[:, 1:] |= edge[:, :-1]; bd[:, :-1] |= edge[:, 1:]
    if bd.sum() < 24:
        return None
    rim = float(np.percentile(gL[bd], 95.0))

    pad = max(24, int(round(1.2 * h_px)))
    wx0, wy0 = max(0, left - pad), max(0, top - pad)
    wx1, wy1 = min(pw, left + rw + pad), min(ph, top + rh + pad)
    pedge = float(np.percentile(gP[wy0:wy1, wx0:wx1], 99.5))
    return {"rim": round(rim, 2), "plateEdge": round(pedge, 2),
            "ratio": round(rim / max(pedge, 1e-6), 3),
            "boundaryPx": int(bd.sum())}
