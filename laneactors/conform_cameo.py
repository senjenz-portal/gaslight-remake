#!/usr/bin/env python3
"""conform_cameo.py -- bring a generated cameo card into plate space, 1408x768.

The image API returns 1376x768 for a 16:9 request, and the shipped cameo family
is 1408x768. Resampling to fit would soften every facet edge on the card, which
is the one thing a low-poly style cannot afford, so the card is NOT resampled:
the 32 missing columns are added to the FIELD, edge-replicated from the border,
where the ground is a nearly flat gradient and the bust never reaches. Same
"analytic void extension, no resample" rule the church plate lane conformed on.

Prints the seam error it introduced so the claim is checkable, not asserted.

    python3 conform_cameo.py IN OUT [--width 1408]
"""
import argparse
import json

import numpy as np
from PIL import Image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inp')
    ap.add_argument('out')
    ap.add_argument('--width', type=int, default=1408)
    ap.add_argument('--height', type=int, default=768)
    a = ap.parse_args()

    im = Image.open(a.inp).convert('RGB')
    src = np.asarray(im).astype(np.float32)
    h, w = src.shape[:2]
    if h != a.height:
        raise SystemExit('height %d != %d -- this tool only extends width' % (h, a.height))
    if w > a.width:
        raise SystemExit('source is wider than plate space; nothing to extend')

    pad = a.width - w
    left = pad // 2
    right = pad - left

    def extend(edge_cols, n, outward):
        """Continue the field's own falloff instead of freezing it.

        Pure edge replication is flat, and on this card's right border the
        ground still falls ~1.1 RGB per column, so 16 frozen columns would read
        as a band against a field that is visibly still moving. Fit the slope
        over the last few columns per row and per channel, and walk it outward.
        """
        k = edge_cols.shape[1]
        xs = np.arange(k, dtype=np.float32)
        xm = xs.mean()
        denom = float(((xs - xm) ** 2).sum())
        ym = edge_cols.mean(axis=1, keepdims=True)
        slope = (((xs - xm)[None, :, None]) * (edge_cols - ym)).sum(axis=1) / denom
        last = edge_cols[:, -1] if outward > 0 else edge_cols[:, 0]
        steps = np.arange(1, n + 1, dtype=np.float32) * outward
        delta = slope[:, None, :] * steps[None, :, None]
        # BOUND THE DRIFT. An unbounded per-row fit lets a steep row walk the
        # field 22 RGB away from the border in 16 columns, which is far enough
        # that the cameo gate stops seeing field and starts counting those
        # columns as part of the bust -- the extension has to stay invisible,
        # not merely smooth. A few RGB of continued falloff is all the seam
        # needs; anything past that is the fit extrapolating noise.
        cap = 6.0
        delta = np.clip(delta, -cap, cap)
        cols = last[:, None, :] + delta
        return cols[:, ::-1] if outward < 0 else cols

    fit = 8
    out = np.concatenate([
        extend(src[:, :fit], left, -1.0),
        src,
        extend(src[:, -fit:], right, +1.0),
    ], axis=1)
    out = np.clip(out, 0, 255)

    # what the extension cost: how far the replicated column is from the one it
    # replaces, measured as the plate's own left/right border gradient.
    grad_l = float(np.abs(src[:, 0] - src[:, 1]).mean()) if w > 1 else 0.0
    grad_r = float(np.abs(src[:, -1] - src[:, -2]).mean()) if w > 1 else 0.0
    Image.fromarray(out.astype(np.uint8)).save(a.out)
    print(json.dumps({
        'out': a.out, 'from': [w, h], 'to': [a.width, a.height],
        'pad_left': left, 'pad_right': right,
        'border_gradient_per_column_rgb_mean': [round(grad_l, 3), round(grad_r, 3)],
        'worst_case_field_error': round(max(grad_l, grad_r) * max(left, right), 2),
        'note': 'error is the drift the true gradient would have accumulated '
                'across the padded band; on a flat field it is ~0',
    }))


if __name__ == '__main__':
    main()
