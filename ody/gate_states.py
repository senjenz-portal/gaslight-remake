#!/usr/bin/env python3
"""Region gate for the ody cave states, built on platediff's measures.

Regions in MASTER pixel coords (1408x768):
  mouth  : the moonlit opening + the boulder's rest position (the swap zone)
  fire   : the fire pit
  racks  : cheese racks (must survive)
  pens   : sheep pens right of the fire (must survive structurally)
  sky    : backdrop strip (must survive)

Per region: %px changed (thresh 18, same as platediff), mean abs delta,
edge IoU self-quantile (geometry: did it MOVE) computed on the region crop.
"""
import json
import sys

import numpy as np
from PIL import Image, ImageFilter

W, H = 1408, 768
REGIONS = {
    'mouth': (176, 192, 528, 480),
    'fire': (500, 384, 792, 576),
    'racks': (528, 120, 880, 300),
    'pens': (792, 288, 1144, 560),
    'sky': (0, 0, 1408, 72),
}


def load(p):
    im = Image.open(p).convert('RGB')
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    return np.asarray(im).astype(np.float32)


def lum(a):
    return a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114


def sobel(g):
    im = Image.fromarray(np.clip(g, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.FIND_EDGES)).astype(np.float32)


def region_stats(o, c, box):
    x0, y0, x1, y1 = box
    ro, rc = o[y0:y1, x0:x1], c[y0:y1, x0:x1]
    d = np.abs(ro - rc).max(axis=2)
    pct = float((d > 18).mean() * 100)
    mad = float(np.abs(lum(ro) - lum(rc)).mean())
    eo, ec = sobel(lum(ro)), sobel(lum(rc))
    qo, qc = float(np.quantile(eo, 0.97)), float(np.quantile(ec, 0.97))
    bo, bc = eo >= qo, ec >= qc  # >= : busy crops saturate FIND_EDGES at 255
                                 # and a > threshold of 255 empties the mask
    iou = float((bo & bc).sum() / max(1, (bo | bc).sum()))
    return {'pct_changed': round(pct, 1), 'mean_abs_lum': round(mad, 2),
            'edge_iou_selfq': round(iou, 3)}


def main():
    o, c = load(sys.argv[1]), load(sys.argv[2])
    out = {r: region_stats(o, c, box) for r, box in REGIONS.items()}
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
