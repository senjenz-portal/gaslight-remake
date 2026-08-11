#!/usr/bin/env python3
"""build_sprites.py — cut the NB Pro walk strip into a clean pixel-art sprite sheet.

Input  (raw-first, never edited in place):
    assets/raw/hd2d-sprite/<ts>/walk-a.png   4-frame walk strip on flat magenta
    assets/raw/hd2d-sprite/<ts>/idle-a.png   single idle stance on flat magenta
Output (site):
    hd2d/sprites/king-walk.png     5-cell horizontal sheet: idle, w0, w1, w2, w3
    hd2d/sprites/manifest.json     provenance + cell geometry the page reads

Pipeline per frame: magenta chroma key -> column clustering to find frames ->
common baseline + head-centroid anchoring (the cloak swings, the head does not)
-> single global BOX downscale to the target art resolution (this is also what
kills the JPEG ringing NB Pro delivers) -> hard alpha threshold -> palette
quantise with no dither. The result is genuine aliased pixel art.
"""
import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image

RAW_DIR = sys.argv[1] if len(sys.argv) > 1 else \
    '/Users/samz/Documents/gaslight-remake/assets/raw/hd2d-sprite/20260811-153630'
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sprites')

TARGET_FIGURE_H = 132   # art pixels, tallest frame
CELL_PAD_X = 6          # art pixels of breathing room each side
CELL_PAD_TOP = 5
CELL_PAD_BOT = 3
N_COLORS = 28


def load_rgb(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.int16)


def magenta_mask(a):
    """True where the pixel is the chroma-key field (tolerant: JPEG ringing)."""
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    return (r > 170) & (b > 170) & (g < 120) & ((r - g) > 70) & ((b - g) > 70)


def frame_spans(fg, expect=4, min_occ=3):
    """Split the strip into `expect` frame column-ranges.

    Gap detection alone fails here: at this stride the swinging cloaks of
    adjacent frames come within ~40px, closer than the speckle-merge distance.
    So cut at the occupancy VALLEY nearest each expected boundary instead --
    the sprites are evenly spaced by construction, and the thinnest column
    between two of them is always the true seam.
    """
    occ = fg.sum(axis=0)
    on = np.where(occ > min_occ)[0]
    lo, hi = int(on.min()), int(on.max())
    if expect == 1:
        return [[lo, hi]]
    width = hi - lo + 1
    cuts = []
    for i in range(1, expect):
        target = lo + width * i / expect
        half = width / expect * 0.30
        a = max(lo + 1, int(target - half))
        b = min(hi, int(target + half))
        window = occ[a:b + 1]
        cuts.append(a + int(np.argmin(window)))
    bounds = [lo] + cuts + [hi]
    spans = []
    for i in range(expect):
        s, e = bounds[i], bounds[i + 1]
        cols = np.where(occ[s:e + 1] > min_occ)[0]
        spans.append([s + int(cols.min()), s + int(cols.max())])
    seam = [int(occ[c]) for c in cuts]
    print('  seams at %s (occupancy %s px)' % (cuts, seam))
    return spans


def dilate_colour(colour, known, iters):
    """Flood the known (foreground) colours outward over the unknown region."""
    colour = colour.copy()
    known = known.copy()
    for _ in range(iters):
        if known.all():
            break
        for shift, axis in ((1, 0), (-1, 0), (1, 1), (-1, 1)):
            nb_col = np.roll(colour, shift, axis=axis)
            nb_known = np.roll(known, shift, axis=axis)
            fill = (~known) & nb_known
            if not fill.any():
                continue
            colour[fill] = nb_col[fill]
            known |= fill
    return colour


def despeckle_key(rgba):
    """Any surviving key-coloured pixel inside the sprite takes a neighbour."""
    a = np.asarray(rgba).astype(np.int16)
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    # The character's palette is navy / orange / cream / skin / black -- in every
    # one of those, green sits BETWEEN red and blue. A pixel whose green dips
    # below both is magenta contamination, however dark it got, so this catches
    # the dim purple rim the JPEG ringing leaves as well as bright key pixels.
    bad = (al > 0) & (g < np.minimum(r, b) - 12) & ((r + b) > 40)
    n = int(bad.sum())
    if n:
        good = (al > 0) & ~bad
        a[:, :, :3] = dilate_colour(a[:, :, :3], good, iters=4)
        print('  despeckled %d key-tinted pixels' % n)
    return Image.fromarray(a.astype(np.uint8))


def head_anchor_x(fg_slice):
    """Horizontal centroid of the top 18% of the body: a stable pivot."""
    ys = np.where(fg_slice.any(axis=1))[0]
    top, bot = ys.min(), ys.max()
    head_rows = fg_slice[top:top + max(4, int((bot - top) * 0.18))]
    xs = np.where(head_rows.any(axis=0))[0]
    return (xs.min() + xs.max()) / 2.0


def extract(path, expect):
    """-> list of dicts {rgb, fg, ax (anchor x), top, bottom} in source pixels."""
    a = load_rgb(path)
    fg = ~magenta_mask(a)
    # drop 1px speckle so a stray JPEG dot cannot define the bbox
    fg = fg & (np.roll(fg, 1, 0) | np.roll(fg, -1, 0)) \
            & (np.roll(fg, 1, 1) | np.roll(fg, -1, 1))
    out = []
    for x0, x1 in frame_spans(fg, expect):
        sub_fg = fg[:, x0:x1 + 1]
        ys = np.where(sub_fg.any(axis=1))[0]
        out.append({
            'rgb': a[:, x0:x1 + 1],
            'fg': sub_fg,
            'ax': head_anchor_x(sub_fg),
            'top': int(ys.min()),
            'bot': int(ys.max()),
            'x0': int(x0), 'x1': int(x1),
        })
    return out


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    walk_path = os.path.join(RAW_DIR, 'walk-a.png')
    idle_path = os.path.join(RAW_DIR, 'idle-a.png')

    print('walk strip:')
    walk = extract(walk_path, 4)
    for i, f in enumerate(walk):
        print('  frame %d  x[%d..%d] h=%d anchor=%.1f'
              % (i, f['x0'], f['x1'], f['bot'] - f['top'] + 1, f['ax']))
    print('idle:')
    idle = extract(idle_path, 1)
    print('  h=%d' % (idle[0]['bot'] - idle[0]['top'] + 1))

    # One global scale for the whole strip so the walk's natural body bob
    # survives; the idle plate came from its own generation so it gets its own
    # scale, matched on figure height.
    walk_h = max(f['bot'] - f['top'] + 1 for f in walk)
    scale_walk = TARGET_FIGURE_H / walk_h
    idle_h = idle[0]['bot'] - idle[0]['top'] + 1
    scale_idle = TARGET_FIGURE_H / idle_h
    print('scale walk=%.4f idle=%.4f' % (scale_walk, scale_idle))

    frames = [(idle[0], scale_idle)] + [(f, scale_walk) for f in walk]

    # scaled geometry: baseline = lowest foot, anchor = head centre
    geo = []
    for f, s in frames:
        ys = np.where(f['fg'].any(axis=1))[0]
        xs = np.where(f['fg'].any(axis=0))[0]
        geo.append({
            'left_of_anchor': (f['ax'] - xs.min()) * s,
            'right_of_anchor': (xs.max() - f['ax']) * s,
            'height_above_base': (f['bot'] - ys.min() + 1) * s,
        })
    cell_w = int(np.ceil(max(g['left_of_anchor'] for g in geo)
                         + max(g['right_of_anchor'] for g in geo))) + CELL_PAD_X * 2
    cell_h = int(np.ceil(max(g['height_above_base'] for g in geo))) \
        + CELL_PAD_TOP + CELL_PAD_BOT
    cell_w += cell_w % 2
    print('cell %dx%d' % (cell_w, cell_h))

    anchor_x = CELL_PAD_X + max(g['left_of_anchor'] for g in geo)
    baseline_y = cell_h - CELL_PAD_BOT

    sheet = Image.new('RGBA', (cell_w * len(frames), cell_h), (0, 0, 0, 0))
    for i, (f, s) in enumerate(frames):
        rgb = f['rgb']
        alpha = (f['fg'] * 255).astype(np.uint8)
        rgba = np.dstack([rgb.astype(np.uint8), alpha])
        # Push the character's own colour OUT into the key field before the BOX
        # average runs. One output pixel covers ~1/s source pixels, so the
        # dilation has to reach that far or every silhouette edge averages in
        # magenta and the sprite gets a pink halo.
        m = f['fg']
        rgba[:, :, :3] = dilate_colour(rgba[:, :, :3], m,
                                       iters=int(np.ceil(1 / s)) + 2)

        im = Image.fromarray(rgba, 'RGBA')
        sw = max(1, int(round(im.width * s)))
        sh_ = max(1, int(round(im.height * s)))
        im = im.resize((sw, sh_), Image.BOX)

        a = np.asarray(im).copy()
        a[:, :, 3] = np.where(a[:, :, 3] >= 128, 255, 0)   # hard aliased edge
        im = Image.fromarray(a, 'RGBA')

        # paste so the head anchor and the foot baseline land on the cell rails
        px = int(round(anchor_x - f['ax'] * s))
        py = int(round(baseline_y - (f['bot'] + 1) * s))
        sheet.alpha_composite(im, (i * cell_w + px, py))

    # palette quantise (no dither) -> flat pixel-art colour blocks
    rgb_only = Image.new('RGB', sheet.size, (0, 0, 0))
    rgb_only.paste(sheet.convert('RGB'), (0, 0), sheet)
    q = rgb_only.quantize(colors=N_COLORS, method=Image.MEDIANCUT,
                          dither=Image.NONE).convert('RGB')
    final = np.dstack([np.asarray(q), np.asarray(sheet)[:, :, 3]])
    final = despeckle_key(Image.fromarray(final.astype(np.uint8), 'RGBA'))

    out_png = os.path.join(OUT_DIR, 'king-walk.png')
    final.save(out_png)

    def sha(p):
        return hashlib.sha256(open(p, 'rb').read()).hexdigest()

    manifest = {
        'lane': 'hd2d-sprite-cut',
        'generator': 'build_sprites.py',
        'source_raw_dir': RAW_DIR,
        'sources': [
            {'file': idle_path, 'sha256': sha(idle_path), 'role': 'idle plate'},
            {'file': walk_path, 'sha256': sha(walk_path), 'role': '4-frame walk strip'},
        ],
        'output': {
            'file': out_png, 'sha256': sha(out_png),
            'size': list(final.size),
            'cell': [cell_w, cell_h],
            'frames': ['idle', 'walk0', 'walk1', 'walk2', 'walk3'],
            'anchor_x_in_cell': round(anchor_x, 2),
            'baseline_y_in_cell': baseline_y,
            'figure_height_px': TARGET_FIGURE_H,
            'colors': N_COLORS,
        },
        'params': {'scale_walk': round(scale_walk, 5),
                   'scale_idle': round(scale_idle, 5),
                   'alpha': 'binary threshold 128, magenta chroma key',
                   'downscale': 'PIL BOX after edge-bleed guard'},
    }
    with open(os.path.join(OUT_DIR, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
    print('wrote', out_png, final.size)


if __name__ == '__main__':
    main()
