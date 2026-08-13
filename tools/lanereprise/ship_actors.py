#!/usr/bin/env python3
"""ship_actors.py -- key, align, palette-pull and ship the REPRISE ACTORS.

THE ONE THING THIS DOES THAT `matte.py ACTOR` ALONE CANNOT. matte.py trims each
figure to its OWN alpha bbox, so two states of the same actor come out on two
different canvases and a swap on the plate makes him jump. Beat I's law for a
derived state (`king-masked.png` / `king-unmasked.png`, "pixel-aligned: same
pose, same framing, same light - a straight swap or a crossfade at the gate does
not move him") needs a SHARED canvas, so every member of a family is cropped to
the family's UNION bbox in the generator's own frame. The derived states were
produced by editing the picked idle, so that frame is already common: the
clergyman pair share their y range and their left edge exactly, and both groom
states share their foot line to the pixel.

    python3 ship_actors.py RAWDIR [--dest ...]
"""
import argparse
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import datetime as dt

import numpy as np
from PIL import Image

ROOT = '/Users/samz/Documents/gaslight-remake'
DEST = os.path.join(ROOT, 'assets/plates/book/actors')

_spec = importlib.util.spec_from_file_location(
    'matte', os.path.join(ROOT, 'tools/laneassets/matte.py'))
matte = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(matte)

# family -> (raw stem, shipped name, role)
FAMILIES = {
    'clergyman': [
        ('holmes-clergyman-b', 'holmes-clergyman.png',
         'beats II / V: Holmes in the Nonconformist-clergyman disguise, standing in '
         'Serpentine Avenue telling Watson the plan'),
        ('holmes-clergyman-hand', 'holmes-clergyman-signal.png',
         'beat V.3 `signal`: "when I raise my hand-so". Pixel-aligned with the idle '
         '- a straight swap does not move him'),
    ],
    'groom': [
        ('holmes-groom-b', 'holmes-groom.png',
         'beats III-IV: Holmes in the groom-out-of-work disguise. The shabby fare '
         '(III.9) and the idler at the back of the church (IV.3)'),
        ('holmes-groom-altar', 'holmes-groom-altar.png',
         'beat IV.9-13: cap off, head bowed, at the altar mumbling responses. '
         'Pixel-aligned with the idle'),
    ],
}
PAD = 6


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def keyed(raw):
    img, bg = matte.key(raw)
    return img, [round(float(v), 1) for v in bg]


def union_bbox(imgs):
    bs = [matte.bbox_of(i) for i in imgs]
    return (min(b[0] for b in bs), min(b[1] for b in bs),
            max(b[2] for b in bs), max(b[3] for b in bs))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('raw')
    ap.add_argument('--dest', default=DEST)
    a = ap.parse_args()
    raw, dest = a.raw.rstrip('/'), a.dest
    os.makedirs(dest, exist_ok=True)
    out = {}

    for fam, members in FAMILIES.items():
        imgs, bgs = [], []
        for stem, _, _ in members:
            im, bg = keyed(os.path.join(raw, stem + '.png'))
            imgs.append(im)
            bgs.append(bg)
        x0, y0, x1, y1 = union_bbox(imgs)
        x0 = max(0, x0 - PAD); y0 = max(0, y0 - PAD)
        x1 = min(imgs[0].width, x1 + PAD); y1 = min(imgs[0].height, y1 + PAD)
        for (stem, name, role), im, bg in zip(members, imgs, bgs):
            cut = im.crop((x0, y0, x1, y1))
            p = os.path.join(dest, name)
            cut.save(p)
            al = np.asarray(cut)[..., 3]
            ys = np.nonzero((al > 24).any(axis=1))[0]
            out[name] = {
                'file': name, 'family': fam, 'role': role,
                'size': list(cut.size), 'mode': 'RGBA',
                'bytes': os.path.getsize(p), 'sha256': sha(p),
                'raw': os.path.join(raw, stem + '.png'),
                'shared_canvas': [x0, y0, x1, y1],
                'alpha_top_y': int(ys.min()), 'alpha_bottom_y': int(ys.max()) + 1,
                'alpha_height_px': int(ys.max() - ys.min() + 1),
                'baseline_y': int(ys.max()) + 1,
                'backing_rgb_keyed': bg,
            }

    # ---- the walk strip: matte to uniform cells, then pull its palette back
    strip_raw = os.path.join(raw, 'holmes-groom-walk.png')
    tmp = os.path.join(raw, 'matte/holmes-groom-walk.png')
    meta = os.path.join(raw, 'matte/holmes-groom-walk.json')
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools/laneassets/matte.py'),
                    strip_raw, tmp, '--strip', '4', '--json', meta, '--pad', '6'],
                   check=True, capture_output=True)
    walk = os.path.join(dest, 'holmes-groom-walk.png')
    pull = subprocess.run(
        [sys.executable, os.path.join(ROOT, 'tools/laneassets/palettepull.py'),
         tmp, os.path.join(dest, 'holmes-groom.png'), walk, '4', '0.65'],
        check=True, capture_output=True, text=True).stdout.strip()
    sm = json.load(open(meta))
    im = Image.open(walk)
    out['holmes-groom-walk.png'] = {
        'file': 'holmes-groom-walk.png', 'family': 'groom',
        'role': 'beat IV.3 seg `lounge` ("I lounged up the side aisle like any other '
                'idler") and IV.8 seg `drag`. 4-frame cycle, strict side profile, '
                'walking toward the VIEWER\'S RIGHT (the altar end of the plate)',
        'size': list(im.size), 'mode': 'RGBA', 'frames': 4,
        'cell': [sm['cell_w'], sm['cell_h']],
        'baseline_y': sm['baseline_y'],
        'cycle': 'contact / passing / contact-opposite / passing-opposite',
        'bytes': os.path.getsize(walk), 'sha256': sha(walk),
        'raw': strip_raw,
        'canvas': os.path.join(raw, 'walk-canvas-groom.png'),
        'palette_pull': '0.65 toward holmes-groom.png (tools/laneassets/palettepull.py) '
                        '- every generated frame drifts in mean/std from the idle and '
                        'shimmers against him without it',
        'palette_residuals': pull,
    }

    # ---- the fee
    src = os.path.join(raw, 'photo-irene-conformed.png')
    p = os.path.join(dest, 'photo-irene.png')
    Image.open(src).convert('RGB').save(p)
    conf = json.load(open(os.path.join(raw, 'photo-irene.conform.json')))
    out['photo-irene.png'] = {
        'file': 'photo-irene.png', 'family': 'inset',
        'role': 'beat VII.6-10 INSET `plate-irene` - the portrait of Irene ALONE, '
                'which is the fee Holmes asks for. NOT `both-photo.png`, which is '
                'I.8\'s compromising photograph of TWO people',
        'size': list(Image.open(p).size), 'mode': 'RGB',
        'bytes': os.path.getsize(p), 'sha256': sha(p),
        'raw': os.path.join(raw, 'photo-irene-c.png'),
        'conform': conf,
    }

    with open(os.path.join(dest, 'files-reprise.json'), 'w') as f:
        json.dump({'generated_at': dt.datetime.now().isoformat(timespec='seconds'),
                   'files': out}, f, indent=1)
    print(json.dumps({k: {kk: v[kk] for kk in ('size', 'bytes', 'alpha_height_px',
                                               'baseline_y', 'frames')
                          if kk in v} for k, v in out.items()}, indent=1))


if __name__ == '__main__':
    main()
