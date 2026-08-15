#!/usr/bin/env python3
"""walkcanvas.py -- build the 4-up magenta strip a walk cycle is generated ON.

Asking the model for "a four frame walk cycle" from nothing gives four different
people at four different heights on four different ground lines. Beat I solved
it by handing the model a strip that ALREADY has four identical copies of the
finished figure, evenly spaced, feet on one line, and asking for exactly one
change: pose them. Everything the cycle must not change -- who he is, how tall,
where the ground is -- is then in the input rather than in the prose.

This is that builder, taking the keyed RGBA idle this lane just made.

    python3 walkcanvas.py IDLE.png OUT.png [--frames 4] [--flip]
"""
import argparse
import json

from PIL import Image

MAGENTA = (255, 0, 255, 255)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('idle')
    ap.add_argument('out')
    ap.add_argument('--frames', type=int, default=4)
    ap.add_argument('--flip', action='store_true',
                    help='mirror the figure (walk the other way)')
    ap.add_argument('--pad', type=int, default=6,
                    help='baseline pad already inside the idle cutout')
    a = ap.parse_args()

    fig = Image.open(a.idle).convert('RGBA')
    if a.flip:
        fig = fig.transpose(Image.FLIP_LEFT_RIGHT)

    # A generous cell: the walk swings legs and coat wider than the idle stands,
    # and a frame that touches its neighbour cannot be split back out by
    # matte.py's column-gap finder.
    cell_w = round(fig.width * 1.9)
    margin_y = round(fig.height * 0.10)
    H = fig.height + margin_y * 2
    W = cell_w * a.frames

    sheet = Image.new('RGBA', (W, H), MAGENTA)
    for i in range(a.frames):
        x = i * cell_w + (cell_w - fig.width) // 2
        sheet.alpha_composite(fig, (x, margin_y))
    sheet.convert('RGB').save(a.out)
    print(json.dumps({'out': a.out, 'size': [W, H], 'frames': a.frames,
                      'cell_w': cell_w, 'figure': list(fig.size),
                      'baseline_y': H - margin_y - a.pad, 'flipped': a.flip}))


if __name__ == '__main__':
    main()
