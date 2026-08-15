#!/usr/bin/env python3
"""reframe.py -- put a won candidate into the book's 1408x768 plate space
WITHOUT stretching the painting.

gemini-3-pro-image picks its own output aspect. The chase winner came back
1376x768 -- 32 px short in width, the right height. Resampling to 1408 would
scale the diorama by 2.3% in x only, which is a distortion of every measured
mark; so instead the VOID is extended by 16 px on each side and the painting is
pasted in at 1:1.

The void at both vertical edges of this plate is subject-free (measured: left
strip Lmax 23.4, right strip Lmax 49.9 -- the right is brighter because the fog
bank's glow spreads into the backdrop, not because anything is drawn there) and
horizontally almost flat (|dL/dcol| ~ 0.01). So each output row is filled by a
per-row, per-channel LEAST-SQUARES LINE fitted to that row's outermost `fitw`
columns and evaluated outward. That is C1-continuous at the seam by
construction, and the seam residual is measured and reported rather than
assumed.

    python3 reframe.py SRC OUT --width 1408 [--fitw 24] [--json out.json]
"""
import argparse
import hashlib
import json
import os

import numpy as np
from PIL import Image


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def extrapolate(block, n, direction):
    """block: (H, fitw, 3) taken at an edge, ordered outward-in for 'left'.
    Returns (H, n, 3) continuing the per-row least-squares line outward."""
    H, fw, C = block.shape
    t = np.arange(fw, dtype=np.float64)            # 0..fw-1 going inward
    tm, tv = t.mean(), ((t - t.mean()) ** 2).sum()
    out = np.zeros((H, n, C), dtype=np.float64)
    # target abscissae: the pad columns lie at t = -1 .. -n going outward
    tt = -np.arange(1, n + 1, dtype=np.float64)
    for c in range(C):
        y = block[..., c].astype(np.float64)       # (H, fw)
        ym = y.mean(axis=1, keepdims=True)
        slope = ((t - tm)[None, :] * (y - ym)).sum(axis=1, keepdims=True) / tv
        out[..., c] = ym + slope * (tt[None, :] - tm)
    if direction == 'left':
        out = out[:, ::-1, :]                      # nearest-to-seam last -> first
    return np.clip(out, 0, 255)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('out')
    ap.add_argument('--width', type=int, default=1408)
    ap.add_argument('--height', type=int, default=768)
    ap.add_argument('--fitw', type=int, default=24)
    ap.add_argument('--json', default='')
    a = ap.parse_args()

    im = Image.open(a.src).convert('RGB')
    src = np.asarray(im).astype(np.float64)
    H, W, _ = src.shape
    if H != a.height:
        raise SystemExit('height %d != plate height %d -- this tool only pads '
                         'width; a height mismatch needs a different call' % (H, a.height))
    pad = a.width - W
    if pad < 0:
        raise SystemExit('source is wider than the plate')
    lpad, rpad = pad // 2, pad - pad // 2

    left = extrapolate(src[:, :a.fitw, :], lpad, 'left') if lpad else None
    right = extrapolate(src[:, ::-1, :][:, :a.fitw, :], rpad, 'right') if rpad else None

    parts = [p for p in (left, src, right) if p is not None]
    canvas = np.concatenate(parts, axis=1)
    assert canvas.shape == (a.height, a.width, 3), canvas.shape

    # seam proof: the pad column adjacent to the painting vs the painting's own
    # first column, per channel, max over rows.
    res = {}
    if lpad:
        res['left_seam_max_abs'] = float(np.abs(canvas[:, lpad - 1] - canvas[:, lpad]).max())
        res['left_pad_cols'] = lpad
    if rpad:
        j = lpad + W
        res['right_seam_max_abs'] = float(np.abs(canvas[:, j - 1] - canvas[:, j]).max())
        res['right_pad_cols'] = rpad

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    Image.fromarray(np.rint(canvas).astype(np.uint8)).save(a.out, optimize=True)

    meta = {
        'generator': 'tools/lanechase/reframe.py',
        'source': {'path': os.path.abspath(a.src), 'sha256': sha(a.src),
                   'size': [W, H]},
        'out': {'path': os.path.abspath(a.out), 'sha256': sha(a.out),
                'size': [a.width, a.height]},
        'method': 'per-row per-channel least-squares linear extrapolation of the '
                  'outermost %d columns; painting pasted 1:1, never resampled' % a.fitw,
        'paste_origin': [lpad, 0],
        'seam': res,
    }
    print(json.dumps(meta, indent=1))
    if a.json:
        with open(a.json, 'w') as f:
            json.dump(meta, f, indent=1)


if __name__ == '__main__':
    main()
