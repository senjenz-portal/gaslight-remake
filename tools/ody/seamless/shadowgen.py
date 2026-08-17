#!/usr/bin/env python3
"""
shadowgen.py — deterministic contact-shadow generator for the odyssey actor
cuts, ported from the sherlock chase set's rig-shadow law (living/app/sets/
chase.js paintRigs):

    the shadow is the FEET'S own span, not a fixed disc     (chase.js ~467)
        sw = footSpan * 1.55        (width  = 1.55x the measured foot band)
        sh = sw * 0.42              (height = the 0.42 floor-ellipse aspect)
    opacity by depth                                          (chase.js ~472)
        runtime opacity = 0.42 + 0.30 * s   (s = the mark's rail/floor scale)
        — the PNG carries the SHAPE at peak alpha 0.62; the set applies the
        depth law, exactly as chase.js does for the rigs.

What is generated, per actor cut:
  1. the FOOT BAND is read off the cut's own alpha: the rows within
     BAND = max(6, 5% of content height) px above the measured baseline
     (tools/ody/actors.json `baseline`). Column alpha coverage in that band
     is the cut's ground-contact profile — two planted feet come out as two
     lobes, a sprawl comes out long, a walking cut comes out asymmetric.
  2. the profile is PROJECTED into a soft floor ellipse: per-column intensity
     follows the (box-smoothed) foot profile, vertical falloff is a gaussian
     with the 0.42 aspect, ends feather on the same gaussian.
  3. LIGHT-AWARE SKEW: the set's dominant EMIS anchor (layers-<set>.json,
     strongest a*r in the canonical state) casts the skew. The ellipse is
     sheared AWAY from the light — shear = 0.55 * dx/|d|, centroid pushed
     0.22*sh along the same direction — using the actor's default settle
     mark (DEFAULT_AT, ledger marks verbatim; override with --at X,Y).

Everything is a pure function of (cut alpha, actors.json, layers json, mark)
— no randomness, no wall clock: same inputs, same PNG, byte for byte.

usage:
  python3 shadowgen.py                     # cave lane, every cut in actors.json
  python3 shadowgen.py --set shore ulysses-stand crew-a-stand
  python3 shadowgen.py --set cave --at 760,452 polyphemus-seated
  --out DIR   (default: <this dir>/shadows/<set>/)

output: <actor>-shadow.png (RGBA, black shape) + shadowmap.json with the
placement contract per actor:
  { file, size:[w,h], anchor:[ax,ay], footSpanPx, skew, light, opacityLaw }
anchor is the point INSIDE the shadow png that lands on the actor's PIN
(the measured foot on the baseline) — scale the shadow with the actor's own
k (drawnH / cutH) and the ellipse stays the feet's span at any depth.
"""
import argparse, json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ODY = os.path.dirname(HERE)                                  # tools/ody
ROOT = os.path.dirname(os.path.dirname(ODY))                 # repo root
ASSETS = os.path.join(ROOT, 'site-deploy', 'living-odyssey')

# ---- the sherlock law's constants, named -------------------------------
WIDTH_K   = 1.55    # sw = footSpan * 1.55           (chase.js line ~470)
ASPECT    = 0.42    # sh = sw * 0.42                 (chase.js line ~471)
PEAK_A    = 0.62    # PNG peak alpha; depth opacity is the set's at runtime
SHEAR_K   = 0.55    # max horizontal shear per unit of light dx/|d|
PUSH_K    = 0.22    # centroid push along the light dir, in sh units
PROFILE_FLOOR = 0.12  # columns under 12% of peak coverage are not feet

# ---- the sets' light (layers-<set>.json emissives, canonical state) ----
LANES = {'cave': 'layers-cave.json', 'shore': 'layers-shore.json',
         'sea': 'layers-sea.json'}
# canonical lit anchors per lane: cave judges by the SHUT state (the blaze),
# shore by night (fire lit), sea by night (the moon owns the floor).
CANON_LIT = {
    'cave':  {'fire', 'embers', 'lampL', 'lampR'},
    'shore': {'fire'},
    'sea':   {'moon', 'moonpath'},
}

# the default settle mark per cut — the ledger marks, verbatim from the
# sets' MARKS/U_AT tables. Only the LIGHT DIRECTION reads these; --at wins.
DEFAULT_AT = {
    'cave': {
        'ulysses-stand': (690, 495), 'ulysses-offer': (700, 468),
        'ulysses-sword': (768, 462), 'ulysses-walk': (640, 480),
        'ulysses-drive': (624, 549), 'ulysses-slung': (500, 470),
        'polyphemus-stand': (500, 450), 'polyphemus-seated': (760, 452),
        'polyphemus-clutch': (760, 452), 'polyphemus-drink': (760, 452),
        'polyphemus-stroke': (345, 420), 'polyphemus-sprawl': (664, 546),
        'polyphemus-blinded-grope': (345, 420), 'polyphemus-curse': (345, 420),
        'polyphemus-hurl': (345, 420),
        'crew-a-stand': (676, 524), 'crew-b-stand': (702, 538),
        'crew-carry': (570, 505), 'crew-plead': (690, 495),
        'crew-slung': (450, 460), 'crew-row': (450, 460),
        'ram-great': (838, 430), 'ram-walk': (600, 470),
        'ram-great-slung': (838, 430), 'ram-pair-slung': (600, 470),
        'prop-bowl': (700, 441), 'prop-wineskin': (700, 468),
        'prop-sword': (768, 445), 'prop-stake': (790, 500),
        'prop-stake-glowing': (662, 456), 'prop-rock': (600, 500),
        'prop-splash': (600, 500),
    },
    'shore': {
        'ulysses-stand': (390, 480), 'ulysses-walk': (510, 492),
        'crew-a-stand': (445, 507), 'crew-b-stand': (445, 507),
        'crew-carry': (560, 503), 'ulysses-offer': (560, 503),
    },
    'sea': {
        'ulysses-stand': (518, 426), 'ulysses-taunt': (518, 426),
        'crew-row': (586, 455),
        'polyphemus-stand': (860, 210), 'polyphemus-hurl': (860, 210),
        'polyphemus-curse': (860, 210),
    },
}


def emis_of(lane):
    """the lane's emissives, normalized to [{id, at, r, a}] regardless of shape."""
    p = os.path.join(ODY, LANES[lane])
    d = json.load(open(p))
    out = []
    for e in d.get('emissives', []) or []:
        out.append({'id': e['id'], 'at': e['at'], 'r': e.get('r', 60),
                    'a': e.get('a', 0.1)})
    # the sea lane keeps its emis in the set file, not the layer json — the
    # measured values are transcribed here (sets/sea.js EMIS, verbatim)
    if lane == 'sea' and not out:
        out = [{'id': 'moon', 'at': [474, 242], 'r': 143, 'a': 0.10},
               {'id': 'moonpath', 'at': [475, 356], 'r': 74, 'a': 0.09},
               {'id': 'cave', 'at': [818, 457], 'r': 60, 'a': 0.20},
               {'id': 'crag', 'at': [820, 339], 'r': 90, 'a': 0.10}]
    return out


def dominant_light(lane):
    """the strongest canonical-lit anchor by a*r — the floor's key light."""
    lit = [e for e in emis_of(lane) if e['id'] in CANON_LIT[lane]]
    if not lit:
        lit = emis_of(lane)
    e = max(lit, key=lambda e: e['a'] * e['r'])
    return e['id'], (float(e['at'][0]), float(e['at'][1]))


def foot_profile(alpha, baseline):
    """column ground-contact coverage in the foot band; returns (x0, x1, prof)
    where prof is the smoothed per-column coverage over [x0, x1)."""
    h, w = alpha.shape
    band = max(6, round(0.05 * baseline))
    y0, y1 = max(0, baseline - band), min(h, baseline + 1)
    cov = alpha[y0:y1, :].astype(np.float32).sum(axis=0)
    if cov.max() <= 0:                       # no alpha at the baseline: use
        cov = alpha.astype(np.float32).sum(axis=0)   # the whole silhouette
    # box-smooth over ~2% of width so single-pixel fringes don't read as feet
    k = max(3, (round(0.02 * w) | 1))
    kern = np.ones(k, np.float32) / k
    cov = np.convolve(cov, kern, mode='same')
    m = cov.max()
    keep = np.where(cov >= PROFILE_FLOOR * m)[0]
    x0, x1 = int(keep[0]), int(keep[-1]) + 1
    prof = cov[x0:x1] / m
    # a second, wider soften over the kept span (~18%) so the lobes pool
    # instead of striping when the ellipse is sheared
    k2 = max(3, (round(0.18 * (x1 - x0)) | 1))
    prof = np.convolve(prof, np.ones(k2, np.float32) / k2, mode='same')
    prof /= max(prof.max(), 1e-6)
    return x0, x1, prof


def render(prof, span, shear, push_sign):
    """the soft floor ellipse: per-column intensity from the foot profile,
    gaussian vertical falloff at the 0.42 aspect, sheared away from light."""
    sw = max(8, round(span * WIDTH_K))
    sh = max(4, round(sw * ASPECT))
    pad = int(abs(shear) * sh) + max(2, sh // 3)
    W, H = sw + 2 * pad, sh + 4
    xs = (np.arange(W, dtype=np.float32) - W / 2)
    ys = (np.arange(H, dtype=np.float32) - H / 2)
    Y = ys[:, None]                                   # (H,1)
    push = push_sign * PUSH_K * sh
    # shear: a row at depth y samples the profile shifted by shear*y + push
    Xs = xs[None, :] - shear * Y - push               # (H,W) sample coords
    # resample the foot profile to the ellipse width, centre-aligned
    px = (Xs + sw / 2) * (len(prof) / sw)
    p0 = np.clip(px, 0, len(prof) - 1)
    prof_pad = prof.astype(np.float32)
    horiz = prof_pad[np.round(p0).astype(int)]
    horiz[(px < -0.06 * len(prof)) | (px > 1.06 * len(prof))] = 0.0
    # soften: the ellipse's own gaussian envelope over the raw profile,
    # so the shadow is a soft pool, not a bar chart of the boot pixels
    ex = np.exp(-0.5 * (Xs / (0.46 * sw)) ** 2)
    ey = np.exp(-0.5 * (Y / (0.38 * sh)) ** 2)
    a = (0.35 * ex + 0.65 * horiz) * ey * ex ** 0.25
    a = np.clip(a / max(a.max(), 1e-6), 0, 1) ** 1.15 * PEAK_A
    img = np.zeros((H, W, 4), np.uint8)
    img[..., 3] = np.round(a * 255).astype(np.uint8)
    return Image.fromarray(img, 'RGBA'), (W / 2, H / 2), sw, sh


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--set', dest='lane', default='cave', choices=list(LANES))
    ap.add_argument('--at', default=None, help='X,Y settle mark override')
    ap.add_argument('--out', default=None)
    ap.add_argument('--assets', default=ASSETS)
    ap.add_argument('actors', nargs='*')
    args = ap.parse_args()

    lane = args.lane
    reg = json.load(open(os.path.join(ODY, 'actors.json')))
    names = args.actors or [n for n in sorted(reg) if n in DEFAULT_AT[lane]] \
        or sorted(reg)
    out_dir = args.out or os.path.join(HERE, 'shadows', lane)
    os.makedirs(out_dir, exist_ok=True)

    light_id, L = dominant_light(lane)
    shadowmap, made = {}, 0
    for name in names:
        if name not in reg:
            print(f'  !! {name}: not in actors.json, skipped', file=sys.stderr)
            continue
        A = reg[name]
        path = os.path.join(args.assets, A['file'])
        im = Image.open(path).convert('RGBA')
        alpha = np.asarray(im)[..., 3]
        baseline = int(A['baseline'])
        x0, x1, prof = foot_profile(alpha, baseline)

        at = tuple(float(v) for v in args.at.split(',')) if args.at \
            else DEFAULT_AT[lane].get(name, (im.width / 2, baseline))
        dx, dy = at[0] - L[0], at[1] - L[1]
        d = math.hypot(dx, dy) or 1.0
        shear = SHEAR_K * (dx / d)
        push_sign = 1.0 if dx >= 0 else -1.0

        img, (cx, cy), sw, sh = render(prof, x1 - x0, shear, push_sign)
        out = os.path.join(out_dir, f'{name}-shadow.png')
        img.save(out)
        # anchor: where the actor PIN lands inside the png — the pin's own
        # offset from the FOOT CENTRE, carried through the shadow's scale
        foot_cx = (x0 + x1) / 2
        pin_off = (A['pin'][0] - foot_cx) * (sw / max(1, x1 - x0))
        shadowmap[name] = {
            'file': f'{name}-shadow.png', 'size': [img.width, img.height],
            'anchor': [round(cx + pin_off, 1), round(cy, 1)],
            'footSpanPx': x1 - x0, 'ellipse': [sw, sh],
            'skew': round(shear, 3), 'at': list(at),
            'light': {'id': light_id, 'at': list(L)},
            'opacityLaw': '0.42 + 0.30 * s   (chase.js paintRigs, verbatim)',
            'scaleLaw': 'scale by the actor\'s own k = drawnH / cutH',
        }
        made += 1
        print(f'  {name}: foot [{x0},{x1}] span {x1-x0} -> {img.width}x'
              f'{img.height} skew {shear:+.2f} ({light_id})')

    with open(os.path.join(out_dir, 'shadowmap.json'), 'w') as f:
        json.dump({'lane': lane, 'law': {'widthK': WIDTH_K, 'aspect': ASPECT,
                   'peakAlpha': PEAK_A}, 'shadows': shadowmap}, f, indent=1)
    print(f'{made} shadows -> {out_dir}')


if __name__ == '__main__':
    main()
