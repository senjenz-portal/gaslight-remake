#!/usr/bin/env python3
"""plume_floor.py -- put the fire on the SAME FLOOR as the reveal (F13).

The defect. The reader is told to station himself at the sitting-room window,
he clicks THAT window (targets.window, the bay at plate 763,373), he throws the
smoke rocket into it -- and the smoke comes out of the storey ABOVE, because
`street-smoke.jpg` paints the plume and the hot pane at the first-floor sash
(x 715..975, y 0..318) while the reveal happens behind the bay glass
(y 328..435). Two floors, one ruse. The review: "plume/hot pane upstairs,
reveal in the bay below."

Which one moves is decided by the script and not by taste. CONTENT-full's own
units put the fire in the room the reveal is in, three times over:
  v-01-plan2   "the sitting-room window will open. You are to station yourself
               close to that open window"
  vi-02-instinct2  target `window`, cue "click the lit window - throw it ...
               then watch the window"      <- the bay, at 763,373
  vi-03-panel  "a recess behind a sliding panel just above the right bell-pull"
               -- a bell-pull is in the sitting room, and the panel is what she
               crosses to IN THE REVEAL
Only the plate table's one line ("plume out of the first-floor window") puts it
upstairs, and that line is a description of the art, not of the action. So THE
ART MOVES.

How, without repainting anything. The fire is a DIFFERENCE: street-window.jpg
and street-smoke.jpg are the same painting outside the fire (control regions
measure |delta| mean 1.1 in the sky, 1.3 on the left wall -- JPEG noise), so

    fire = street-smoke - street-window   over the villa's first floor

is the painted fire, exactly, with nothing else in it. This tool

  1. HEALS the first floor by pasting street-window.jpg's own pixels over the
     whole fire region. The sash goes dark, the plume and the wall glow go with
     it. Nothing is generated and nothing is guessed: it is the same painting's
     other state.
  2. RE-LANDS THE FIRE ONE STOREY DOWN as a matte -- alpha = |fire|/K, colour =
     street-smoke's own pixels -- rigidly translated by SHIFT, so the smoke
     issues from the bay's LEFT RETURN (the pane at x 696..722; she crosses
     721 -> 786 and pauses at the panel side, so the fire owns the one face of
     the bay her image never stands in) and climbs the front of the house past
     the now-dark first-floor window.
  3. FEATHERS ONLY THE TOP of the moved layer. The plume used to run off the top
     of the plate; moved down, that plate-edge cut would show as a flat lid in
     mid-sky, so the top FEATHER px ramp to zero -- smoke thinning with height,
     which is the one edge smoke is allowed to have.
  4. GATES THE WRITE. Outside HEAL_BOX u DEST_BOX the new plate must equal the
     old one to the JPEG's own noise floor, and the report prints the count. The
     bay's glass band must GAIN fire signal and the first-floor sash must lose
     all of it; both are asserted here and again in tools/living/lap.mjs.

Both smoke states get it: `street-smoke.jpg` (burning) and `street-empty.jpg`
(dispersing), each against its own delta, so the dying plume dies where the live
one lived.

    python3 plume_floor.py [--raw /abs/rawdir] [--dry]
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import shutil

import numpy as np
from PIL import Image

ROOT = '/Users/samz/Documents/gaslight-remake'
LIVE = os.path.join(ROOT, 'site-deploy/living/assets/set/street')

BASE = 'street-window.jpg'                 # the clean state: window open, no fire
FIRES = ['street-smoke.jpg', 'street-empty.jpg']

# the region the painted fire touches, measured off the delta (bbox x 715..975,
# y 0..318 at |delta| > 18) and padded. Everything in here is healed.
HEAL_BOX = (690, 0, 1000, 332)
# the first-floor sash's own aperture -- the thing that must end up DARK, and the
# box the lap re-measures. Read off the hot-pixel classification: x 735..790,
# y 185..265.
SASH_BOX = (728, 178, 800, 272)

# the source rows of the moved layer: the smoke, plus the flame licking out of
# the sash mouth (y 190..214), and nothing of the sash's own glazing below it.
SRC_ROWS = (0, 214)
# THE TRANSLATION. Source root = the sash mouth (757, 200). Destination root =
# (727, 336): the bay's FRONT-LEFT face at its glass top -- targets.window.poly
# reads the glass across 696 / 722 / 766 / 808, so the mouth (690..768 measured
# after the move) covers the left return and the front-left pane and stops at the
# mullion, leaving the panel side she crosses to (786) clear of it. dx is set by
# that gate and by nothing else: at -48 the flame spilled 22 px onto the wall
# left of the window, which is a fire outside the house.
SHIFT = (-30, 136)
FEATHER = 30                               # the moved layer's top ramp, in px
# AND ITS BOTTOM RAMP, which is the edge the first cut got wrong: the layer's
# last row is a hard horizontal line, and at dest y 335 that line lay across the
# bay's slate hood in plain sight. The smoke has to go INTO the window, so the
# bottom BOT px fade to zero over the bay's own glass (dest y 322..348), where a
# warm haze thinning downwards is a room on fire and not an edge.
BOT = 26
K = 96.0                                   # delta that counts as opaque smoke

# the reveal's own storey, from sets/street.js: REVEAL.box y 318..430, and the
# bay's glass measured off the plate at y 328..435. The fire has to be IN this
# band after the move, and that is the whole point of the exercise.
REVEAL_BAND = (318, 435)
# where the moved layer is allowed to write
DEST_BOX = (HEAL_BOX[0] + SHIFT[0], SRC_ROWS[0] + SHIFT[1],
            HEAL_BOX[2] + SHIFT[0], SRC_ROWS[1] + SHIFT[1] + 1)
NOISE = 6.0                                # JPEG noise floor, max channel delta
JPEG_Q = 94


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 16), b''):
            h.update(b)
    return h.hexdigest()[:16]


def arr(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.float64)


def crop(a, box):
    x0, y0, x1, y1 = box
    return a[y0:y1, x0:x1]


def hot_lum(p):
    return 0.2126 * p[:, :, 0] + 0.7152 * p[:, :, 1] + 0.0722 * p[:, :, 2]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', default=None)
    ap.add_argument('--dry', action='store_true')
    args = ap.parse_args()

    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    raw = args.raw or os.path.join(ROOT, 'assets/raw/book-cf', stamp)
    pre = os.path.join(raw, 'pre')
    os.makedirs(pre, exist_ok=True)

    base = arr(os.path.join(LIVE, BASE))
    H, W, _ = base.shape
    report = {'when': stamp, 'base': BASE, 'heal': HEAL_BOX, 'sash': SASH_BOX,
              'shift': SHIFT, 'srcRows': SRC_ROWS, 'feather': FEATHER, 'K': K,
              'revealBand': REVEAL_BAND, 'destBox': DEST_BOX, 'plates': {}}

    # the moved layer's own alpha ramp, built once: 0 at the top row of the
    # destination, 1 by FEATHER px down
    ramp = np.ones((SRC_ROWS[1] - SRC_ROWS[0], 1))
    for i in range(min(FEATHER, ramp.shape[0])):
        ramp[i, 0] = i / FEATHER
    for i in range(min(BOT, ramp.shape[0])):
        ramp[-1 - i, 0] = min(ramp[-1 - i, 0], i / BOT)

    for name in FIRES:
        src_path = os.path.join(LIVE, name)
        if not os.path.exists(os.path.join(pre, name)):
            shutil.copy2(src_path, os.path.join(pre, name))
        fire_plate = arr(src_path)
        before = fire_plate.copy()

        # ---- 1. the fire, as a difference -------------------------------
        delta = np.abs(fire_plate - base).max(axis=2)
        fire_px_before = int((crop(delta, SASH_BOX) > 18).sum())
        band_before = int((delta[REVEAL_BAND[0]:REVEAL_BAND[1],
                                 HEAL_BOX[0]:HEAL_BOX[2]] > 18).sum())

        # ---- 2. heal the first floor ------------------------------------
        out = fire_plate.copy()
        x0, y0, x1, y1 = HEAL_BOX
        out[y0:y1, x0:x1] = base[y0:y1, x0:x1]

        # ---- 3. re-land the fire one storey down ------------------------
        sy0, sy1 = SRC_ROWS
        a = np.clip(crop(delta, (x0, sy0, x1, sy1)) / K, 0.0, 1.0) * ramp
        rgb = crop(fire_plate, (x0, sy0, x1, sy1))
        dx, dy = SHIFT
        # the destination window, clipped to the plate
        dx0, dy0 = x0 + dx, sy0 + dy
        dx1, dy1 = x1 + dx, sy1 + dy
        cx0, cy0 = max(0, dx0), max(0, dy0)
        cx1, cy1 = min(W, dx1), min(H, dy1)
        aa = a[cy0 - dy0:cy1 - dy0, cx0 - dx0:cx1 - dx0][:, :, None]
        cc = rgb[cy0 - dy0:cy1 - dy0, cx0 - dx0:cx1 - dx0]
        dst = out[cy0:cy1, cx0:cx1]
        out[cy0:cy1, cx0:cx1] = dst * (1.0 - aa) + cc * aa

        # ---- 4. gate ----------------------------------------------------
        moved = np.clip(out, 0, 255)
        if args.dry:
            Image.fromarray(moved.astype(np.uint8)).save(
                os.path.join(raw, name.replace('.jpg', '-dry.png')))

        gate = np.abs(moved - before).max(axis=2)
        allowed = np.zeros((H, W), bool)
        allowed[HEAL_BOX[1]:HEAL_BOX[3], HEAL_BOX[0]:HEAL_BOX[2]] = True
        allowed[cy0:cy1, cx0:cx1] = True
        leak = int((gate > NOISE)[~allowed].sum())

        # (a) THE SASH GOES DARK. Not "differs" -- the smoke drifts in front of
        # it, so it differs by design; the test is whether it is still a pane
        # LIT HOT, and hot is the plate's own signature: bright and warm.
        sash_hot = lambda p: int(((hot_lum(crop(p, SASH_BOX)) > 170) &
                                 (crop(p, SASH_BOX)[:, :, 0] >
                                  crop(p, SASH_BOX)[:, :, 2] + 30)).sum())
        hot_before, hot_after = sash_hot(before), sash_hot(moved)

        # (b) THE FIRE IS AT THE BAY. The moved matte's own strong alpha, in
        # plate coordinates: where does the smoke actually reach down to, and is
        # that the reveal's storey?
        strong = np.zeros((H, W), bool)
        strong[cy0:cy1, cx0:cx1] = aa[:, :, 0] >= 0.35
        ys, xs = np.where(strong)
        low = int(ys.max()) if len(ys) else -1
        mouth_x = (int(xs[ys >= ys.max() - 6].min()),
                   int(xs[ys >= ys.max() - 6].max())) if len(ys) else (0, 0)
        new_delta = np.abs(moved - base).max(axis=2)
        bay_px = int((new_delta[REVEAL_BAND[0]:REVEAL_BAND[1], 690:815] > 18).sum())
        band_after = int((new_delta[REVEAL_BAND[0]:REVEAL_BAND[1],
                                    HEAL_BOX[0] + dx:HEAL_BOX[2]] > 18).sum())

        rep = {'sashDiffPxBefore': fire_px_before,
               'sashHotPxBefore': hot_before, 'sashHotPxAfter': hot_after,
               'revealBandPxBefore': band_before, 'revealBandPxAfter': band_after,
               'bayGlassFirePx': bay_px, 'plumeLowestRow': low,
               'plumeMouthX': mouth_x, 'leakOutsideBoxes': leak,
               'shaBefore': sha256(src_path)}
        ok = (leak == 0 and hot_after == 0 and
              REVEAL_BAND[0] <= low <= REVEAL_BAND[0] + 44 and
              690 <= mouth_x[0] and mouth_x[1] <= 815)
        rep['pass'] = bool(ok)
        report['plates'][name] = rep
        print(f'{name}: sash hot {hot_before} -> {hot_after} px | '
              f'reveal band {band_before} -> {band_after} px | '
              f'bay glass fire {bay_px} px | plume mouth y={low} '
              f'x={mouth_x} | leak {leak} | pass={ok}')
        if not ok:
            report['plates'][name]['abortedBecause'] = (
                f'leak={leak} hot={hot_after} low={low} mouth={mouth_x}')
            print('  ABORT: gate failed, plate not written')
            continue
        if args.dry:
            continue
        Image.fromarray(moved.astype(np.uint8)).save(src_path, quality=JPEG_Q,
                                                     subsampling=0)
        rep['shaAfter'] = sha256(src_path)

    with open(os.path.join(raw, 'plume_floor.json'), 'w') as f:
        json.dump(report, f, indent=1)
    print('wrote ' + os.path.join(raw, 'plume_floor.json'))


if __name__ == '__main__':
    main()
