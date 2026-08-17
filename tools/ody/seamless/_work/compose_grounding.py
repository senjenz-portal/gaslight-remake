#!/usr/bin/env python3
"""
compose_grounding.py — before/after grounding composites for 4 odyssey
tableaux: BEFORE = plate + raw actor cuts (painter order, exactly what the
sets do today); AFTER = + shadowgen contact shadows (0.42+0.30*s law, s=1)
+ the cut floor-prop occluders interleaved at their ground line.
Also prints the burial metric per actor: occluder px overlapping the
actor's drawn silhouette (the seat the occluder buys).
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SEAM = os.path.dirname(HERE)
ODY = os.path.dirname(SEAM)
ROOT = os.path.dirname(os.path.dirname(ODY))
ASSETS = os.path.join(ROOT, 'site-deploy', 'living-odyssey')
REG = json.load(open(os.path.join(ODY, 'actors.json')))
OCC = json.load(open(os.path.join(SEAM, 'occluders', 'occluders.json')))

OP_LAW = 0.42 + 0.30 * 1.0     # the depth opacity at s=1 (chase.js verbatim)


def load_actor(name):
    a = REG[name]
    im = Image.open(os.path.join(ASSETS, a['file'])).convert('RGBA')
    return a, im


def shadow_of(lane, name):
    d = os.path.join(SEAM, 'shadows', lane)
    m = json.load(open(os.path.join(d, 'shadowmap.json')))['shadows'][name]
    im = Image.open(os.path.join(d, m['file'])).convert('RGBA')
    return m, im


def paste_alpha(base, im, xy):
    base.alpha_composite(im, (int(round(xy[0])), int(round(xy[1]))))


def scaled(im, k):
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))),
                     Image.LANCZOS)


TABLEAUX = [
    dict(id='T1 meal clutch (ii-10/iii-01/iii-07)', lane='cave',
         plate='set/cave/cave-shut.jpg',
         actors=[('polyphemus-clutch', (760, 452), 165)],
         occ=['firering-front.png'], crop=(500, 305, 980, 575)),
    dict(id='T2 plea+scheme, RESTAGED +12px off the ring band (ii-06/iii-03)',
         lane='cave', plate='set/cave/cave-shut.jpg',
         actors=[('ulysses-stand', (690, 507), 75),
                 ('crew-a-stand', (620, 507), 73),
                 ('crew-b-stand', (656, 510), 73)],
         occ=['firering-front.png'], crop=(460, 330, 900, 578)),
    dict(id='T3 the laden entry file (ii-00/01)', lane='cave',
         plate='set/cave/cave.jpg',
         actors=[('crew-carry', (532, 503), 73),
                 ('crew-carry', (592, 516), 73),
                 ('ulysses-walk', (662, 514), 75)],
         occ=['woodpile-front-master.png'], crop=(360, 340, 820, 600)),
    dict(id='T4 shore camp (i-02/03)', lane='shore',
         plate='set/shore/shore.jpg',
         actors=[('ulysses-stand', (390, 480), 20),
                 ('crew-a-stand', (430, 459), 19),
                 ('crew-b-stand', (452, 464), 19),
                 ('crew-a-stand', (466, 470), 19)],
         occ=['firepit-front.png'], crop=(330, 415, 510, 517)),
]


def build(t, with_ground):
    plate = Image.open(os.path.join(ASSETS, 'assets/' + t['plate'])).convert('RGBA')
    items = []          # (sortY, kind, img, xy, name)
    burial = {}
    for i, (name, at, h) in enumerate(t['actors']):
        a, im = load_actor(name)
        k = h / a['baseline']
        cut = scaled(im, k)
        xy = (at[0] - a['pin'][0] * k, at[1] - a['pin'][1] * k)
        items.append((at[1], 'actor', cut, xy, f'{name}#{i}'))
        if with_ground:
            m, sh = shadow_of(t['lane'], name)
            shk = scaled(sh, k)
            sxy = (at[0] - m['anchor'][0] * k, at[1] - m['anchor'][1] * k)
            al = shk.getchannel('A').point(lambda v: int(v * OP_LAW))
            shk.putalpha(al)
            items.append((-1e9, 'shadow', shk, sxy, name))
    if with_ground:
        for f in t['occ']:
            om = OCC[f]
            oim = Image.open(os.path.join(SEAM, 'occluders', f)).convert('RGBA')
            items.append((om['ground'], 'occ', oim, tuple(om['origin']), f))
    items.sort(key=lambda e: e[0])
    out = plate.copy()
    drawn = []          # (kind, img, xy, name) in draw order
    for y, kind, im, xy, name in items:
        paste_alpha(out, im, xy)
        drawn.append((y, kind, im, xy, name))
    # burial metric: occluder alpha over each actor's silhouette, only when
    # the occluder draws after the actor
    if with_ground:
        W, H = plate.size
        def mask_of(im, xy):
            m = np.zeros((H, W), bool)
            x, y = int(round(xy[0])), int(round(xy[1]))
            a = np.asarray(im)[..., 3] > 96
            x0, y0 = max(0, x), max(0, y)
            x1, y1 = min(W, x + im.width), min(H, y + im.height)
            m[y0:y1, x0:x1] = a[y0 - y:y1 - y, x0 - x:x1 - x]
            return m
        for i, (ya, kind, im, xy, name) in enumerate(drawn):
            if kind != 'actor':
                continue
            am = mask_of(im, xy)
            for yb, kind2, im2, xy2, name2 in drawn[i + 1:]:
                if kind2 != 'occ':
                    continue
                ov = am & mask_of(im2, xy2)
                if ov.any():
                    rows = np.where(ov.any(axis=1))[0]
                    burial[name] = burial.get(name, 0) + int(ov.sum())
                    burial[f'{name}~rows'] = f'y{rows.min()}..{rows.max()}'
    return out, burial


def panel(img, crop, w):
    c = img.crop(crop)
    k = w / c.width
    return c.resize((w, round(c.height * k)), Image.LANCZOS).convert('RGB')


def main():
    PW = 640
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 15)
        bfont = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 19)
    except OSError:
        font = bfont = ImageFont.load_default()
    rows = []
    metrics = {}
    for t in TABLEAUX:
        before, _ = build(t, False)
        after, burial = build(t, True)
        metrics[t['id']] = burial
        pb = panel(before, t['crop'], PW)
        pa = panel(after, t['crop'], PW)
        label = Image.new('RGB', (PW * 2 + 30, 30), (18, 18, 22))
        d = ImageDraw.Draw(label)
        d.text((10, 6), t['id'] + '   [ BEFORE | AFTER: contact shadows + '
               'floor-prop occluders ]', font=bfont, fill=(235, 225, 200))
        row = Image.new('RGB', (PW * 2 + 30, pb.height + 30 + 10), (18, 18, 22))
        row.paste(label, (0, 0))
        row.paste(pb, (10, 30))
        row.paste(pa, (PW + 20, 30))
        rows.append(row)
        print(t['id'], json.dumps(burial))
    W = max(r.width for r in rows)
    H = sum(r.height for r in rows) + 44
    sheet = Image.new('RGB', (W, H), (18, 18, 22))
    d = ImageDraw.Draw(sheet)
    d.text((10, 8), 'EXPLORER C — GROUNDING: shadowgen contact shadows + '
           'plate-cut occluders. BEFORE | AFTER', font=bfont,
           fill=(255, 210, 130))
    y = 40
    for r in rows:
        sheet.paste(r, (0, y))
        y += r.height
    out = os.path.join(SEAM, 'explore-grounding-sheet.jpg')
    sheet.save(out, quality=88)
    print('->', out, sheet.size)
    with open(os.path.join(HERE, 'burial-metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=1)


if __name__ == '__main__':
    main()
