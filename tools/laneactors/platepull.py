#!/usr/bin/env python3
"""platepull.py -- pull a generated actor's palette onto the TARGET PLATE's own.

The sibling lane's palettepull.py matches a walk sheet to the idle it was made
from, which stops a cycle shimmering. That is not this problem. Here the sprite
is right and the PLATE is the authority: St Monica's already paints this bride,
in candlelight, and a sprite generated on magenta comes back lit like a studio.
Stood side by side on the twin proof it reads as a cut-out pasted on, and no
amount of prose in the prompt fixes a global exposure difference.

So the reference is the plate's OWN painted figures. The church lane shipped
knot-patch.png -- the chancel with the three inpainted away -- and while it is
too blurred to drive a matte, it is a perfectly good BACKGROUND ESTIMATE: the
pixels where plate and patch disagree are the painted figures, and those pixels
are the colour statistics a replacement sprite has to land in.

Street and chase get NO pull. Neither plate paints a person, so there is no
ground truth to match, and matching an actor to a facade or a cobble would only
make him the colour of a wall. For those the tool measures and reports the
luminance band and key direction so the proof can be judged, and changes
nothing.

    python3 platepull.py ACTOR.rgba.png SET WHO OUT.png [--k 0.65]
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import actor_geom as G  # noqa: E402

BOOK = '/Users/samz/Documents/gaslight-remake/assets/plates/book'

# the box each painted figure lives in, read off church.jpg with a coord grid
CHURCH_FIGURE_BOX = {'irene': (695, 355, 787, 530), 'norton': (778, 368, 848, 516)}


def church_reference_pixels(who):
    """the plate's own painted figure, as a pixel list"""
    plate = np.asarray(Image.open(os.path.join(BOOK, G.CHURCH['plate']))
                       .convert('RGB')).astype(np.float32)
    kp = G.CHURCH['knotPatch']
    patch = np.asarray(Image.open(os.path.join(BOOK, kp['file']))
                       .convert('RGB')).astype(np.float32)
    est = plate.copy()
    est[kp['y']:kp['y'] + patch.shape[0], kp['x']:kp['x'] + patch.shape[1]] = patch

    x0, y0, x1, y1 = CHURCH_FIGURE_BOX[who]
    sub = plate[y0:y1, x0:x1]
    sub_est = est[y0:y1, x0:x1]
    # figure = where the plate and the "figures removed" estimate disagree. The
    # patch is blurred, so this mask is soft-edged; a high threshold keeps only
    # pixels that are unambiguously the figure and not patch blur.
    d = np.sqrt(((sub - sub_est) ** 2).sum(axis=2))
    m = d > 40
    if m.sum() < 200:
        m = d > 25
    return sub[m], float(m.mean())


def stats(px):
    return px.mean(0), px.std(0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('actor')
    ap.add_argument('set')
    ap.add_argument('who')
    ap.add_argument('out')
    ap.add_argument('--k', type=float, default=0.65)
    ap.add_argument('--frames', type=int, default=1,
                    help='>1 treats the input as an N-cell strip and pulls each '
                         'cell separately, the way a walk sheet needs')
    ap.add_argument('--mode', choices=('full', 'lum'), default='full',
                    help="full = match R, G and B independently. Use only when "
                         "the plate paints the figure from the SAME SIDE the "
                         "sprite faces. lum = match exposure only, one affine "
                         "on all three channels, leaving hue alone -- the "
                         "honest choice when the painted reference is a BACK "
                         "view (St Monica's groom) and its chroma is the "
                         "colour of a shadowed back, not of the coat.")
    a = ap.parse_args()

    im = Image.open(a.actor).convert('RGBA')
    arr = np.asarray(im, np.float32).copy()

    report = {'actor': os.path.abspath(a.actor), 'set': a.set, 'who': a.who,
              'k': a.k, 'frames': a.frames}

    if a.set != 'church':
        m = arr[..., 3] > 128
        fig = arr[..., :3][m]
        lum = fig.mean(1)
        plate = np.asarray(Image.open(os.path.join(BOOK, getattr(G, a.set.upper())['plate']))
                           .convert('RGB')).astype(np.float32)
        plum = plate.mean(2)
        report['pull'] = 'NONE -- this plate paints no figure, so it has no ' \
                         'ground truth for an actor palette'
        report['actor_lum'] = {'p5': round(float(np.percentile(lum, 5)), 1),
                               'mean': round(float(lum.mean()), 1),
                               'p95': round(float(np.percentile(lum, 95)), 1)}
        report['plate_lum'] = {'p5': round(float(np.percentile(plum, 5)), 1),
                               'mean': round(float(plum.mean()), 1),
                               'p95': round(float(np.percentile(plum, 95)), 1)}
        report['actor_inside_plate_band'] = bool(
            lum.mean() >= np.percentile(plum, 5) and lum.mean() <= np.percentile(plum, 95))
        im.save(a.out)
        report['out'] = os.path.abspath(a.out)
        print(json.dumps(report, indent=1))
        return

    ref, cover = church_reference_pixels(a.who)
    ref_mu, ref_sd = stats(ref)
    report['reference'] = {
        'source': 'church.jpg painted figure vs knot-patch background estimate',
        'box': CHURCH_FIGURE_BOX[a.who], 'coverage_frac': round(cover, 3),
        'mu': [round(float(v), 1) for v in ref_mu],
        'sd': [round(float(v), 1) for v in ref_sd]}

    n = a.frames
    cw = im.width // n
    before, after = [], []
    for i in range(n):
        sl = slice(i * cw, (i + 1) * cw)
        cell = arr[:, sl]
        m = cell[..., 3] > 128
        if m.sum() < 50:
            continue
        px = cell[..., :3][m]
        mu, sd = stats(px)
        before.append([round(float(v), 1) for v in (mu - ref_mu)])
        if a.mode == 'lum':
            # one affine on all three channels: exposure moves, hue does not.
            lm, ls = float(px.mean()), float(px.std())
            rlm, rls = float(ref.mean()), float(ref.std())
            g = rls / max(ls, 1e-3)
            for c in range(3):
                corr = (cell[..., c] - lm) * g + rlm
                cell[..., c] = cell[..., c] * (1 - a.k) + corr * a.k
        else:
            for c in range(3):
                corr = (cell[..., c] - mu[c]) * (ref_sd[c] / max(sd[c], 1e-3)) + ref_mu[c]
                cell[..., c] = cell[..., c] * (1 - a.k) + corr * a.k
        arr[:, sl] = cell
        px2 = np.clip(cell, 0, 255)[..., :3][m]
        after.append([round(float(v), 1) for v in (px2.mean(0) - ref_mu)])

    # THE SPILL CEILING IS ENFORCED LAST, NOT FIRST. Matching per-channel std
    # applies a different gain to R, G and B, and here G is stretched hardest
    # (the plate's painted bride has more green spread than the sprite did). On
    # pixels BELOW the mean that pushes G down further than R and B, which
    # manufactures magenta excess in exactly the shadows the matte had just
    # cleaned -- measured, it took the rim from 19.5 back up to 54. A grade
    # that runs after the key has to restore the key's invariant.
    from matte_actors import clamp_spill_proportional
    ceiling = 20.0
    graded = clamp_spill_proportional(np.clip(arr[..., :3], 0, 255), ceiling)
    arr[..., :3] = graded
    out = np.clip(arr, 0, 255).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(a.out)
    ex = (out[..., 0].astype(np.float32) + out[..., 2]) * 0.5 - out[..., 1]
    vis = out[..., 3] > 20
    report.update({'residual_before_per_frame': before,
                   'residual_after_per_frame': after,
                   'spill_ceiling_reapplied': ceiling,
                   'magenta_excess_max_after': round(float(ex[vis].max()), 1),
                   'out': os.path.abspath(a.out)})
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
