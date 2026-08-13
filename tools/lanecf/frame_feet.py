#!/usr/bin/env python3
"""frame_feet.py — the two measurements F4 and F5 were still missing a NUMBER for.

The church lane's round-2 work landed the hard part: the plate no longer paints
anybody (chancel_patch.py) and every mark is derived from the pews' own front
contour (pew_front.py). Both halves are asserted in tools/living/lap.mjs. But
two things the review actually complained about are still unmeasured:

  [F4] "the marriage is played in two art registers" was fixed by making all
       four participants cut-outs — and the lap's register test reads `cutout`
       off DOM OPACITY. An actor that is painted, on its mark, and entirely
       OUTSIDE THE LENS scores exactly the same as one the reader can see. So
       the ledger reads BCGW on a frame that shows two of the four.

  [F5] "floating actors" was fixed by moving the marks off the pew tops — and
       nothing checks that the DRAWN FEET land on the mark. The mark is where
       the set says the feet go; the feet are where the cut's own alpha ends.
       If a cut is regenerated with different bottom padding, every mark stays
       legal and the actor floats again.

This script is the offline half: it measures both off the shipped bitmaps and
the set's own numbers, so the lap's thresholds are chosen from data instead of
picked. It does not need a browser — geometry is placeSprite's, verbatim.

Usage: python3 tools/lanecf/frame_feet.py [--json OUT]
"""
import argparse
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SITE = os.path.join(ROOT, 'site-deploy', 'living')
A = os.path.join(SITE, 'assets')

PLATE_W, PLATE_H = 1408, 768
PX_PER_M = 104.5

# ---- the set's own numbers, mirrored from app/sets/church.js ---------------
FLOOR = [[449, 604], [522, 601], [700, 501], [791, 527.5], [980, 534]]
FEET = {'bride': (728.0, 524.0), 'groom': (790.5, 527.4), 'clergyman': (886.0, 509.0)}
MARK = {'back': 478, 'lounged': 508, 'altar': 700, 'nortonHome': 790.5,
        'nortonMet': 520, 'nortonDrag': 770}
FOCUS = {'nave': (704, 384, 1.00), 'aisle': (500, 500, 2.50), 'knot': (820, 420, 1.20)}
HANDS_LIFT = 110
HANDS = ((FEET['bride'][0] + FEET['groom'][0]) / 2.0,
         (FEET['bride'][1] + FEET['groom'][1]) / 2.0 - HANDS_LIFT)
FOCUS['ring'] = (HANDS[0], HANDS[1] - 4, 3.20)
FOCUS['coin'] = (734, 422, 3.20)

# cut -> (file, cell h, declared baseline, drawn height in metres)
ART = {
    'witness':      ('actor/holmes-church.png', 586, 583.1, 1.87),
    'witnessAltar': ('actor/holmes-church-altar.png', 586, 583.1, 1.87),
    'groom':        ('actor/norton-groom.png', 564, 561.1, 1.80),
    'groomBeck':    ('actor/norton-beckon.png', 564, 561.1, 1.80),
    'bride':        ('actor/irene-bride.png', 527, 524.0, 1.68),
    'clergyman':    ('actor/clergyman-altar.png', 549, 545.8, 1.75),
}
# the two walk strips, measured per cell
STRIP = {
    'witnessWalk': ('actor/holmes-church-walk.png', 298, 467, 461, 1.87),
    'groomRun':    ('actor/norton-run.png', 353, 508, 502, 1.80),
}

# WHERE EACH PARTICIPANT STANDS AT REST, per unit. The STAGING is this lane's
# own knowledge (it is what the set's `fire`/`startSeg` leave behind), but the
# LENS is not: reading `focus` off a table here is how a tool comes to certify a
# lens the book no longer uses, so it is parsed out of app/units.js instead and
# this script cannot disagree with the book about what the reader is shown.
STAGING = {
    'head4':         {'witness': ('witness', MARK['back']),
                      'groom': ('groom', MARK['nortonHome'])},
    'notasoul':      {'witness': ('witness', MARK['back']),
                      'groom': ('groom', MARK['nortonHome'])},
    'lounged':       {'witness': ('witness', MARK['lounged']),
                      'groom': ('groom', MARK['nortonHome'])},
    'facedround':    {'witness': ('witness', MARK['lounged']),
                      'groom': ('groomBeck', MARK['nortonMet'])},
    'comeman':       {'witness': ('witness', MARK['lounged']),
                      'groom': ('groomBeck', MARK['nortonMet'])},
    'halfdragged':   {'witness': ('witnessAltar', MARK['altar']),
                      'groom': ('groom', MARK['nortonHome'])},
    'tyingup':       {'witness': ('witnessAltar', MARK['altar']),
                      'groom': ('groom', MARK['nortonHome'])},
    'preposterous':  {'witness': ('witnessAltar', MARK['altar']),
                      'groom': ('groom', MARK['nortonHome'])},
    'license':       {'witness': ('witnessAltar', MARK['altar']),
                      'groom': ('groom', MARK['nortonHome'])},
    'sovereigngift': {'witness': ('witnessAltar', MARK['altar']),
                      'groom': ('groom', MARK['nortonHome'])},
    'unexpected':    {'witness': ('witnessAltar', MARK['altar']),
                      'groom': ('groom', MARK['nortonHome'])},
    'parkatfive':    {'witness': ('witnessAltar', MARK['altar']),
                      'groom': ('groom', MARK['nortonHome'])},
}


def units_focus():
    """the lens each church unit is composed at, read out of app/units.js."""
    import re
    src = open(os.path.join(SITE, 'app', 'units.js')).read()
    out = {}
    for m in re.finditer(r"\{\s*id:\s*'iv-[^']*',\s*key:\s*'([^']+)'", src):
        key = m.group(1)
        # the unit's own object literal: from its `id:` to the next one
        nxt = src.find("{ id: '", m.end())
        body = src[m.start():nxt if nxt > 0 else len(src)]
        f = re.search(r"focus:\s*'([a-z]+)'", body)
        if f:
            out[key] = f.group(1)
    return out


UNITS = {}
for _k, _v in STAGING.items():
    UNITS[_k] = dict(_v)
for _k, _f in units_focus().items():
    if _k in UNITS:
        UNITS[_k]['focus'] = _f
# WHEN IS THE READER LOOKING AT THE MARRIAGE? Not "when the lens is called
# knot": that test lets a wrong lens exempt itself, which is exactly how
# `halfdragged` kept the aisle lens through a fix round. The honest test is the
# STAGING — once the witness has been dragged to the altar mark, the frame is a
# frame of four people at an altar, and all four have to be in it whoever the
# lens is named after. Before that he is an idler up the side aisle and the
# aisle lens is right to hold him alone.
def on_marriage(unit):
    return unit['witness'][1] == MARK['altar']


def floor_at(x):
    if x <= FLOOR[0][0]:
        return FLOOR[0][1]
    for i in range(1, len(FLOOR)):
        a, b = FLOOR[i - 1], FLOOR[i]
        if x <= b[0]:
            return a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0])
    return FLOOR[-1][1]


def alpha_bottom(path, cell_w=None, cell_h=None):
    """the LAST row the cut actually paints — its real feet line, per cell."""
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    if cell_w is None:
        bb = im.split()[3].getbbox()
        return [bb[3] - 1], (w, h)
    out = []
    for f in range(w // cell_w):
        bb = im.crop((f * cell_w, 0, (f + 1) * cell_w, cell_h)).split()[3].getbbox()
        out.append(bb[3] - 1)
    return out, (w, h)


def drawn_box(art_key, x, y):
    """placeSprite, verbatim: the cut's plate-px box when its baseline is at y."""
    f, ch, base, hm = ART[art_key]
    im = Image.open(os.path.join(A, f))
    cw = im.size[0]
    h = hm * PX_PER_M
    k = h / ch
    w = cw * k
    foot = base * k
    return (x - w / 2, y - foot, w, ch * k), k


def frame_box(focus):
    cx, cy, k = FOCUS[focus]
    fw, fh = PLATE_W / k, PLATE_H / k
    x0, y0 = cx - fw / 2, cy - fh / 2
    # the camera cannot show what is not there: the rig clamps the frame inside
    # the plate, which is why a lens composed near an edge reads off-centre.
    x0 = min(max(x0, 0), max(0, PLATE_W - fw))
    y0 = min(max(y0, 0), max(0, PLATE_H - fh))
    return (x0, y0, fw, fh, k)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--json', default=os.path.join(HERE, 'frame_feet.json'))
    a = ap.parse_args()
    out = {'feet': [], 'frame': []}

    # ---- [F5] the DRAWN feet line vs the mark, per cut ------------------
    print('[F5] drawn feet line vs the mark it stands on (plate px)')
    print('  %-14s %-6s %-9s %-9s %s' % ('cut', 'declH', 'baseline', 'alphaBot', 'err'))
    worst = 0.0
    for key, (f, ch, base, hm) in ART.items():
        rows, _ = alpha_bottom(os.path.join(A, f))
        k = (hm * PX_PER_M) / ch
        err = (rows[0] - base) * k
        worst = max(worst, abs(err))
        out['feet'].append({'cut': key, 'baseline': base, 'alphaBottom': rows[0],
                            'plateErr': round(err, 2)})
        print('  %-14s %-6d %-9s %-9d %+.2f' % (key, ch, base, rows[0], err))
    for key, (f, cw, ch, base, hm) in STRIP.items():
        rows, _ = alpha_bottom(os.path.join(A, f), cw, ch)
        k = (hm * PX_PER_M) / ch
        errs = [(r - base) * k for r in rows]
        worst = max(worst, max(abs(e) for e in errs))
        out['feet'].append({'cut': key, 'baseline': base, 'alphaBottom': rows,
                            'plateErr': [round(e, 2) for e in errs]})
        print('  %-14s %-6d %-9s %-9s %s' % (
            key, ch, base, rows, ' '.join('%+.2f' % e for e in errs)))
    print('  WORST |err| = %.2f plate px' % worst)
    out['worstFeetErr'] = round(worst, 2)

    # ---- [F4] can the reader SEE all four? ------------------------------
    print('\n[F4] the marriage cast inside the lens (plate px clipped away)')
    print('  %-15s %-6s %-24s %s' % ('unit', 'lens', 'frame x/y', 'clipped'))
    for key, u in UNITS.items():
        fx, fy, fw, fh, k = frame_box(u['focus'])
        cast = {'bride': ('bride', FEET['bride'][0], FEET['bride'][1]),
                'clergyman': ('clergyman', FEET['clergyman'][0], FEET['clergyman'][1])}
        wk, wx = u['witness']
        cast['witness'] = (wk, wx, floor_at(wx))
        gk, gx = u['groom']
        cast['groom'] = (gk, gx, floor_at(gx))
        row = {'unit': key, 'lens': u['focus'], 'onMarriage': on_marriage(u),
               'frame': [round(fx, 1), round(fy, 1), round(fw, 1), round(fh, 1)],
               'clipped': {}}
        for who, (ak, x, y) in cast.items():
            (bx, by, bw, bh), _ = drawn_box(ak, x, y)
            clip = (max(0.0, fx - bx) + max(0.0, (bx + bw) - (fx + fw))
                    + max(0.0, fy - by) + max(0.0, (by + bh) - (fy + fh)))
            row['clipped'][who] = round(clip, 1)
        out['frame'].append(row)
        flag = '' if not row['onMarriage'] else ('  <-- ON THE MARRIAGE' if any(
            v > 0 for v in row['clipped'].values()) else '')
        print('  %-15s %-6s %-24s %s%s' % (
            key, u['focus'], '%.0f..%.0f / %.0f..%.0f' % (fx, fx + fw, fy, fy + fh),
            ' '.join('%s=%.0f' % (w[0], v) for w, v in row['clipped'].items()), flag))

    bad = [r for r in out['frame'] if r['onMarriage']
           and any(v > 0 for v in r['clipped'].values())]
    print('\n  marriage lenses that clip a participant: %d' % len(bad))
    for r in bad:
        print('    %s (%s): %s' % (r['unit'], r['lens'], r['clipped']))
    with open(a.json, 'w') as fh:
        json.dump(out, fh, indent=1)
    print('wrote %s' % a.json)
    return 0


if __name__ == '__main__':
    sys.exit(main())
