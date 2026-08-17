#!/usr/bin/env python3
"""deflicker.py — kill Seedance exposure pumping across strip cells (2026-08-17).

THE MEASURED DEFECT: figure-masked mean luma (Rec.709 over the alpha>127
figure mask — the metric that reproduces the review's collapse numbers 93.5
95.3 94.9 89.6 103.2 100.5 105.4 107.0 108.6 108.5 exactly) swings up to
13.6 between ADJACENT cells of one strip: Seedance pumps exposure inside a
clip, and the slicer inherits it. On screen that is a per-cell FLASH — the
owner saw it on the giant's collapse (the 89.6 -> 103.2 step).

THE FIX (deterministic, luma-only): per strip, fit a SMOOTH reference curve
over the per-cell figure lumas and normalize each cell to it —
  * BRIDGES (kind:'bridge'): the reference is the LINEAR RAMP between the two
    ENDPOINT cells' own lumas. The endpoints ARE the gated poses (endpoint
    XOR/scale laws were measured against those bytes) so their gain is 1.0 by
    construction and this tool asserts them BYTE-IDENTICAL after the pass.
  * LOOPS (everything else — the verb-clock loops and the walk cycles): the
    reference is the strip's own CIRCULAR moving average (smallest odd window
    that brings the reference's circular adjacent delta under LOOP_REF_D), so
    loop closure is preserved — cell 9 -> cell 0 is an adjacency too.
Gain is applied to LUMA ONLY, chroma preserved exactly: X' = X + (g-1)*Y709
per channel shifts Y709 to g*Y709 while (R-Y, G-Y, B-Y) are untouched; alpha
is untouched (the figure masks, anchors and XOR gates all read alpha). Gain
is clamped to [0.85, 1.18].

DETERMINISM: the first run stashes the pre-fix bytes in _work/deflicker/orig/
(keyed by file name; the stash is the input of record from then on), so every
re-run recomputes the identical floats from the identical bytes and writes
byte-identical PNGs — run it twice and diff, the tool does that check itself
with --verify-determinism.

SHIPPING: writes the corrected strips IN PLACE over
site-deploy/living-odyssey/assets/actor/*.png (strips are NOT graded per set —
graded/{cave,sea,shore}/ hold pose cuts only, verified 2026-08-17), updates
every sha256 in tools/ody/strips.json, and regenerates app/strips.js verbatim
(the lap's registry-shipped gate re-parses both, so formatting drift is
harmless but sha drift is a lap failure).

THE LAW THIS EARNS: [strip-luma] in lap-ody.mjs — for every registered strip,
adjacent-cell figure-masked luma delta <= 4.0 (wrap pair included for loops;
bridge cells also held to their own ramp, endpoints not exempted).

Usage: python3 tools/ody/seamless/deflicker.py [--verify-determinism]
"""
import hashlib
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ODY = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(ODY))
ASSETS = os.path.join(ROOT, 'site-deploy', 'living-odyssey', 'assets')
APP_STRIPS = os.path.join(ROOT, 'site-deploy', 'living-odyssey', 'app', 'strips.js')
REG_PATH = os.path.join(ODY, 'strips.json')
ORIG_DIR = os.path.join(HERE, '_work', 'deflicker', 'orig')

GAIN_LO, GAIN_HI = 0.85, 1.18   # the clamp: never crush or blow a cell
LOOP_REF_D = 3.0                # target smoothness of a loop's reference
GATE_D = 4.0                    # the [strip-luma] law's own number
W709 = (0.2126, 0.7152, 0.0722)


def luma709(rgb):
    return W709[0] * rgb[..., 0] + W709[1] * rgb[..., 1] + W709[2] * rgb[..., 2]


def cell_lumas(img, cw, n):
    """Per-cell figure-masked (alpha>127) mean Rec.709 luma."""
    out = []
    for i in range(n):
        c = img[:, i * cw:(i + 1) * cw].astype(np.float64)
        m = c[:, :, 3] > 127
        out.append(float(luma709(c)[m].mean()))
    return out


def circular_ma(vals, w):
    n = len(vals)
    h = w // 2
    return [sum(vals[(i + j) % n] for j in range(-h, h + 1)) / w for i in range(n)]


def reference(lumas, kind):
    """The smooth curve each cell is normalized to."""
    n = len(lumas)
    if kind == 'bridge':
        # the endpoints are the gated poses: the ramp passes THROUGH them
        return [lumas[0] + (lumas[-1] - lumas[0]) * i / (n - 1) for i in range(n)], 'ramp'
    # loop: circular MA, widening until the reference itself is smooth —
    # circular, so closure (cell n-1 -> cell 0) is preserved by construction
    for w in range(3, n + 1, 2):
        ref = circular_ma(lumas, w)
        worst = max(abs(ref[(i + 1) % n] - ref[i]) for i in range(n))
        if worst <= LOOP_REF_D:
            return ref, f'circular-ma w={w}'
    flat = sum(lumas) / n
    return [flat] * n, 'flat-mean'


def apply_gains(img, cw, n, gains):
    """X' = X + (g-1)*Y709 per channel: luma scaled, chroma and alpha exact."""
    out = img.copy()
    for i, g in enumerate(gains):
        if g == 1.0:
            continue  # bit-exact hold (bridge endpoints land here)
        c = img[:, i * cw:(i + 1) * cw, :3].astype(np.float64)
        y = luma709(c)
        c = c + (g - 1.0) * y[..., None]
        out[:, i * cw:(i + 1) * cw, :3] = np.clip(np.rint(c), 0, 255).astype(np.uint8)
    return out


def max_adjacent(lumas, kind):
    n = len(lumas)
    pairs = range(n) if kind != 'bridge' else range(n - 1)
    return max(abs(lumas[(i + 1) % n] - lumas[i]) for i in pairs)


def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def run():
    reg = json.load(open(REG_PATH))
    os.makedirs(ORIG_DIR, exist_ok=True)
    report = []
    for name, s in reg.items():
        shipped = os.path.join(ASSETS, s['file'])
        orig = os.path.join(ORIG_DIR, os.path.basename(s['file']))
        if not os.path.exists(orig):
            shutil.copy2(shipped, orig)   # first run: the pre-fix bytes of record
        img = np.asarray(Image.open(orig).convert('RGBA')).copy()
        cw, n = s['cell'][0], s['n']
        kind = 'bridge' if s.get('kind') == 'bridge' else 'loop'
        before = cell_lumas(img, cw, n)
        ref, refkind = reference(before, kind)
        gains = [min(GAIN_HI, max(GAIN_LO, r / m)) for r, m in zip(ref, before)]
        fixed = apply_gains(img, cw, n, gains)
        after = cell_lumas(fixed, cw, n)
        if kind == 'bridge':
            assert np.array_equal(fixed[:, :cw], img[:, :cw]) and \
                   np.array_equal(fixed[:, (n - 1) * cw:n * cw], img[:, (n - 1) * cw:n * cw]), \
                   f'{name}: a bridge endpoint changed — the gated poses must hold'
        Image.fromarray(fixed).save(shipped)
        s['sha256'] = sha256(shipped)
        d0, d1 = max_adjacent(before, kind), max_adjacent(after, kind)
        ramp_err = max(abs(a - r) for a, r in zip(after, ref)) if kind == 'bridge' else None
        clamped = sum(1 for g in gains if g in (GAIN_LO, GAIN_HI))
        report.append((name, kind, refkind, d0, d1, ramp_err, clamped))
        ok = d1 <= GATE_D and (ramp_err is None or ramp_err <= GATE_D)
        print(f'{name:18s} {kind:6s} ref={refkind:16s} max adj delta {d0:6.2f} -> {d1:5.2f}'
              + (f'  ramp err {ramp_err:.2f}' if ramp_err is not None else '')
              + (f'  [{clamped} gain(s) clamped]' if clamped else '')
              + ('' if ok else '  ** OVER THE 4.0 LAW **'))
    # ---- ship the registry: strips.json + the verbatim app/strips.js mirror
    with open(REG_PATH, 'w') as f:
        json.dump(reg, f, indent=1)
    head = open(APP_STRIPS).read().split('export const STRIPS =')[0]
    with open(APP_STRIPS, 'w') as f:
        f.write(head + 'export const STRIPS =\n' + json.dumps(reg, indent=1) + ';\n')
    bad = [r for r in report if r[4] > GATE_D or (r[5] is not None and r[5] > GATE_D)]
    print(f'\n{len(report)} strips deflickered; registry + app/strips.js rewritten.')
    if bad:
        print('FAILED the 4.0 law:', ', '.join(r[0] for r in bad))
        sys.exit(1)


if __name__ == '__main__':
    if '--verify-determinism' in sys.argv:
        reg = json.load(open(REG_PATH))
        pre = {n: s['sha256'] for n, s in reg.items()}
        run()
        reg2 = json.load(open(REG_PATH))
        drift = [n for n, s in reg2.items() if pre.get(n) != s['sha256']]
        if drift:
            print('NOT DETERMINISTIC — shas moved on re-run:', ', '.join(drift))
            sys.exit(1)
        print('byte-deterministic: re-run reproduced every sha')
    else:
        run()
