#!/usr/bin/env python3
"""walk_canvas.py -- build the 4-up canvas the walk-cycle edit is asked to redraw.

Beat I's precedent (tools/laneassets/jobs-b3/b4 `king-walk-*`): do NOT ask the
model for "a walk cycle" from nothing. Hand it a wide strip that ALREADY holds
four copies of the picked figure, evenly spaced, all the same height, all on one
ground line, on flat magenta -- then the only thing left to change is the legs.
Identity, costume, palette and scale come in with the canvas and cannot drift.

    python3 walk_canvas.py /abs/matted.png /abs/out.png [--h 480] [--cell 384] [--flip]
"""
import argparse

from PIL import Image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('out')
    ap.add_argument('--frames', type=int, default=4)
    ap.add_argument('--h', type=int, default=480, help='figure height in the canvas')
    ap.add_argument('--cell', type=int, default=384)
    ap.add_argument('--pad-top', type=int, default=40)
    ap.add_argument('--pad-bot', type=int, default=40)
    ap.add_argument('--flip', action='store_true', help='mirror (face the other way)')
    a = ap.parse_args()

    fig = Image.open(a.src).convert('RGBA')
    if a.flip:
        fig = fig.transpose(Image.FLIP_LEFT_RIGHT)
    s = a.h / fig.height
    fig = fig.resize((max(1, round(fig.width * s)), a.h), Image.LANCZOS)

    W, H = a.cell * a.frames, a.h + a.pad_top + a.pad_bot
    canvas = Image.new('RGBA', (W, H), (255, 0, 255, 255))
    for i in range(a.frames):
        x = i * a.cell + (a.cell - fig.width) // 2
        canvas.alpha_composite(fig, (x, a.pad_top))
    canvas.convert('RGB').save(a.out)
    print({'out': a.out, 'size': [W, H], 'cell': a.cell, 'frames': a.frames,
           'figure_h': a.h, 'baseline_y': a.pad_top + a.h})


if __name__ == '__main__':
    main()
