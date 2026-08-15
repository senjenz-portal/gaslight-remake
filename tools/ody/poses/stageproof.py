#!/usr/bin/env python3
"""stageproof.py -- composite the CREW + RAMS poses onto the real masters at
the LEDGER.md measured scales, foot-baseline anchored (the only anchor an
isometric plate allows). Proofs:

  proof-cave.jpg   cave-predawn: great ram at ram-stand (838,430) 105px long;
                   ram-great-slung at ram-at-mouth (395,438) same scale;
                   ram-pair-slung mid-floor, its slung man = 75px long;
                   ram-walk beside the painted ewes (45px) at generic scale;
                   crew-a-stand + crew-b-stand at huddle-far, 75px tall;
                   crew-slung shown inside the pair (it ships for custom
                   trio compositing) -- proven by the pair-slung group here.
  proof-sea.jpg    sea: crew-row seated on the deck line at rower marks
                   (~15px seated), doubled at the three near-file marks;
                   crew-plead at stern-side (menbeg is a ship-interior beat).
  proof-carry.jpg  cave-embers: crew-carry at 75px-man scale by the fire.
"""
import json

import numpy as np
from PIL import Image

BASE = '/tmp/ody-poses/'
SETD = '/Users/samz/Documents/gaslight-remake/site-deploy/living-odyssey/assets/set/'


def load(n):
    return Image.open(BASE + n + '.key.png').convert('RGBA')


def fig_h(img):
    """figure height above baseline pad (alpha>24 rows)"""
    al = np.asarray(img)[..., 3]
    ys = np.nonzero((al > 24).any(axis=1))[0]
    return ys.max() - ys.min() + 1


def fig_w(img):
    al = np.asarray(img)[..., 3]
    xs = np.nonzero((al > 24).any(axis=0))[0]
    return xs.max() - xs.min() + 1


def place(plate, img, foot_xy, scale, flip=False):
    w, h = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    s = img.resize((w, h), Image.LANCZOS)
    if flip:
        s = s.transpose(Image.FLIP_LEFT_RIGHT)
    x = round(foot_xy[0] - w / 2)
    y = round(foot_xy[1] - h)          # foot baseline = bottom edge
    plate.alpha_composite(s, (max(0, x), max(0, y)))
    return {'at': list(foot_xy), 'px': [w, h]}


rep = {}

# ---- cave proof (predawn state, Beat V) ----
cave = Image.open(SETD + 'cave/cave-predawn.jpg').convert('RGBA')
great = load('ram-great')
k_great = 105.0 / fig_w(great)                     # 100-110 px long (ledger)
rep['ram-great'] = place(cave, great, (838, 430), k_great)
gslung = load('ram-great-slung')
k_gs = 105.0 / fig_w(gslung)
rep['ram-great-slung'] = place(cave, gslung, (395, 438), k_gs)
pair = load('ram-pair-slung')
# scale so the slung man reads 75px long: man spans 71.7% of group width (measured)
k_pair = 75.0 / (fig_w(pair) * 0.717)
rep['ram-pair-slung'] = place(cave, pair, (620, 500), k_pair)
walk = load('ram-walk')
k_walk = 52.0 / fig_w(walk)                        # generic ram ~1.2m long @43px/m
rep['ram-walk'] = place(cave, walk, (930, 320), k_walk)
ca, cb = load('crew-a-stand'), load('crew-b-stand')
k_ca, k_cb = 75.0 / fig_h(ca), 75.0 / fig_h(cb)
rep['crew-a-stand'] = place(cave, ca, (1160, 465), k_ca)
rep['crew-b-stand'] = place(cave, cb, (1185, 472), k_cb)
cs = load('crew-slung')
k_cs = 75.0 / fig_w(cs)                            # horizontal: length = height of man
rep['crew-slung'] = place(cave, cs, (620, 555), k_cs)
cave.convert('RGB').save(BASE + 'proof-cave.jpg', quality=90)

# ---- sea proof (Beat VI) ----
sea = Image.open(SETD + 'sea/sea.jpg').convert('RGBA')
row = load('crew-row')
k_row = 15.0 / fig_h(row)                          # seated rower ~15px (ledger)
for i, m in enumerate([(556, 444), (586, 455), (616, 466)]):
    rep['crew-row-%d' % i] = place(sea, row, m, k_row)
pl = load('crew-plead')
k_pl = 22.0 / fig_h(pl)                            # sea-scale man 22px
rep['crew-plead'] = place(sea, pl, (556, 444), k_pl, flip=True)
sea.convert('RGB').save(BASE + 'proof-sea.jpg', quality=90)

# ---- carry proof (cave embers, Beat IV stake business) ----
emb = Image.open(SETD + 'cave/cave-embers.jpg').convert('RGBA')
cc = load('crew-carry')
k_cc = 75.0 / fig_h(cc)
rep['crew-carry'] = place(emb, cc, (640, 520), k_cc)
emb.convert('RGB').save(BASE + 'proof-carry.jpg', quality=90)

rep['scales'] = {'k_great': round(k_great, 4), 'k_pair': round(k_pair, 4),
                 'k_walk': round(k_walk, 4), 'k_crew': round(k_ca, 4),
                 'k_row': round(k_row, 4)}
print(json.dumps(rep, indent=1))
