#!/usr/bin/env python3
"""frame-motion.py — how much did the picture actually change between grabs?

The behavioural checks prove the clocks are running; this proves the pixels are.
Reports mean |delta| and the fraction of pixels that moved by more than 6/255 for
each consecutive pair in a numbered series.

    python3 tools/ship/frame-motion.py <dir> <prefix>
"""
import sys, glob, os
import numpy as np
from PIL import Image

d, prefix = sys.argv[1], sys.argv[2]
files = sorted(glob.glob(os.path.join(d, prefix + "*.png")))
if len(files) < 2:
    print(f"{prefix}: need 2+ frames, found {len(files)}")
    sys.exit(2)

prev = None
means, fracs = [], []
for f in files:
    a = np.asarray(Image.open(f).convert("RGB"), dtype=np.float32)
    if prev is not None and prev.shape == a.shape:
        dl = np.abs(a - prev)
        means.append(float(dl.mean()))
        fracs.append(float((dl.max(axis=2) > 6).mean()))
    prev = a

print(f"{prefix}: {len(files)} frames  mean|d|={np.mean(means):.2f} "
      f"(min {min(means):.2f})  moved>6={100*np.mean(fracs):.1f}% "
      f"(min {100*min(fracs):.1f}%)")
sys.exit(0 if min(means) > 0.05 else 1)
