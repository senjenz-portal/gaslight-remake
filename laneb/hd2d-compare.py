#!/usr/bin/env python3
"""hd2d-compare.py — stack our shot under the Octopath style reference.

Also prints the two numbers that were actually driving the tuning: the
brightness histogram split (how much of the frame sits in deep shadow versus
mid versus highlight) and the mean saturation. The reference is mostly shadow
with small warm highlights; matching that split is most of the "look".
"""
import sys

import numpy as np
from PIL import Image

REF = '/Users/samz/Downloads/image (54).png'
OURS = sys.argv[1] if len(sys.argv) > 1 else '/tmp/hd2d-H.png'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/hd2d-compare.png'
W = 1280


def load(p):
    im = Image.open(p).convert('RGB')
    return im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)


def stats(im, label):
    a = np.asarray(im).astype(float) / 255.0
    lum = a @ np.array([0.2126, 0.7152, 0.0722])
    mx, mn = a.max(2), a.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    print('%-10s  shadow<0.12 %5.1f%%   mid %5.1f%%   hi>0.6 %5.1f%%   '
          'mean lum %.3f   mean sat %.3f'
          % (label, (lum < 0.12).mean() * 100,
             ((lum >= 0.12) & (lum <= 0.6)).mean() * 100,
             (lum > 0.6).mean() * 100, lum.mean(), sat.mean()))
    return lum


def main():
    ref, ours = load(REF), load(OURS)
    stats(ref, 'reference')
    stats(ours, 'ours')
    gap = 14
    out = Image.new('RGB', (W, ref.height + ours.height + gap), (16, 16, 20))
    out.paste(ref, (0, 0))
    out.paste(ours, (0, ref.height + gap))
    out.save(OUT)
    print('wrote', OUT, out.size, '(reference on top)')


if __name__ == '__main__':
    main()
