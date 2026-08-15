#!/usr/bin/env python3
"""reveal_proof.py -- prove the bay-glass cut serves THE REVEAL, and ship the
backlight that reveal stands against.

CONTENT-full.md sec 6.2: "The reveal is the single most important image in the
chapter and it is a *silhouette behind glass*, not a figure on the pavement."
The reference builds her OPAQUE at renderOrder 0 with a hard bright plate behind
her, and lets the transparent panes blend over both. This lane's equivalent is
layer5-bayglass.png drawn AFTER the actors.

Two products:
  * reveal-back.png -- the backlight. The reference's own `revealBack`: a hard
    bright amber plate (0xffc98a) standing inside the bay's pocket, 3.0 x 2.1 m,
    un-tone-mapped so the contrast that makes the image read cannot drift. Here
    it is a plate-space RGBA layer sized to the bay's glass box, soft only at
    its edge so it does not print a rectangle on the mullions.
  * proof-reveal.png -- a THREE-PANEL proof: plate as shipped | figure drawn
    with NO glass over her | figure with the glass layer over her. The middle
    panel is what a lane that forgot the glass would ship: a cut-out stuck on
    the front of a window. The right panel is the image the chapter needs.

The figure in the proof is a MOCK at the reference's own measurements. The real
one is GAP #4 (the sprite lane's). This script does not ship it.

    python3 reveal_proof.py SETDIR
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

GLASS = [698, 318, 806, 430]          # the bay's GLAZED opening in plate px
PX_M_X, PX_M_Y = 36.0, 53.3           # measured: 3.0 m across, 2.1 m tall
CROSS = (721, 786)                    # world 2.25 -> 4.05 of a glass spanning
                                      # 1.6 -> 4.6, the reference's own crossing
INK = (10, 12, 20)
CRIM = (216, 69, 90)                  # the reference's 0xd8455a
BACK = (255, 201, 138)                # the reference's 0xffc98a


def backlight(platepath):
    """The bright plate she is a silhouette against. Its alpha is the PANE
    mask -- the same amberness `k` slice_street.py cuts the glass alpha from,
    used the other way up -- so the backlight brightens the glazed openings and
    leaves the mullions, the frame and the dark left return alone. A plain
    rectangle here blots the window's own joinery out and the reveal reads as a
    lightbox taped to a wall."""
    x0, y0, x1, y1 = GLASS
    w, h = x1 - x0, y1 - y0
    src = np.asarray(Image.open(platepath).convert('RGB')).astype(np.float32)
    sub = src[y0:y1, x0:x1]
    k = np.clip((sub[..., 0] - sub[..., 2] - 20.0) / 60.0, 0, 1)
    k = np.asarray(Image.fromarray((k * 255).astype(np.uint8))
                   .filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255.0
    out = np.zeros((h, w, 4), np.uint8)
    for c, v in enumerate(BACK):
        out[..., c] = v
    out[..., 3] = np.clip(k * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(out), x0, y0


def figure(k):
    """The reveal figure at fraction k of her crossing, at the reference's own
    metre measurements. k=0 the west edge of the glass, k=1 the panel side."""
    x0, y0, x1, y1 = GLASS
    fx = CROSS[0] + (CROSS[1] - CROSS[0]) * k
    feet = y1 - 4
    im = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def bx(cx_m, cy_m, w_m, h_m, col):
        cx = fx - x0 + cx_m * PX_M_X
        cy = feet - y0 - cy_m * PX_M_Y
        d.rectangle([cx - w_m * PX_M_X / 2, cy - h_m * PX_M_Y / 2,
                     cx + w_m * PX_M_X / 2, cy + h_m * PX_M_Y / 2], fill=col)

    # skirt as a trapezoid (the reference's 4-sided cone, r .17 -> .44, h .86)
    cx = fx - x0
    d.polygon([(cx - .17 * PX_M_X, feet - y0 - .86 * PX_M_Y),
               (cx + .17 * PX_M_X, feet - y0 - .86 * PX_M_Y),
               (cx + .44 * PX_M_X, feet - y0),
               (cx - .44 * PX_M_X, feet - y0)], fill=INK + (255,))
    bx(0, 1.10, 0.34, 0.50, INK + (255,))      # bodice
    bx(0, 1.33, 0.46, 0.14, INK + (255,))      # shoulders
    bx(0, 1.46, 0.12, 0.10, INK + (255,))      # neck
    bx(0, 1.60, 0.236, 0.24, INK + (255,))     # head
    bx(-0.115, 1.71, 0.156, 0.18, INK + (255,))  # bun
    bx(0.02, 1.40, 0.42, 0.10, CRIM + (255,))  # the crimson shawl band
    bx(0, 0.06, 0.62, 0.09, CRIM + (255,))     # the crimson hem band
    # the arm that finds the panel: up at the end of the crossing
    ang = 0.0 if k < 0.8 else 1.0
    bx(0.20, 1.31 - 0.23 + ang * 0.42, 0.095, 0.46, INK + (255,))
    return im, x0, y0


def main():
    setdir = sys.argv[1]
    plate = Image.open(os.path.join(setdir, 'street-smoke.png')).convert('RGBA')
    glass = Image.open(os.path.join(setdir, 'layers', 'bayglass.png')).convert('RGBA')
    lj = json.load(open(os.path.join(setdir, 'layers', 'layers.json')))
    gx, gy = [(o['x'], o['y']) for o in lj['overlays'] if o['id'] == 'bayglass'][0]

    bl, bx0, by0 = backlight(os.path.join(setdir, 'street-window.png'))
    bl.save(os.path.join(setdir, 'reveal-back.png'), optimize=True)

    fig, fx0, fy0 = figure(1.0)
    panels = []
    for mode in ('plate', 'nogless', 'glass'):
        im = plate.copy()
        if mode != 'plate':
            im.alpha_composite(bl, (bx0, by0))
            im.alpha_composite(fig, (fx0, fy0))
        if mode == 'glass':
            im.alpha_composite(glass, (gx, gy))
        panels.append(im.crop((665, 285, 855, 455)).resize((190 * 3, 170 * 3),
                                                           Image.LANCZOS))
    sheet = Image.new('RGB', (190 * 3 * 3 + 24, 170 * 3), (16, 18, 26))
    for i, p in enumerate(panels):
        sheet.paste(p.convert('RGB'), (i * (190 * 3 + 12), 0))
    sheet.save(os.path.join(setdir, 'proof-reveal.png'))

    # how much of her the glass actually covers, as a number
    g = np.asarray(glass).astype(np.float32)[..., 3] / 255.0
    fa = np.zeros(g.shape, np.float32)
    f = np.asarray(fig).astype(np.float32)[..., 3] / 255.0
    oy, ox = fy0 - gy, fx0 - gx
    fa[max(0, oy):oy + f.shape[0], max(0, ox):ox + f.shape[1]] = f[:g.shape[0] - oy,
                                                                  :g.shape[1] - ox]
    sel = fa > .5
    print(json.dumps({
        'backlight': {'file': 'reveal-back.png', 'x': bx0, 'y': by0,
                      'size': list(bl.size)},
        'glassOverFigure': {'meanAlpha': round(float(g[sel].mean()), 3),
                            'p90Alpha': round(float(np.percentile(g[sel], 90)), 3),
                            'note': 'the panes veil her, the muntins cross her'},
        'proof': 'proof-reveal.png (plate | figure, no glass | figure behind glass)'
    }, indent=1))


if __name__ == '__main__':
    main()
