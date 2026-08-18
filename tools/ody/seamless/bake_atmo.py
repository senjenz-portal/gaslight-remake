#!/usr/bin/env python3
"""
bake_atmo.py — R5 of the SYNTHESIS (tools/ody/research/SYNTHESIS.md): THE
ATMOSPHERE SANDWICH, generalized. The audit's control case (b3-36 Ulysses)
proved the one device that made a colour-matched actor nearly sit was cave's
`bloomFire` — scene light composited OVER the actors. R5 promotes it to a
per-scene LAW: extract each painted state's own haze/bloom band (the
blurred, luminance-thresholded plate — the plate's own emitters and their
air) and composite it ABOVE the actor group, screen-blended. Anything
sitting on top of both plate and character welds them into one depth stack.

Per state:  mask = smoothstep(L, p90, p99 of the plate's own luminance)
            band = gaussian-blur(plate * mask, 14 plate px) * GAIN
Saved as an RGB PNG (screen blend needs no alpha: black is a no-op), the
GAIN baked into the pixels so the sets carry no tuning constant — a set
drives only its state's crossfade weight (and the emissive dim discipline).

Registry tools/ody/atmo.json (raw-first): per set/state file + sha256 +
band statistics, AND the settle table the lap's [atmo] gate reads: at each
audited settle that stands under a band (band luma over the actor's torso
box >= GATE_LUMA_MIN), the sampled actors must SHOW the band's tint —
proven by missing (band hidden vs shown) in the page.

Deterministic: PIL + numpy, no RNG.
"""

import hashlib
import json
import os

import numpy as np
from PIL import Image, ImageFilter

# macOS Accelerate emits spurious matmul RuntimeWarnings on strided views;
# every value that matters is clipped/validated downstream (regrade.py law).
np.seterr(all="ignore")

ROOT = "/Users/samz/Documents/gaslight-remake"
ASSETS = os.path.join(ROOT, "site-deploy/living-odyssey/assets")
REGISTRY = os.path.join(ROOT, "tools/ody/atmo.json")

GAIN = 0.5              # baked into the pixels
BLUR_PX = 14.0          # the band's air, plate px
P_LO, P_HI = 90.0, 99.0  # luminance percentiles: the plate's own emitters
GATE_LUMA_MIN = 1.5     # a settle stands "under the band" past this

# every painted state, per set (the sets' own PLATES tables, verbatim)
STATES = {
    "cave": {n: "set/cave/cave%s.jpg" % s for n, s in
             [("master", ""), ("dawn", "-dawn"), ("shut", "-shut"),
              ("embers", "-embers"), ("predawn", "-predawn")]},
    "shore": {"night": "set/shore/shore.jpg",
              "day": "set/shore/shore-day.jpg"},
    "sea": {"master": "set/sea/sea.jpg"},
}

# the audited settles (regrade.json's own six) + the state each plays in
SETTLES = [
    dict(unit="plea", set="cave", state="shut", mark=(690, 495), h=75),
    dict(unit="lookhere", set="cave", state="shut", mark=(700, 468), h=75),
    dict(unit="strangers", set="cave", state="shut", mark=(760, 452), h=165),
    dict(unit="greatram", set="cave", state="predawn", mark=(838, 430), h=83),
    dict(unit="council", set="shore", state="day", mark=(445, 507), h=19),
    dict(unit="jeer", set="sea", state="master", mark=(860, 210), h=105),
]


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def extract(plate_rgb):
    L = plate_rgb.astype(np.float64) @ np.array([0.2126, 0.7152, 0.0722])
    lo, hi = np.percentile(L, [P_LO, P_HI])
    hi = max(hi, lo + 1.0)
    t = np.clip((L - lo) / (hi - lo), 0.0, 1.0)
    mask = t * t * (3.0 - 2.0 * t)                       # smoothstep
    glow = plate_rgb.astype(np.float64) * mask[..., None]
    band = np.asarray(Image.fromarray(np.clip(glow, 0, 255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(BLUR_PX)),
                      dtype=np.float64) * GAIN
    return np.clip(np.round(band), 0, 255).astype(np.uint8), (lo, hi)


def main():
    reg_sets = {}
    bands = {}
    for set_id, states in STATES.items():
        reg_sets[set_id] = {"states": {}}
        for name, rel in states.items():
            plate = np.asarray(Image.open(os.path.join(ASSETS, rel))
                               .convert("RGB"))
            band, (lo, hi) = extract(plate)
            out_rel = "set/%s/atmo/%s.png" % (set_id, name)
            out = os.path.join(ASSETS, out_rel)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            Image.fromarray(band).save(out, optimize=True)
            bands[(set_id, name)] = band
            W = np.array([0.2126, 0.7152, 0.0722])
            bl = band.astype(np.float64) @ W
            reg_sets[set_id]["states"][name] = {
                "file": "assets/" + out_rel, "source": "assets/" + rel,
                "sha256": sha256_file(out),
                "thr": [round(lo, 1), round(hi, 1)],
                "meanLuma": round(float(bl.mean()), 2),
                "coveragePct": round(float((bl > 4).mean() * 100), 1),
            }
            print("%-6s %-8s band mean %5.2f  cover %5.1f%%  -> %s" % (
                set_id, name, bl.mean(), (bl > 4).mean() * 100, out_rel))

    settles = []
    for s in SETTLES:
        band = bands[(s["set"], s["state"])].astype(np.float64)
        x, y, h = s["mark"][0], s["mark"][1], s["h"]
        x0, x1 = int(max(0, x - 0.35 * h)), int(min(1408, x + 0.35 * h))
        y0, y1 = int(max(0, y - 0.9 * h)), int(min(768, y - 0.1 * h))
        crop = band[y0:y1, x0:x1]
        tint = crop.reshape(-1, 3).mean(axis=0)
        luma = float(tint @ np.array([0.2126, 0.7152, 0.0722]))
        gated = luma >= GATE_LUMA_MIN
        settles.append({
            "unit": s["unit"], "set": s["set"], "state": s["state"],
            "mark": list(s["mark"]), "hPx": s["h"],
            "box": [x0, y0, x1 - x0, y1 - y0],
            "tint": [round(float(v), 2) for v in tint],
            "luma": round(luma, 2), "gated": gated,
        })
        print("settle %-10s %-5s/%-8s band-over-actor luma %5.2f  %s" % (
            s["unit"], s["set"], s["state"], luma,
            "GATED" if gated else "below the band (ungated)"))

    reg = {
        "lane": "ody-atmo (R5, tools/ody/research/SYNTHESIS.md — the "
                "bloomFire device promoted to a per-scene law)",
        "tool": "tools/ody/seamless/bake_atmo.py",
        "law": "one extracted haze/bloom band per painted state, composited "
               "OVER the actor group (screen; gain %.2f baked in); a set "
               "drives only the state's crossfade weight. The lap holds the "
               "served shas, the over-actors DOM order, and at each gated "
               "settle: the sampled actor region SHOWS the band's tint, "
               "proven by missing (band hidden vs shown)." % GAIN,
        "gain": GAIN, "blurPx": BLUR_PX, "pLo": P_LO, "pHi": P_HI,
        "gateLumaMin": GATE_LUMA_MIN,
        "sets": reg_sets,
        "settles": settles,
    }
    with open(REGISTRY, "w") as f:
        json.dump(reg, f, indent=1)
        f.write("\n")
    print("registry -> %s" % REGISTRY)


if __name__ == "__main__":
    main()
