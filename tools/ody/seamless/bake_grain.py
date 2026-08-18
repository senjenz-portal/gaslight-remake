#!/usr/bin/env python3
"""
bake_grain.py — R3 of the SYNTHESIS (tools/ody/research/SYNTHESIS.md): ONE
SHARED GRAIN over the composed stage. Four lanes named grain/spatial-
frequency mismatch as a top paste tell ("the final tell", "cheapest global
win"); the CRT era's unifier was shared final softness. Our version is a
single BAKED tiling grain PNG — seeded numpy, NOT live feTurbulence (which
is only approximately stable cross-browser) and NOT animated (no wall
clock: two laps that step the same numbers must paint byte-identical
frames) — blended `overlay` over plate+actors+insets inside an
`isolation: isolate` stage, plus ONE stage-level SVG feComponentTransfer
grade so no layer can disagree in tone.

The tile is band-limited in the FREQUENCY domain (FFT), so it is seamless
by construction — a periodic filter cannot leak across the wrap seam.
512x512 at background-size 256 css px: one grain pixel per device pixel on
the dpr-2 panels the lap screenshots.

Deterministic: one seeded default_rng, no wall clock, byte-stable PNG.
Registry: tools/ody/grain.json (raw-first: the shipped file's sha256 + the
css/grade constants stage.js and index.html must agree with — the lap's
[grain] gate holds all three against this file's output).
"""

import hashlib
import json
import os

import numpy as np
from PIL import Image

ROOT = "/Users/samz/Documents/gaslight-remake"
OUT = os.path.join(ROOT, "site-deploy/living-odyssey/assets/fx/grain.png")
REGISTRY = os.path.join(ROOT, "tools/ody/grain.json")

SEED = 20260817          # the bake date — pinned, never wall-clock
SIZE = 512
STD = 25.0               # tile std in 8-bit counts about the 128 mean
OPACITY = 0.08           # the css layer's opacity (stage.js/index.html law)
BLEND = "overlay"
GRADE_EXPONENT = 0.98    # feComponentTransfer gamma — the one stage grade


def main():
    rng = np.random.default_rng(SEED)
    n = rng.standard_normal((SIZE, SIZE))

    # band-limit periodically: film grain is mid/high-frequency — kill the
    # blotchy lows (radius < ~6 px structure) and soften the single-pixel
    # top end. Gaussian weights in frequency space, periodic by construction.
    f = np.fft.fft2(n)
    fy = np.fft.fftfreq(SIZE)[:, None]
    fx = np.fft.fftfreq(SIZE)[None, :]
    r = np.sqrt(fx * fx + fy * fy)          # cycles/px, 0..~0.707
    band = (1.0 - np.exp(-(r / 0.055) ** 2)) * np.exp(-(r / 0.42) ** 2)
    g = np.real(np.fft.ifft2(f * band))
    g *= STD / g.std()

    tile = np.clip(np.round(128.0 + g), 0, 255).astype(np.uint8)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    Image.fromarray(tile).save(OUT, optimize=True)   # 2D uint8 -> mode L

    sha = hashlib.sha256(open(OUT, "rb").read()).hexdigest()
    reg = {
        "lane": "ody-grain (R3, tools/ody/research/SYNTHESIS.md)",
        "tool": "tools/ody/seamless/bake_grain.py",
        "law": "one seeded baked grain tile blended '%s' at %.2f over the "
               "composed stage (plate+actors+insets, isolation:isolate), "
               "plus one stage-level feComponentTransfer gamma %.2f — no "
               "feTurbulence, no wall clock, no per-layer grades. The lap "
               "holds: served sha, the css wiring, paint proven by missing, "
               "same-frame byte determinism, and the noise register at the "
               "audited settles." % (BLEND, OPACITY, GRADE_EXPONENT),
        "seed": SEED,
        "size": SIZE,
        "std": STD,
        "stdMeasured": round(float(tile.astype(np.float64).std()), 2),
        "file": "assets/fx/grain.png",
        "sha256": sha,
        "css": {"opacity": OPACITY, "blend": BLEND, "tileCss": 256},
        "grade": {"filter": "gradef", "type": "gamma",
                  "exponent": GRADE_EXPONENT, "amplitude": 1, "offset": 0},
    }
    with open(REGISTRY, "w") as f2:
        json.dump(reg, f2, indent=1)
        f2.write("\n")
    print("grain tile %dx%d std %.1f (measured %.2f) -> %s" % (
        SIZE, SIZE, STD, reg["stdMeasured"], OUT))
    print("registry -> %s (sha %s...)" % (REGISTRY, sha[:12]))


if __name__ == "__main__":
    main()
