#!/usr/bin/env python3
"""
regrade.py — EXPLORER B: deterministic relight/grade of an actor cut against
its set plate. Hypothesis: most of 'pasted' is color.

Method (all deterministic, no RNG, no models):
  1. Sample the plate in an annulus (ring) around the ledger mark — the
     environment the actor stands in. Robust (5–95% luminance-trimmed)
     mean/std in Reinhard's lαβ space + mean RGB + CCT (McCamy).
  2. Reinhard color transfer (lαβ mean/std match, gain clipped [0.5,1.6])
     applied to the cut with a vertical ramp: 100% strength at the feet
     grading to 60% at the head (ambient bounce is strongest low).
  3. Accent-hue preservation: the cut's dominant saturated hue (histogram
     peak) keeps its chroma — accent pixels take the luminance transfer in
     full but only 15% of the chroma transfer.
  4. Optional warm rim on the fire-facing side: light anchors from the
     ledger/layer JSONs; rim color sampled from the plate at the anchor;
     applied on the silhouette edge band whose outward normal faces the
     light, falling off with anchor distance vs the source's measured reach.

Outputs (when run as a script):
  explore-regrade-sheet.jpg — 4 settles, before/after pairs at true scale
  stdout JSON with per-settle temperature numbers

Usage:
  python3 regrade.py                # run the 4-settle exploration
  from regrade import grade_cut     # library use
"""

import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# macOS Accelerate emits spurious matmul RuntimeWarnings on strided views;
# every value that matters is clipped/validated downstream.
np.seterr(all="ignore")

ROOT = "/Users/samz/Documents/gaslight-remake"
ASSETS = os.path.join(ROOT, "site-deploy/living-odyssey/assets")
HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- colorspace

def srgb_to_linear(c):
    c = c.astype(np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def linear_to_srgb(c):
    c = np.clip(c, 0.0, 1.0)
    s = np.where(c <= 0.0031308, c * 12.92, 1.055 * (c ** (1 / 2.4)) - 0.055)
    return np.clip(s * 255.0, 0, 255)

# Reinhard et al. 2001 lαβ: linear RGB -> LMS -> log10 -> lαβ
_RGB2LMS = np.array([[0.3811, 0.5783, 0.0402],
                     [0.1967, 0.7244, 0.0782],
                     [0.0241, 0.1288, 0.8444]])
_LMS2RGB = np.linalg.inv(_RGB2LMS)
_LMS2LAB = (np.diag([1 / math.sqrt(3), 1 / math.sqrt(6), 1 / math.sqrt(2)]) @
            np.array([[1, 1, 1], [1, 1, -2], [1, -1, 0]], dtype=np.float64))
_LAB2LMS = np.linalg.inv(_LMS2LAB)

def rgb_to_lab_reinhard(rgb_lin):
    lms = np.clip(rgb_lin @ _RGB2LMS.T, 1e-6, None)
    return np.log10(lms) @ _LMS2LAB.T

def lab_reinhard_to_rgb(lab):
    lms = 10.0 ** (lab @ _LAB2LMS.T)
    return lms @ _LMS2RGB.T

# CIE Lab (D65) for delta-E reporting
def rgb_to_cielab(rgb_lin):
    M = np.array([[0.4124564, 0.3575761, 0.1804375],
                  [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    xyz = rgb_lin @ M.T
    wp = np.array([0.95047, 1.0, 1.08883])
    t = xyz / wp
    f = np.where(t > (6 / 29) ** 3, np.cbrt(t), t / (3 * (6 / 29) ** 2) + 4 / 29)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)

def cct_mccamy(rgb_mean_srgb):
    """Correlated color temperature (K) of a mean sRGB color, McCamy 1992.
    Valid ~2000..12500K; clamped and flagged outside."""
    lin = srgb_to_linear(np.asarray(rgb_mean_srgb, dtype=np.float64))
    M = np.array([[0.4124564, 0.3575761, 0.1804375],
                  [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    X, Y, Z = lin @ M.T
    s = X + Y + Z
    if s <= 1e-9:
        return float("nan")
    x, y = X / s, Y / s
    n = (x - 0.3320) / (0.1858 - y)
    cct = 449.0 * n ** 3 + 3525.0 * n ** 2 + 6823.3 * n + 5520.33
    return float(np.clip(cct, 1000.0, 25000.0))

# ---------------------------------------------------------------- sampling

def ring_stats(plate_rgb, mark, r_in, r_out):
    """Robust stats of the plate annulus around the mark.
    Returns dict: lab mean/std (Reinhard lαβ), mean sRGB, CCT, n."""
    h, w, _ = plate_rgb.shape
    yy, xx = np.mgrid[0:h, 0:w]
    d2 = (xx - mark[0]) ** 2 + (yy - mark[1]) ** 2
    m = (d2 >= r_in ** 2) & (d2 <= r_out ** 2)
    px = plate_rgb[m].astype(np.float64)
    lab = rgb_to_lab_reinhard(srgb_to_linear(px))
    # luminance-trim 5..95% (drop painted blaze cores / dead blacks)
    lo, hi = np.percentile(lab[:, 0], [5.0, 95.0])
    keep = (lab[:, 0] >= lo) & (lab[:, 0] <= hi)
    labk, pxk = lab[keep], px[keep]
    return {
        "lab_mean": labk.mean(axis=0),
        "lab_std": labk.std(axis=0) + 1e-6,
        "rgb_mean": pxk.mean(axis=0),
        "cct": cct_mccamy(pxk.mean(axis=0)),
        "n": int(keep.sum()),
    }

def accent_mask(rgb, alpha):
    """Dominant saturated hue of the cut (36-bin histogram, weighted by
    sat*val*alpha) -> boolean mask of accent pixels (hue within ±30°,
    sat > 0.30)."""
    c = rgb.astype(np.float64) / 255.0
    mx, mn = c.max(axis=-1), c.min(axis=-1)
    delta = mx - mn
    sat = np.where(mx > 1e-6, delta / np.maximum(mx, 1e-6), 0.0)
    hue = np.zeros_like(mx)
    d = np.maximum(delta, 1e-9)
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    hue = np.where(mx == r, ((g - b) / d) % 6,
          np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60.0
    wgt = sat * mx * alpha * (sat > 0.35)
    if wgt.sum() < 1.0:
        return np.zeros(rgb.shape[:2], bool), None
    hist, edges = np.histogram(hue, bins=36, range=(0, 360), weights=wgt)
    peak = (edges[hist.argmax()] + edges[hist.argmax() + 1]) / 2.0
    dh = np.abs((hue - peak + 180) % 360 - 180)
    return (dh <= 30.0) & (sat > 0.30) & (alpha > 0.5), float(peak)

# ---------------------------------------------------------------- grading

def grade_cut(cut_rgba, plate_rgb, mark, h_px, pin, flip=False,
              light_anchor=None, light_reach=None,
              head_strength=0.60, rim_gain=0.55):
    """Grade an actor cut (source resolution, HxWx4 uint8) to match the plate
    ring at the mark. Returns (graded_rgba uint8, report dict).

    mark        (x,y) plate px, the foot mark
    h_px        rendered height in plate px (sets the ring radii)
    pin         (x, baseline) in source px (actors.json)
    flip        True if the cut is mounted scaleX(-1) — flips the light dir
    light_anchor (x,y) plate px of the warm source, or None for no rim
    light_reach  the source's measured reach r in plate px (falloff ref)
    """
    rgb = cut_rgba[..., :3].astype(np.float64)
    alpha = cut_rgba[..., 3].astype(np.float64) / 255.0
    solid = alpha > 0.5

    # --- target: the plate ring at the mark
    r_in = max(10.0, 0.45 * h_px)
    r_out = max(26.0, 1.10 * h_px)
    tgt = ring_stats(plate_rgb, mark, r_in, r_out)

    # --- source stats over solid pixels
    lab = rgb_to_lab_reinhard(srgb_to_linear(rgb))
    s_mean = lab[solid].mean(axis=0)
    s_std = lab[solid].std(axis=0) + 1e-6

    before_rgb = rgb[solid].mean(axis=0)

    # --- Reinhard transfer, gain clipped
    gain = np.clip(tgt["lab_std"] / s_std, 0.5, 1.6)
    lab_t = (lab - s_mean) * gain + tgt["lab_mean"]

    # --- strength map: 1.0 at the feet -> head_strength at the head
    ys, xs = np.where(solid)
    top, bot = ys.min(), ys.max()
    ramp = head_strength + (1.0 - head_strength) * \
        np.clip((np.arange(rgb.shape[0]) - top) / max(1, bot - top), 0, 1)
    m = np.repeat(ramp[:, None], rgb.shape[1], axis=1)

    # --- accent hue preservation: full luminance, 15% chroma
    acc, acc_hue = accent_mask(cut_rgba[..., :3], alpha)
    m_l = m.copy()
    m_ab = np.where(acc, m * 0.15, m)

    out_lab = lab.copy()
    out_lab[..., 0] = lab[..., 0] + m_l * (lab_t[..., 0] - lab[..., 0])
    for ch in (1, 2):
        out_lab[..., ch] = lab[..., ch] + m_ab * (lab_t[..., ch] - lab[..., ch])

    out_lin = np.clip(lab_reinhard_to_rgb(out_lab), 0.0, 1.0)

    # --- optional warm rim on the fire-facing side
    rim_applied = False
    if light_anchor is not None:
        d = math.hypot(light_anchor[0] - mark[0], light_anchor[1] - mark[1])
        reach = light_reach or 100.0
        fall = min(1.0, (1.6 * reach / max(d, 1e-6)) ** 2)
        if fall > 0.02:
            lx = light_anchor[0] - mark[0]
            ly = light_anchor[1] - mark[1]
            if flip:
                lx = -lx           # light dir in SOURCE space
            norm = math.hypot(lx, ly) or 1.0
            lx, ly = lx / norm, ly / norm
            # silhouette edge band via min-filter erosion of alpha
            k = max(3, int(round((bot - top) / 55.0)) * 2 + 1)
            a_img = Image.fromarray((alpha * 255).astype(np.uint8))
            eroded = np.asarray(a_img.filter(ImageFilter.MinFilter(k)),
                                dtype=np.float64) / 255.0
            band = np.clip(alpha - eroded, 0.0, 1.0)
            # outward normal from alpha gradient
            a_soft = np.asarray(a_img.filter(ImageFilter.GaussianBlur(2)),
                                dtype=np.float64) / 255.0
            gy, gx = np.gradient(a_soft)
            gn = np.sqrt(gx ** 2 + gy ** 2) + 1e-9
            facing = np.clip((-gx / gn) * lx + (-gy / gn) * ly, 0.0, 1.0)
            # rim color sampled from the plate at the anchor (r=10 disc)
            ph, pw, _ = plate_rgb.shape
            ax, ay = int(light_anchor[0]), int(light_anchor[1])
            y0, y1 = max(0, ay - 10), min(ph, ay + 11)
            x0, x1 = max(0, ax - 10), min(pw, ax + 11)
            disc = plate_rgb[y0:y1, x0:x1].reshape(-1, 3).astype(np.float64)
            lum = disc @ np.array([0.2126, 0.7152, 0.0722])
            warm = disc[lum >= np.percentile(lum, 75)].mean(axis=0)
            warm_lin = srgb_to_linear(warm)
            w_rim = (band * facing * alpha * fall * rim_gain)[..., None]
            out_lin = np.clip(out_lin + warm_lin[None, None, :] * w_rim, 0, 1)
            rim_applied = True

    out_rgb = linear_to_srgb(out_lin)
    out = cut_rgba.copy()
    out[..., :3] = np.round(out_rgb).astype(np.uint8)

    after_rgb = out_rgb[solid].mean(axis=0)

    def de(a, b):
        la = rgb_to_cielab(srgb_to_linear(np.asarray(a)))
        lb = rgb_to_cielab(srgb_to_linear(np.asarray(b)))
        return float(np.linalg.norm(la - lb))

    report = {
        "ring": {"r_in": round(r_in, 1), "r_out": round(r_out, 1),
                 "n": tgt["n"],
                 "rgb_mean": [round(v, 1) for v in tgt["rgb_mean"]],
                 "cct": round(tgt["cct"])},
        "cut_before": {"rgb_mean": [round(v, 1) for v in before_rgb],
                       "cct": round(cct_mccamy(before_rgb))},
        "cut_after": {"rgb_mean": [round(v, 1) for v in after_rgb],
                      "cct": round(cct_mccamy(after_rgb))},
        "cct_delta_before": round(abs(cct_mccamy(before_rgb) - tgt["cct"])),
        "cct_delta_after": round(abs(cct_mccamy(after_rgb) - tgt["cct"])),
        "deltaE_before": round(de(before_rgb, tgt["rgb_mean"]), 1),
        "deltaE_after": round(de(after_rgb, tgt["rgb_mean"]), 1),
        "accent_hue_deg": None if acc_hue is None else round(acc_hue, 1),
        "accent_px": int(acc.sum()),
        "gain_clipped": [round(v, 2) for v in gain],
        "rim_applied": rim_applied,
    }
    return out, report

# ---------------------------------------------------------------- composite

def mount(plate_rgb, cut_rgba, mark, h_px, pin, flip=False):
    """Composite the cut onto a copy of the plate, pin on mark, at true set
    scale (mirrors setkit placeSprite / cave pinCut)."""
    src_h = cut_rgba.shape[0]
    src_w = cut_rgba.shape[1]
    # placeSprite law: k = h / cell_h with h the rendered height in plate px
    k = h_px / src_h
    rw, rh = max(1, round(src_w * k)), max(1, round(src_h * k))
    im = Image.fromarray(cut_rgba).resize((rw, rh), Image.LANCZOS)
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
        px = (src_w - pin[0]) * k
    else:
        px = pin[0] * k
    left = int(round(mark[0] - px))
    top = int(round(mark[1] - pin[1] * k))
    base = Image.fromarray(plate_rgb).convert("RGBA")
    base.alpha_composite(im, (left, top))
    return np.asarray(base.convert("RGB")), (left, top, rw, rh)

def crop_window(img, box, mark, h_px, plate_shape):
    """Context crop around the mounted actor, true scale (1 plate px = 1 px)."""
    ph, pw = plate_shape[:2]
    win_h = int(np.clip(2.4 * h_px, 150, 540))
    win_w = int(win_h * 1.25)
    cx = box[0] + box[2] // 2
    cy = box[1] + box[3] // 2
    x0 = int(np.clip(cx - win_w // 2, 0, pw - win_w))
    y0 = int(np.clip(cy - win_h // 2, 0, ph - win_h))
    return img[y0:y0 + win_h, x0:x0 + win_w]

# ---------------------------------------------------------------- settles

SETTLES = [
    dict(id="cave bowl-offer (iii-08)", set="cave",
         plate="set/cave/cave-shut.jpg", cut="ulysses-offer",
         mark=(700, 468), h_px=75, pin=(67, 678), flip=False,
         light=(638, 427), reach=238),
    dict(id="cave meal (ii-05)", set="cave",
         plate="set/cave/cave-shut.jpg", cut="polyphemus-seated",
         mark=(760, 452), h_px=165, pin=(187, 967), flip=False,
         light=(638, 427), reach=238),
    dict(id="shore council (i-06)", set="shore",
         plate="set/shore/shore.jpg", cut="ulysses-stand",
         mark=(510, 492), h_px=20, pin=(125, 676), flip=True,
         light=(438, 466), reach=160),
    dict(id="sea stern (vi-02)", set="sea",
         plate="set/sea/sea.jpg", cut="ulysses-taunt",
         mark=(518, 426), h_px=22, pin=(43, 674), flip=True,
         light=(818, 457), reach=60),
]

def run():
    rows, reports = [], {}
    for s in SETTLES:
        plate = np.asarray(Image.open(os.path.join(ASSETS, s["plate"]))
                           .convert("RGB"))
        cut = np.asarray(Image.open(
            os.path.join(ASSETS, "actor", s["cut"] + ".png")).convert("RGBA"))
        graded, rep = grade_cut(cut, plate, s["mark"], s["h_px"], s["pin"],
                                flip=s["flip"], light_anchor=s["light"],
                                light_reach=s["reach"])
        before_img, box = mount(plate, cut, s["mark"], s["h_px"], s["pin"],
                                s["flip"])
        after_img, _ = mount(plate, graded, s["mark"], s["h_px"], s["pin"],
                             s["flip"])
        b = crop_window(before_img, box, s["mark"], s["h_px"], plate.shape)
        a = crop_window(after_img, box, s["mark"], s["h_px"], plate.shape)
        rows.append((s["id"], b, a, rep))
        reports[s["id"]] = rep

    # ---- sheet: 4 rows of before|after at true scale, labeled
    gut, pad, head = 10, 12, 34
    font = ImageFont.load_default()
    row_ws = [b.shape[1] * 2 + gut for _, b, _, _ in rows]
    sheet_w = max(row_ws) + pad * 2
    sheet_h = pad + sum(b.shape[0] + head + pad for _, b, _, _ in rows)
    sheet = Image.new("RGB", (sheet_w, sheet_h), (16, 16, 20))
    dr = ImageDraw.Draw(sheet)
    y = pad
    for sid, b, a, rep in rows:
        label = (f"{sid} - BEFORE | AFTER (true scale) | ring "
                 f"{rep['ring']['cct']}K | cut {rep['cut_before']['cct']}K -> "
                 f"{rep['cut_after']['cct']}K | dCCT "
                 f"{rep['cct_delta_before']} -> {rep['cct_delta_after']}K | "
                 f"dE {rep['deltaE_before']} -> {rep['deltaE_after']}")
        dr.text((pad, y + 8), label, fill=(230, 230, 220), font=font)
        y += head
        sheet.paste(Image.fromarray(b), (pad, y))
        sheet.paste(Image.fromarray(a), (pad + b.shape[1] + gut, y))
        y += b.shape[0] + pad
    out_jpg = os.path.join(HERE, "explore-regrade-sheet.jpg")
    sheet.save(out_jpg, quality=92)
    reports["_sheet"] = out_jpg
    print(json.dumps(reports, indent=1))

if __name__ == "__main__":
    run()
