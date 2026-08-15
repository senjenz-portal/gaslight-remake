#!/usr/bin/env python3
"""holmescameo.py — F11: the reader's FIRST Holmes has to be the stage Holmes.

The cameo card raised on unit 1 ("SHERLOCK HOLMES") is a gaunt man in a green
jacket and it matches nobody in the book — the audit's cameo-vs-stage mismatch,
the review's F11. The canonical Holmes for Beat I is the ROOM figure: the
lane's purple dressing gown over a white collar, dark hair, pipe in hand,
measured off the shipped parts —

    holmes-skirt.png  mean rgb (73, 37, 76)   hue 295 deg  sat 0.52
    holmes-torso.png  mean rgb (86, 47, 84)   hue 302 deg  sat 0.45

CANONICAL-SHEET LAW. The generator is never asked to invent a Holmes. Its input
is a two-panel sheet built from the shipped bytes:

    panel A   the room Holmes, composited from his own five actor cuts at their
              own plate boxes — the costume, the palette and the build
    panel B   the shipped cameo card — the exact format, framing, background and
              faceted style every other cameo in the book uses

and the instruction is "panel B's card, panel A's man".

Gates, all measured INSIDE THE CIRCLE the card is drawn as (margin.js draws the
cameo round, object-fit: cover, so the inscribed centre circle is the whole of
what the reader ever sees). The shipped card's own numbers are in brackets:
    gown       >= 4.0% of the circle in the purple band, hue 280-325   [0.00%]
    hue        the gown band's mean hue within 15 deg of the stage's 298 [none]
    face       >= 2.0% skin-tone pixels — there is a real face on it     [0.00%]
    no green   green-leading pixels <= 0.5%                            [15.23%]
    one sitter exactly one column-cluster of skin (a candidate came back
               as a three-up contact sheet of three portraits)

Usage:  python3 tools/living/holmescameo.py [--cands 3] [--install]
"""
import argparse
import colorsys
import hashlib
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSETS = os.path.join(ROOT, 'site-deploy', 'living', 'assets')
RAW = os.path.join(ROOT, 'assets', 'raw', 'holmescameo')
NBPRO = os.path.join(ROOT, 'tools', 'nbpro_edit.py')

TARGET = 'cameo/holmes.jpg'
# the room Holmes' own parts, at their own plate boxes (sets/room.js HOLMES.parts)
PARTS = [('legs', (572, 469, 63, 54)), ('skirt', (578, 395, 56, 86)),
         ('torso', (558, 297, 89, 110)), ('pipe', (558, 325, 43, 81)),
         ('head', (577, 293, 43, 61))]
FIG = (548, 283, 657, 533)          # his bounding crop on the plate
GOWN_HUE = 298.0
CARD = (1408, 768)

PROMPT = (
    'The image you are given is a two-panel REFERENCE SHEET, not a picture to '
    'edit.\n\n'
    'PANEL A (left) is the canonical character: Sherlock Holmes as he is built '
    'and dressed in this book — a slim man in a long PURPLE-MAGENTA dressing '
    'gown with a soft belt at the waist, a white shirt collar at the throat, '
    'dark blue-grey trousers, dark hair, holding a pipe. He is shown from behind '
    'in panel A, so his face is not visible there; you are to invent nothing '
    'about his clothes, his colour or his build, only to turn him to face the '
    'viewer.\n\n'
    'PANEL B (right) is the CARD FORMAT: a low-poly faceted bust portrait, head '
    'and shoulders only, centred, on a plain dark navy faceted backdrop, in a '
    'wide landscape frame, painted in flat angular facets with a warm key light '
    'from the left and a cool rim from the right.\n\n'
    'PRODUCE ONE IMAGE: panel B\'s card, with panel A\'s man. A head-and-'
    'shoulders bust portrait of the man from panel A, turned three-quarters '
    'toward the viewer so his face is fully visible — a lean, sharp-featured, '
    'clean-shaven English gentleman in his late thirties with dark hair and '
    'keen eyes — wearing THE SAME purple-magenta dressing gown and white collar '
    'as panel A, in exactly panel B\'s low-poly faceted style, at exactly panel '
    'B\'s framing and scale, on exactly panel B\'s dark navy faceted backdrop, '
    'in the same wide landscape aspect.\n\n'
    'The gown must be the purple-magenta of panel A. No green, no olive, no '
    'brown coat. No hat, no cap, no deerstalker, no pipe in the frame, no text, '
    'no border, no watermark, no second figure. Output only the finished card.'
)


def room_holmes():
    """Panel A: the canonical figure, composited from the shipped cuts."""
    canvas = Image.new('RGBA', (1408, 768), (0, 0, 0, 0))
    for name, (x, y, w, h) in PARTS:
        im = Image.open(os.path.join(ASSETS, 'actor', 'holmes-%s.png' % name))
        canvas.alpha_composite(im.convert('RGBA').resize((w, h)), (x, y))
    fig = canvas.crop(FIG)
    bg = Image.new('RGBA', fig.size, (12, 18, 38, 255))
    bg.alpha_composite(fig)
    return bg.convert('RGB')


def sheet():
    a = room_holmes()
    b = Image.open(os.path.join(ASSETS, TARGET)).convert('RGB')
    H = 1000
    aw = int(a.width * H / a.height)
    a = a.resize((aw, H), Image.LANCZOS)
    bw = int(b.width * H / b.height)
    b = b.resize((bw, H), Image.LANCZOS)
    out = Image.new('RGB', (aw + bw + 24, H + 40), (8, 10, 20))
    out.paste(a, (0, 40))
    out.paste(b, (aw + 24, 40))
    d = ImageDraw.Draw(out)
    d.text((6, 12), 'PANEL A - canonical Holmes (costume, palette, build)',
           fill=(255, 240, 190))
    d.text((aw + 30, 12), 'PANEL B - the card format', fill=(255, 240, 190))
    return out


def hsv_of(arr):
    a = arr.astype(float) / 255.0
    mx = a.max(axis=2)
    mn = a.min(axis=2)
    d = mx - mn
    h = np.zeros_like(mx)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    with np.errstate(invalid='ignore', divide='ignore'):
        h = np.where(mx == r, ((g - b) / np.maximum(d, 1e-6)) % 6,
            np.where(mx == g, (b - r) / np.maximum(d, 1e-6) + 2,
                     (r - g) / np.maximum(d, 1e-6) + 4)) * 60.0
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    return h, s, mx


def measure(im):
    """MEASURED AT THE CARD'S OWN LENS — the circle.

    margin.js draws the cameo as a round element with object-fit: cover, so what
    the reader ever sees of a 1408x768 card is the inscribed centre circle. A
    percentage over the whole file is not a percentage of the picture; every
    number below is inside that circle.

    On the shipped card the four numbers are gown 0.00, hue none, skin 0.00,
    green 15.23 — no purple, no skin at all, and a green jacket. That is F11
    stated arithmetically: the reader's first Holmes is a different species from
    the man on the stage.
    """
    a = np.asarray(im.convert('RGB')).astype(int)
    H, W, _ = a.shape
    yy, xx = np.mgrid[0:H, 0:W]
    r = H / 2.0
    circle = ((yy - H / 2.0) ** 2 + (xx - W / 2.0) ** 2) <= r * r
    h, s, v = hsv_of(a)
    gown = (h >= 280) & (h <= 325) & (s >= 0.22) & (v >= 0.10) & circle
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    green = (G > R + 5) & (G > B + 5) & (R + G + B > 90) & circle
    skin = (R > G + 15) & (np.abs(G - B) < 16) & (R >= 110) & (R <= 235) & circle
    n = int(circle.sum())
    # ONE SITTER. One candidate came back as a three-up contact sheet of three
    # portraits, which scores beautifully on every colour test there is.
    colhit = skin.sum(axis=0) > max(3, 0.002 * H)
    runs, run = 0, 0
    gap = 0
    for c in colhit:
        if c:
            if run == 0 and gap > 40:
                runs += 1
            elif run == 0 and runs == 0:
                runs = 1
            run += 1
            gap = 0
        else:
            run = 0
            gap += 1
    return {
        'gownPct': round(100.0 * gown.sum() / n, 2),
        'gownHue': round(float(h[gown].mean()), 1) if gown.any() else None,
        'greenPct': round(100.0 * green.sum() / n, 2),
        'skinPct': round(100.0 * skin.sum() / n, 2),
        'faces': runs, 'size': list(im.size),
    }


def gate(m):
    return (m['gownPct'] >= 4.0 and m['gownHue'] is not None
            and abs(m['gownHue'] - GOWN_HUE) <= 15
            and m['skinPct'] >= 2.0 and m['greenPct'] <= 0.5
            and m['faces'] == 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cands', type=int, default=1)
    ap.add_argument('--pick', type=int, default=None,
                    help='re-gate and install an existing candidate instead of generating')
    ap.add_argument('--install', action='store_true')
    a = ap.parse_args()
    os.makedirs(RAW, exist_ok=True)
    orig = os.path.join(RAW, 'holmes-cameo-orig.jpg')
    if not os.path.exists(orig):
        Image.open(os.path.join(ASSETS, TARGET)).save(orig, quality=95)
    print('shipped card: ' + json.dumps(measure(Image.open(orig))))

    sh = sheet()
    inp = os.path.join(RAW, 'sheet.png')
    sh.save(inp)

    best = None
    if a.pick is not None:
        f = os.path.join(RAW, 'cand%d-card.jpg' % a.pick)
        m = measure(Image.open(f))
        m['cand'] = a.pick; m['file'] = f
        m['gate'] = 'PASS' if gate(m) else 'FAIL'
        print('   picked %d %s %s' % (a.pick, m['gate'], json.dumps(m)))
        best = m if m['gate'] == 'PASS' else None
    for i in range(0 if a.pick is not None else a.cands):
        raw = os.path.join(RAW, 'cand%d-raw.png' % i)
        r = subprocess.run([sys.executable, NBPRO, '--image', inp, '--prompt', PROMPT,
                            '--out', raw, '--manifest', os.path.join(RAW, 'manifest.json')],
                           capture_output=True, text=True, timeout=600)
        print('   nbpro_edit rc=%d %s' % (r.returncode, (r.stdout or '').strip()[:160]))
        if r.returncode != 0 or not os.path.exists(raw):
            continue
        im = Image.open(raw).convert('RGB')
        card = im.resize(CARD, Image.LANCZOS)
        dst = os.path.join(RAW, 'cand%d-card.jpg' % i)
        card.save(dst, quality=94)
        m = measure(card)
        m['cand'] = i
        m['gate'] = 'PASS' if gate(m) else 'FAIL'
        m['file'] = dst
        print('   candidate %d %s %s' % (i, m['gate'], json.dumps(m)))
        if m['gate'] == 'PASS' and (best is None or m['gownPct'] > best['gownPct']):
            best = m
    if not best:
        print('NO CANDIDATE PASSED')
        return
    if a.install:
        Image.open(best['file']).save(os.path.join(ASSETS, TARGET), quality=94)
        print('installed ' + TARGET + '  sha ' +
              hashlib.sha256(open(os.path.join(ASSETS, TARGET), 'rb').read()).hexdigest()[:16])
    with open(os.path.join(RAW, 'report.json'), 'w') as f:
        json.dump(best, f, indent=1)


if __name__ == '__main__':
    main()
