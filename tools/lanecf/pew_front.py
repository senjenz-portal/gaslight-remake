#!/usr/bin/env python3
"""pew_front.py -- cut the pew block + chancel rail off the church plate as a
FOREGROUND layer, and derive the chancel marks from that same edge (F5).

THE THING THE REVIEW SAW. With the mannequins lifted off the plate the four
participants are cut-outs standing on a floor line, and the shipped line put
their boots at y 502..512 across x 700..886. That band is NOT floor: it is the
top edge of the near pew backs, so the review correctly reported figures
standing on pew tops.

THE PLATE ALREADY ANSWERED THIS. Its own painted three were cut off exactly
where a pew rail crossed them: measure the pre-patch plate against the patched
one (the difference IS the painted figures) and every column's last figure pixel
lands on the top edge of the nearest pew rail, +-2 px:

    x    700  710  720  740  750  760  790  810  860  870
    rail 508  511  514  520  523  485  497  503  518  516
    fig  507  510  518  520  523  487  496  502  518  518

So this tool does two things off ONE measured contour T(x), the top edge of the
nearest foreground structure in each column:

  1. writes `pews-front.png` -- the plate's own pixels for y >= T(x), a
     FOREGROUND cut that occludes anything standing on the chancel from T(x)
     down, exactly as the painting occluded its own figures. Two variants are
     written, one per plate variant the set crossfades (church.jpg,
     church-ring.jpg), so the occluder is never a different painting than the
     plate under it.
  2. reports T(x) at every mark the set stands somebody on, and the foot y that
     puts that actor's hem ON the rail: footY = T(x) + HEM.

T(x) is found by scanning each column for the first bright warm rail pixel that
has a dark run under it, then median-smoothing across columns to kill the
candle/altar false hits, then VALIDATED against the painted figures' own bottom
contour where the painting had a figure. The validation residual is in the
manifest and is the number that says this contour is the plate's own.

    python3 pew_front.py --raw /abs/rawdir [--dry]
"""
import argparse
import hashlib
import json
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = '/Users/samz/Documents/gaslight-remake'
LIVE = os.path.join(ROOT, 'site-deploy/living/assets/set/church')

X0, X1 = 505, 945          # the columns any church actor can occupy
Y_SCAN = (440, 700)        # where a foreground rail can be
Y_BOT = 700                # the layer's own bottom: below this is diorama void
HEM = 8                    # px of hem/boot the rail is allowed to eat
SMOOTH = 9                 # median window, in columns

# every mark sets/church.js stands somebody on, x only
MARK_X = {'back': 478, 'lounged': 508, 'nortonMet': 520, 'altar': 700,
          'bride': 728, 'nortonDrag': 770, 'nortonHome': 790.5, 'clergyman': 886}


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for blk in iter(lambda: fh.read(1 << 20), b''):
            h.update(blk)
    return h.hexdigest()


def rail_top(rgb, V, S, x):
    """first bright warm rail pixel in the column that has pew under it"""
    R, G, B = rgb[:, x, 0], rgb[:, x, 1], rgb[:, x, 2]
    for y in range(Y_SCAN[0], Y_SCAN[1]):
        if R[y] > 150 and (R[y] - B[y]) > 60:
            below = V[y + 3:y + 20, x]
            if below.size and (below < 90).mean() > 0.6:
                return y
    return None


def painted_bottom():
    """the columns where the plate PAINTED a figure, and where that figure's
    silhouette ended. This is the only trustworthy statement of what is in FRONT
    of a body standing at the altar: the emptied plate cannot say, because what
    the patch revealed behind a figure (the chancel rail, the altar step) is
    exactly the thing a rail-detector then mistakes for foreground — that read
    put the occluder's edge at y 453 across the clergyman's waist."""
    pre = np.asarray(Image.open(os.path.join(
        ROOT, 'assets/raw/book-cf/20260813T1100Z/pre/church.jpg')).convert('RGB')).astype(int)
    post = np.asarray(Image.open(os.path.join(LIVE, 'church.jpg')).convert('RGB')).astype(int)
    dif = np.abs(pre - post).max(axis=2) > 18
    fig = {}
    for x in range(X0, X1):
        col = np.nonzero(dif[:, x])[0]
        # a HEM is a solid column of figure; an arm reaching over the altar is not
        if len(col) >= 60:
            fb = int(col.max())
            if 440 < fb < 600:
                fig[x] = fb
    return fig


def contour(plate):
    rgb = np.asarray(plate.convert('RGB')).astype(int)
    hsv = np.asarray(plate.convert('HSV')).astype(int)
    V, S = hsv[..., 2], hsv[..., 1]
    raw = {}
    for x in range(X0, X1):
        raw[x] = rail_top(rgb, V, S, x)
    fig = painted_bottom()
    # WHERE THE PAINTING SPOKE, IT WINS. Its own figures' hems are the measured
    # front edge; the rail detector fills the columns no figure stood in.
    merged = {}
    for x in range(X0, X1):
        merged[x] = fig.get(x, raw[x])
    xs = sorted(merged)
    known = [x for x in xs if merged[x] is not None]
    for x in xs:
        if merged[x] is None:
            near = min(known, key=lambda k: abs(k - x))
            merged[x] = merged[near]
    T = {}
    for x in xs:
        win = [merged[k] for k in range(x - SMOOTH // 2, x + SMOOTH // 2 + 1) if k in merged]
        T[x] = int(round(float(np.median(win))))
    # a median over 9 columns keeps the pews' own vertical END steps (a pew end
    # is a real edge and the layer needs it) while killing the single-column
    # candle hits; nothing further is smoothed.
    return T, raw


"""the two the plate CUT, and the one it did not. The bride and the groom are
   both cut by a pew rail, so their painted bottom contour has to lie on T() to
   within a pixel or two — that residual is the proof the contour is the plate's
   own edge. The clergyman is NOT cut: he stands far enough back that his own
   cassock hem (y ~= 501) is clear of the rail below him (y ~= 516), and only
   his right side is cut, by the chancel BALUSTRADE. So he is measured
   separately and his mark is his own hem, not T+HEM."""
FIG_RUNS = {'bride': (704, 752), 'groom': (788, 824), 'clergyman': (852, 896)}


def validate(T):
    """the painted figures' own bottom contour, as the residual against T"""
    pre = np.asarray(Image.open(os.path.join(
        ROOT, 'assets/raw/book-cf/20260813T1100Z/pre/church.jpg')).convert('RGB')).astype(int)
    post = np.asarray(Image.open(os.path.join(LIVE, 'church.jpg')).convert('RGB')).astype(int)
    dif = np.abs(pre - post).max(axis=2) > 18
    out = {}
    for name, (a0, a1) in FIG_RUNS.items():
        res, hem = [], []
        for x in range(a0, a1):
            col = np.nonzero(dif[:, x])[0]
            if len(col) < 60:                     # arm-only columns are not a hem
                continue
            fb = int(col.max())
            if 440 < fb < 600:
                res.append(fb - T[x])
                hem.append(fb)
        a = np.array(res)
        out[name] = {'columns': len(res),
                     'painted_bottom_median': int(np.median(hem)) if hem else None,
                     'residual_vs_T_mean': round(float(a.mean()), 2) if len(a) else None,
                     'residual_vs_T_p90': round(float(np.percentile(np.abs(a), 90)), 2)
                                          if len(a) else None}
    return out


def cut(plate, T, out, dry):
    rgb = np.asarray(plate.convert('RGB')).astype(np.float64)
    alpha = np.zeros(rgb.shape[:2])
    for x, t in T.items():
        alpha[t:Y_BOT, x] = 255.0
    alpha = np.asarray(Image.fromarray(alpha.astype(np.uint8))
                       .filter(ImageFilter.GaussianBlur(0.6))).astype(np.float64)
    ys, xs = np.nonzero(alpha > 8)
    bx0, by0 = int(xs.min()), int(ys.min())
    bx1, by1 = int(xs.max()) + 1, int(ys.max()) + 1
    arr = np.dstack([rgb[by0:by1, bx0:bx1], alpha[by0:by1, bx0:bx1]])
    res = {'file': os.path.relpath(out, os.path.join(ROOT, 'site-deploy/living/assets')),
           'box': [bx0, by0, bx1 - bx0, by1 - by0],
           'alpha_px': int((alpha > 127).sum())}
    if not dry:
        Image.fromarray(arr.round().astype(np.uint8), 'RGBA').save(out)
        res['sha256'] = sha256(out)
        res['bytes'] = os.path.getsize(out)
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', required=True)
    ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()

    base = Image.open(os.path.join(LIVE, 'church.jpg'))
    T, raw = contour(base)
    man = {'tool': 'tools/lanecf/pew_front.py', 'xRange': [X0, X1],
           'yScan': list(Y_SCAN), 'yBottom': Y_BOT, 'hem': HEM, 'smooth': SMOOTH,
           'validation_vs_painted_figures': validate(T),
           'contour': {str(x): T[x] for x in range(X0, X1, 5)},
           'marks': {},
           'layers': []}
    for name, x in MARK_X.items():
        xi = int(round(x))
        t = T.get(xi)
        man['marks'][name] = {'x': x, 'T': t,
                              'footY': (t + HEM) if t is not None else None,
                              'inLayer': t is not None}
    for src, dst in [('church.jpg', 'pews-front.png'),
                     ('church-ring.jpg', 'pews-front-ring.png')]:
        man['layers'].append(cut(Image.open(os.path.join(LIVE, src)), T,
                                os.path.join(LIVE, dst), a.dry))
    json.dump(man, open(os.path.join(a.raw, 'pew_front.json'), 'w'), indent=1)
    print(json.dumps({'validation': man['validation_vs_painted_figures'],
                      'marks': man['marks'],
                      'layers': man['layers']}, indent=1))


if __name__ == '__main__':
    main()
