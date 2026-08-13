#!/usr/bin/env python3
"""matte_actors.py -- key the new actors, with a spill ceiling that actually holds.

This lane keys exactly the way the sibling actor lane does and deliberately
reuses tools/laneassets/matte.py rather than forking it -- same border-ring
backing sample, same soft distance band, same 2 px erosion, same baseline
report. One thing is replaced.

THE DEFECT. laneassets/matte.py ends with clamp_spill(), which promises to force
(R+B)/2 - G below a ceiling "safely and totally". It subtracts the excess from R
and from B and then clips the result into 0..255. On a bright pixel that is
exact. On a DARK rim pixel it is not: subtracting a large excess drives R
negative, the clip pulls it back up to 0, and the pixel comes out of the clamp
with MORE magenta excess than the ceiling, not less. Measured on this lane's
first keyed actor, rim pixels came out at 25 against a ceiling of 20 -- and the
dark rim is precisely where a night-street actor is made of, so the guarantee
fails exactly where it is needed.

THE FIX. Do not subtract toward zero; pull R and B TOWARD G proportionally.
With k = ceiling / excess_raw, r' = g + (r-g)*k and b' = g + (b-g)*k give
(r'+b')/2 - g == ceiling exactly, and because 0 <= k <= 1 and g, r, b are all
already inside 0..255, r' and b' are convex combinations of two in-range values
and cannot leave the range. No clip is needed, so nothing can undo the ceiling.

laneassets/matte.py is Beat I's SHIPPED tool and other lanes are generating
against it right now, so it is not edited in place; the corrected function is
installed on the module for this lane's calls only. The defect is worth
upstreaming.

    python3 matte_actors.py IN OUT [--strip N] [--json OUT.json] [--pad 6]
                            [--ceiling 20]
"""
import os
import sys

import numpy as np

sys.path.insert(0, '/Users/samz/Documents/gaslight-remake/tools/laneassets')
import matte  # noqa: E402


def clamp_spill_proportional(rgb, ceiling=20.0):
    """Force (R+B)/2 - G <= ceiling by pulling R and B toward G, never below 0."""
    out = rgb.copy()
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    raw = (r + b) * 0.5 - g
    hot = raw > ceiling
    if not hot.any():
        return out
    k = np.ones_like(raw)
    k[hot] = ceiling / raw[hot]
    out[..., 0] = g + (r - g) * k
    out[..., 2] = g + (b - g) * k
    return out


def _edge_band(alpha, erode=9):
    """the semi-transparent skin of the silhouette, where spill actually lives"""
    from PIL import Image, ImageFilter
    a8 = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
    interior = np.asarray(Image.fromarray(a8).filter(ImageFilter.MinFilter(erode)))
    return (alpha > 0.02) & (interior < 250)


def key_rim_limited(path, *args, **kw):
    """matte.key, with ALL spill correction confined to the rim and the ceiling
    set by the costume instead of by Beat I's costume.

    THE SECOND DEFECT, and the expensive one. laneassets/matte.py corrects spill
    over the WHOLE figure, on the stated grounds that "the costume's own palette
    never exceeds ~20 of (R+B)/2 - G". That is true of Beat I's cast -- a
    steel-blue cloak and a cream waistcoat -- and false of this one. Magenta
    excess is exactly what WINE-BURGUNDY and CRIMSON are made of: Norton's coat
    measures 24 and parts of it 31. Two separate passes then attack it:

      despill()      documents itself as "strongest correction on the rim,
                     light inside", but the blend map it is handed evaluates to
                     0.5 in the interior, and k = (1-|2*0.5-1|)*0.9+0.10 = 1.0
                     -- FULL strength. The interior gets the maximum correction
                     the function can apply, which is the opposite of the
                     comment.
      clamp_spill()  then forces the remainder under a flat ceiling of 20.

    Measured end to end on Norton's frock coat, RGB 56/25/41 came out 32/25/17:
    a wine coat repainted dark brown, and wine is his ONE published accent
    colour. Beat I never saw it because its palette scores ~0 on the measure.

    So: both passes are neutralised inside matte.key and re-applied here, only
    inside the eroded rim band, where "this magenta is not mine" is actually
    true. And the ceiling is taken from the figure's OWN interior rather than
    from a constant -- a wine man's rim is allowed to be as wine as his chest,
    and only excess BEYOND what he is made of is treated as backing bleed.
    """
    img, bg = _orig_key(path, *args, **kw)
    arr = np.asarray(img).astype(np.float32).copy()
    alpha = arr[..., 3] / 255.0
    band = _edge_band(alpha)
    interior = alpha > 0.98
    ex = (arr[..., 0] + arr[..., 2]) * 0.5 - arr[..., 1]
    ceiling = 20.0
    if interior.sum() > 500:
        ceiling = max(20.0, float(np.percentile(ex[interior], 98)))
    if band.any():
        fixed = clamp_spill_proportional(arr[..., :3], ceiling)
        arr[..., :3][band] = fixed[band]
    key_rim_limited.last_ceiling = round(ceiling, 1)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA'), bg


from PIL import Image  # noqa: E402  (after the helpers, for the wrapper only)

_orig_key = matte.key
# Both interior passes are neutralised; the wrapper re-applies them rim-only.
matte.clamp_spill = lambda rgb, ceiling=20.0: rgb
matte.despill = lambda rgb, alpha: rgb
matte.key = key_rim_limited

if __name__ == '__main__':
    # matte.main() parses sys.argv itself; strip our own extra flag first.
    if '--ceiling' in sys.argv:
        i = sys.argv.index('--ceiling')
        _ceiling = float(sys.argv[i + 1])
        del sys.argv[i:i + 2]

        def key_rim_limited_c(path, *a, **k):
            img, bg = _orig_key(path, *a, **k)
            arr = np.asarray(img).astype(np.float32).copy()
            band = _edge_band(arr[..., 3] / 255.0)
            if band.any():
                fixed = clamp_spill_proportional(arr[..., :3], _ceiling)
                arr[..., :3][band] = fixed[band]
            return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8),
                                   'RGBA'), bg

        matte.key = key_rim_limited_c
    sys.argv[0] = os.path.abspath(__file__)
    matte.main()
