#!/usr/bin/env python3
"""stageproof.py -- composite the runtime's exact layer stack as a still.

A screenshot of the page proves the page. This proves the NUMBERS before the
page exists: same plate space, same order, same marks, same scales as
site-deploy/living/app/stage.js. If the King floats, or the hole-patch seams,
or the walk lurches, it shows up here in seconds instead of after a lap.
"""
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = os.path.join(ROOT, 'site-deploy', 'living', 'assets')
OUT = os.path.join(ROOT, 'assets', 'raw', 'living')
PLATE_W, PLATE_H = 1408, 768

# --- the marks, in plate pixels (these are stage.js's numbers) -------------
KING_H = 274.0                     # px_per_m 124.3 * 2.2 m
KING_SRC_H = 1147.0                # alpha bbox height of king-masked.png
KING_FOOT = (432.6, 1153.0)        # foot centroid / baseline in the actor image
STAND = (700, 488)
DOOR_MARK = (398, 505)
HOLMES_PARTS = {                   # the sibling lane's own placement numbers
    'legs': (572, 469, 63, 54), 'skirt': (578, 395, 56, 86),
    'torso': (558, 297, 89, 110), 'head': (577, 293, 43, 61),
    'pipe': (558, 325, 43, 81)}
PATCH_AT = (536, 271)
CHAIR_AT = (718, 335)
WALK = {'enter': dict(file='king-walk-enter.png', cell=(448, 473), n=4,
                      anchors=[276.5, 275.0, 276.5, 254.5], src_h=458.5),
        'exit': dict(file='king-walk-exit.png', cell=(378, 481), n=4,
                     anchors=[227.5, 209.5, 227.0, 232.5], src_h=466.0)}


def op(p):
    return Image.open(os.path.join(A, p))


def scaled(im, h):
    s = h / im.size[1]
    return im.resize((max(1, round(im.size[0] * s)), max(1, round(im.size[1] * s))), Image.LANCZOS)


def king(base, at, masked=True, shadow=True):
    im = op('actor/king-{}.png'.format('masked' if masked else 'unmasked')).convert('RGBA')
    s = KING_H / KING_SRC_H
    im2 = im.resize((round(im.size[0] * s), round(im.size[1] * s)), Image.LANCZOS)
    x = round(at[0] - KING_FOOT[0] * s)
    y = round(at[1] - KING_FOOT[1] * s)
    if shadow:
        sh = op('actor/contact-shadow.png').convert('RGBA')
        sw = round(KING_H * 0.52)
        sh = sh.resize((sw, max(1, round(sw * sh.size[1] / sh.size[0]))), Image.LANCZOS)
        base.alpha_composite(sh, (round(at[0] - sw / 2), round(at[1] - sh.size[1] * 0.62)))
    base.alpha_composite(im2, (x, y))
    return base


def walkframe(base, kind, i, at):
    w = WALK[kind]
    strip = op('actor/' + w['file']).convert('RGBA')
    cw, ch = w['cell']
    cell = strip.crop((i * cw, 0, (i + 1) * cw, ch))
    s = KING_H / w['src_h']
    cell = cell.resize((round(cw * s), round(ch * s)), Image.LANCZOS)
    ax = w['anchors'][i] * s
    ay = (ch - 6) * s
    base.alpha_composite(cell, (round(at[0] - ax), round(at[1] - ay)))
    return base


def room(dim=False, door_open=False):
    f = 'plate/room-dim.jpg' if dim else ('plate/room-open.jpg' if door_open else 'plate/room.jpg')
    return op(f).convert('RGBA')


def holmes(base, dim=False):
    base.alpha_composite(op('plate/holmes-patch{}.png'.format('-dim' if dim else '')).convert('RGBA'),
                         PATCH_AT)
    for k in ['legs', 'skirt', 'torso', 'head', 'pipe']:
        x, y, w, h = HOLMES_PARTS[k]
        base.alpha_composite(op(f'actor/holmes-{k}.png').convert('RGBA'), (x, y))
    return base


def chair(base):
    base.alpha_composite(op('plate/chair.png').convert('RGBA'), CHAIR_AT)
    return base


def main():
    os.makedirs(OUT, exist_ok=True)
    shots = {}

    # 1 — the room with Holmes patched out and the puppet re-laid. If the patch
    #     works, this frame is the plate.
    im = chair(holmes(room()))
    im.convert('RGB').save(os.path.join(OUT, 'proof-01-room.png'))

    # 2 — the masked colossus on his mark, beside Holmes
    im = room()
    im = holmes(im)
    im = king(im, STAND, True)
    im = chair(im)
    im.convert('RGB').save(os.path.join(OUT, 'proof-02-standing.png'))

    # 3 — unmasked, same mark
    im = chair(king(holmes(room()), STAND, False))
    im.convert('RGB').save(os.path.join(OUT, 'proof-03-unmasked.png'))

    # 4 — the entrance walk, all four frames along the path
    im = holmes(room(door_open=True))
    for i in range(4):
        t = i / 3.0
        at = (DOOR_MARK[0] + (STAND[0] - DOOR_MARK[0]) * t,
              DOOR_MARK[1] + (STAND[1] - DOOR_MARK[1]) * t)
        im = walkframe(im, 'enter', i, at)
    im = chair(im)
    im.convert('RGB').save(os.path.join(OUT, 'proof-04-walk-enter.png'))

    # 5 — the exit walk
    im = holmes(room(door_open=True))
    for i in range(4):
        t = i / 3.0
        at = (STAND[0] + (DOOR_MARK[0] - STAND[0]) * t,
              STAND[1] + (DOOR_MARK[1] - STAND[1]) * t)
        im = walkframe(im, 'exit', i, at)
    im = chair(im)
    im.convert('RGB').save(os.path.join(OUT, 'proof-05-walk-exit.png'))

    # 6 — the dim state (what an inset plate rises over) + the props
    im = holmes(room(dim=True), dim=True)
    im = king(im, STAND, True)
    note = scaled(op('actor/note-prop.png').convert('RGBA'), 34)
    im.alpha_composite(note, (566, 330))
    mask = scaled(op('actor/mask-prop.png').convert('RGBA'), 16)
    im.alpha_composite(mask, (640, 500))
    im = chair(im)
    im.convert('RGB').save(os.path.join(OUT, 'proof-06-dim-props.png'))

    # 7 — a contact sheet
    names = ['proof-01-room', 'proof-02-standing', 'proof-03-unmasked',
             'proof-04-walk-enter', 'proof-05-walk-exit', 'proof-06-dim-props']
    sheet = Image.new('RGB', (704 * 2, 384 * 3), (0, 0, 0))
    for i, n in enumerate(names):
        t = Image.open(os.path.join(OUT, n + '.png')).resize((704, 384), Image.LANCZOS)
        sheet.paste(t, ((i % 2) * 704, (i // 2) * 384))
    sheet.save(os.path.join(OUT, 'proof-sheet.png'))
    shots['sheet'] = os.path.join(OUT, 'proof-sheet.png')

    # the seam test: with nobody moving, room+patch+puppet must equal the plate
    import numpy as np
    a = np.asarray(chair(holmes(room())).convert('RGB')).astype(int)
    b = np.asarray(room().convert('RGB')).astype(int)
    d = np.abs(a - b).sum(axis=2)
    box = d[271:549, 536:672]
    shots['patchSeam'] = {'meanAbsInPatchRect': round(float(box.mean()), 2),
                          'pxOver30OutsidePatch': int((d > 30).sum() - (box > 30).sum())}
    print(json.dumps(shots, indent=1))


if __name__ == '__main__':
    main()
