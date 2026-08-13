#!/usr/bin/env python3
"""stageproof.py -- stand the shipped cuts on the real plate, at engine scale.

The lane's gate is not "does the head look right in isolation" -- it is "does
the reader see one person". So the proof composites the SHIPPED sprites (the
downscaled ones the engine actually loads), at the engine's own px/m, on the
engine's own floor line, at the engine's own marks. Anything that survives this
is what the reader gets.
"""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont

ROOT = '/Users/samz/Documents/gaslight-remake'
LIVE = os.path.join(ROOT, 'site-deploy/living/assets')
PLATE = os.path.join(LIVE, 'set/church/church.jpg')
PX_PER_M = 104.5
AISLE = dict(x0=470, y0=590, slope=(532 - 590) / (690 - 470))
floor = lambda x: AISLE['y0'] + (x - AISLE['x0']) * AISLE['slope']

# (file, centre x, metres tall, cells, label)  -- marks out of church.js / actor_geom
CAST = [
    ('actor/holmes-church.png', 560, 1.87, 1, 'Holmes IV.3 lounged'),
    ('actor/holmes-church-walk.png', 630, 1.87, 4, 'Holmes IV.8 drag (f1)'),
    ('actor/holmes-church-altar.png', 700, 1.87, 1, 'Holmes IV.9 altar'),
    ('actor/irene-bride.png', 740, 1.68, 1, 'Irene the bride, ON the painted bride\'s own mark (UNDRAWN today)'),
    ('actor/norton-groom.png', 838, 1.80, 1, 'Norton the groom'),
]

def main():
    out = sys.argv[1]
    p = Image.open(PLATE).convert('RGBA')
    d = ImageDraw.Draw(p)
    try: f = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 15)
    except Exception: f = ImageFont.load_default()
    for rel, x, m, cells, lab in CAST:
        im = Image.open(os.path.join(LIVE, rel)).convert('RGBA')
        if cells > 1:
            im = im.crop((0, 0, im.width // cells, im.height))
        th = PX_PER_M * m
        k = th / im.height
        im = im.resize((max(1, round(im.width * k)), round(th)), Image.LANCZOS)
        fy = 521 if 'irene-bride' in rel else floor(x)
        p.alpha_composite(im, (round(x - im.width / 2), round(fy - im.height)))
        d.text((x - 60, fy + 6), lab, fill=(255, 235, 180), font=f)
    p.convert('RGB').save(out); print(out, p.size)

main()
