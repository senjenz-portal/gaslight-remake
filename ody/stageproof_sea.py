#!/usr/bin/env python3
"""stageproof_sea.py -- STAGE PROOF for the 'sea' ship set (PIPELINE-LIVING.md
S3.3: accept ON THE PLATE). Composites the key tableaux of CONTENT-odyssey.md
onto the REAL plate states at the ledger's true px/m on the true marks.
Deterministic: every constant below is read off tools/ody/ledger.json,
assets/plates/odyssey/actors/MANIFEST-poses.json, or measured off the lane's
own accepted proofs (arithmetic in comments). python/PIL only.

Sheet: tools/ody/work/stageproof-sea.jpg (tableaux stacked, labeled).
Report: JSON to stdout (mounts + numeric violations). DOES NOT FIX ART.
"""
import json
from collections import deque

import numpy as np
from PIL import Image, ImageDraw

ROOT = '/Users/samz/Documents/gaslight-remake/'
ACT = ROOT + 'assets/plates/odyssey/actors/'          # pose source (see FLAG V1)
SETD = ROOT + 'site-deploy/living-odyssey/assets/set/'
OUT = ROOT + 'tools/ody/work/stageproof-sea.jpg'

# ---------------- ledger constants (tools/ody/ledger.json) ----------------
SHORE_PXM, CAVE_PXM, SEA_PXM = 11.3, 43.0, 12.7
U_SHORE, U_CAVE, U_SEA = 20, 75, 22                    # ulysses 1.75 m
ROWER_SEATED = 15
POLY_STAND, POLY_SEATED = 300, 165                     # 7 m giant
SEA_GIANT_BODY = 89                                    # clifftopFigurePx
RAM_GREAT_LONG = 105                                   # 100..110 -> mid
SLUNG_MAN_LONG = 75

BEACH = [(300, 455), (438, 486), (540, 500), (610, 505)]        # band 18
YARD = [(940, 300), (1010, 318), (1090, 330)]                   # band 10
DECK = [(515, 420), (660, 490)]                                 # y=420+0.483(x-515)
CAVE_DOWN = [(270, 455), (450, 520), (620, 555), (800, 565), (980, 550),
             (1120, 515), (1230, 475)]
CAVE_UP = [(450, 400), (530, 388), (700, 345), (880, 330), (1000, 390),
           (1020, 430)]
LEDGE = [(790, 195), (870, 215), (955, 238), (1120, 230)]

FIRE_RING = (527, 418, 733, 500)
BED = (1025, 330, 1240, 500)
MOUTH = (290, 250, 405, 415)
FIREWOOD = (495, 495, 620, 555)


def polyy(poly, x):
    """interpolated/extrapolated y of a polyline at x"""
    for (x0, y0), (x1, y1) in zip(poly, poly[1:]):
        if x <= x1 or (x1, y1) == poly[-1]:
            if x < poly[0][0]:
                (x0, y0), (x1, y1) = poly[0], poly[1]
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return poly[-1][1]


def load(name):
    return Image.open(ACT + name + '.png').convert('RGBA')


def figbox(img, thr=24):
    al = np.asarray(img)[..., 3]
    ys = np.nonzero((al > thr).any(axis=1))[0]
    xs = np.nonzero((al > thr).any(axis=0))[0]
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def borderkey_cc(name):
    """navy border-flood key, keep largest CC -- for the two unmatted props"""
    rgb = np.asarray(Image.open(ACT + name).convert('RGB')).astype(int)
    H, W, _ = rgb.shape
    border = np.concatenate([rgb[0, :], rgb[-1, :], rgb[:, 0], rgb[:, -1]])
    med = np.median(border, axis=0)
    close = (np.abs(rgb - med).sum(axis=2) < 90)
    seen = np.zeros((H, W), bool)
    dq = deque()
    for x in range(W):
        for y in (0, H - 1):
            if close[y, x] and not seen[y, x]:
                seen[y, x] = True
                dq.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if close[y, x] and not seen[y, x]:
                seen[y, x] = True
                dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and close[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                dq.append((ny, nx))
    kept = ~seen
    lab = np.zeros((H, W), int)
    cur, sizes = 0, {}
    for y0 in range(H):
        for x0 in range(W):
            if kept[y0, x0] and lab[y0, x0] == 0:
                cur += 1
                dq = deque([(y0, x0)])
                lab[y0, x0] = cur
                n = 0
                while dq:
                    y, x = dq.popleft()
                    n += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < H and 0 <= nx < W and kept[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = cur
                            dq.append((ny, nx))
                sizes[cur] = n
    big = max(sizes, key=sizes.get)
    m = (lab == big)
    ys, xs = np.nonzero(m)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    out = np.zeros((y1 - y0 + 1, x1 - x0 + 1, 4), np.uint8)
    out[..., :3] = rgb[y0:y1 + 1, x0:x1 + 1].astype(np.uint8)
    out[..., 3] = np.where(m[y0:y1 + 1, x0:x1 + 1], 255, 0)
    return Image.fromarray(out)


MOUNTS = []


def place(plate, img, foot_xy, target, mode='h', flip=False, tag=''):
    """foot-baseline anchored mount. mode 'h': target = drawn figure height;
    'w': target = drawn figure width (long objects)."""
    fx0, fy0, fx1, fy1 = figbox(img)
    fw, fh = fx1 - fx0 + 1, fy1 - fy0 + 1
    k = target / (fh if mode == 'h' else fw)
    w, h = max(1, round(img.width * k)), max(1, round(img.height * k))
    s = img.resize((w, h), Image.LANCZOS)
    if flip:
        s = s.transpose(Image.FLIP_LEFT_RIGHT)
    dx0, dy1 = round(fx0 * k), round((fy1 + 1) * k)
    dw = round(fw * k)
    if flip:
        dx0 = w - dx0 - dw
    px = round(foot_xy[0] - (dx0 + dw / 2))
    py = round(foot_xy[1] - dy1)
    plate.alpha_composite(s, (px, py))
    bb = [px + dx0, py + round(fy0 * k), px + dx0 + dw - 1, py + dy1 - 1]
    MOUNTS.append({'tag': tag, 'foot': list(foot_xy),
                   'drawnPx': [round(fw * k), round(fh * k)], 'bbox': bb})
    return bb


def master(rel):
    return Image.open(SETD + rel).convert('RGBA')


ROWS = []


def row(name, img, caption):
    ROWS.append((name, img.convert('RGB'), caption))


# =============== SHORE (day master: council is at morning) ===============
CREW_SH_A = U_SHORE  # crew standing = 20 px at 11.3 px/m
sh = master('shore/shore-day.jpg')
place(sh, load('ulysses-stand'), (510, 492), U_SHORE, tag='ulysses-stand@council-ulysses')
arc = [(409, 501), (427, 504), (445, 507), (463, 507), (481, 504), (499, 501)]
for i, at in enumerate(arc):
    place(sh, load('crew-a-stand' if i % 2 == 0 else 'crew-b-stand'), at,
          CREW_SH_A, flip=True, tag='crew@council-arc-%d' % i)
row('shore-council (ody-i-06/07)', sh,
    'shore-day.jpg | ulysses-stand 20px @ (510,492) | crew x6 arc @ council-crew (445,507)')

sh = master('shore/shore-day.jpg')
for i in range(12):
    x = 518 + round(i * (674 - 518) / 11)
    y = round(polyy(BEACH, x))
    place(sh, load('crew-a-stand' if i % 2 == 0 else 'crew-b-stand'), (x, y),
          CREW_SH_A, flip=(i % 3 == 0), tag='twelve-%d' % i)
row('shore-twelve (ody-i-10)', sh,
    'shore-day.jpg | crew x12 @ 20px lined x518..674 on the beach line along ship-2 hull (mark 560,503)')

sh = master('shore/shore-day.jpg')
ub = place(sh, load('ulysses-walk'), (560, 503), U_SHORE, tag='ulysses-walk@twelve-at-ship')
skin = borderkey_cc('prop-wineskin.png')
kw = 10 / skin.width  # 0.9 m goatskin = 10.2 px at 11.3 px/m
skin_s = skin.resize((max(1, round(skin.width * kw)),
                      max(1, round(skin.height * kw))), Image.LANCZOS)
sh.alpha_composite(skin_s, (560 - 2, 503 - 16 - skin_s.height + 2))
MOUNTS.append({'tag': 'prop-wineskin@shoulder(STAND-IN, see V9)',
               'foot': [560, 487], 'drawnPx': [skin_s.width, skin_s.height],
               'bbox': [558, 489 - skin_s.height, 558 + skin_s.width, 489]})
for i, at in enumerate([(918, 318), (940, 325), (962, 331)]):
    p = load('ulysses-walk' if i == 1 else ('crew-a-stand' if i == 0 else 'crew-b-stand'))
    place(sh, p, at, U_SHORE, flip=True, tag='climb-party-%d@climb-path' % i)
row('shore-wineskin (ody-i-10/12)', sh,
    'shore-day.jpg | ulysses-walk 20px @ (560,503) + keyed prop-wineskin 10px at shoulder | party x3 @ climb-path (940,325)')

# ================================ CAVE ====================================
cv = master('cave/cave-shut.jpg')
place(cv, load('polyphemus-seated'), (760, 452), POLY_SEATED, tag='polyphemus-seated@giant-seat')
# clutch: NO ledger px row -- 270 px = 0.90 x 300 standing (waist-bend estimate); FLAG V5
place(cv, load('polyphemus-clutch'), (660, 510), 270, tag='polyphemus-clutch@fire-downstage')
place(cv, load('crew-a-stand'), (1160, 465), U_CAVE, tag='crew-a@huddle-far')
place(cv, load('crew-b-stand'), (1185, 472), U_CAVE, tag='crew-b@huddle-far')
row('cave-meal (ody-ii-10)', cv,
    'cave-shut.jpg | seated 165px @ giant-seat (760,452) | clutch 270px @ (660,510) vs the fire | crew 75px shrinking @ huddle-far (1160,465)')

cv = master('cave/cave-shut.jpg')
place(cv, load('polyphemus-seated'), (760, 452), POLY_SEATED, tag='polyphemus-seated@giant-seat')
place(cv, load('ulysses-offer'), (700, 468), U_CAVE, flip=True, tag='ulysses-offer@bowl-offer')
row('cave-bowl (ody-iii-08 G3)', cv,
    'cave-shut.jpg | ulysses-offer 75px @ bowl-offer (700,468) vs seated giant 165px @ (760,452); raised bowl = G3 holdAnchor (700,441)')

cv = master('cave/cave-embers.jpg')
# sprawl: replicate the lane's ACCEPTED mount (proof-cave-sprawl.png measured
# bbox x767..1022 y372..457 vs cave-embers): k = 256/1294 fig-length px
spr = load('polyphemus-sprawl')
sx0, sy0, sx1, sy1 = figbox(spr)
ks = 256.0 / (sx1 - sx0 + 1)
sw, shh = round(spr.width * ks), round(spr.height * ks)
spr_s = spr.resize((sw, shh), Image.LANCZOS)
px, py = round(767 - sx0 * ks), round(457 - (sy1 + 1) * ks)
cv.alpha_composite(spr_s, (px, py))
MOUNTS.append({'tag': 'polyphemus-sprawl@sprawl-axis', 'foot': [795, 450],
               'drawnPx': [256, round((sy1 - sy0 + 1) * ks)],
               'bbox': [767, py + round(sy0 * ks), 1022, 457]})
place(cv, load('crew-carry'), (655, 505), U_CAVE, tag='crew-carry@fire-downstage')
# drive: 75/682 raw-frame law (ulysses raw stand bbox h=682 -> lunge keeps raw px)
drv = load('ulysses-drive')
place(cv, drv, (735, 485), round((figbox(drv)[3] - figbox(drv)[1] + 1) * 75.0 / 682), tag='ulysses-drive@sprawl-head')
row('cave-drive (ody-iv-01..05)', cv,
    'cave-embers.jpg | sprawl 256px long on axis head (795,450)->feet (975,470) [accepted-lane mount] | crew-carry 75px @ (655,505) | ulysses-drive 60px lunge @ (735,485)')

cv = master('cave/cave-predawn.jpg')
place(cv, load('polyphemus-blinded-grope'), (345, 420), POLY_SEATED, tag='polyphemus-blinded@doorway-seat')
row('cave-blinded (ody-v-00)', cv,
    'cave-predawn.jpg | blinded-grope 165px seated @ doorway-seat (345,420), arms filling the 160px mouth arch')

cv = master('cave/cave-dawn.jpg')
# stroke: k pinned so the IN-POSE ram = 105 px long (fleece span 635 src px)
stk = load('polyphemus-stroke')
k_stroke = RAM_GREAT_LONG / 635.0
fh_st = figbox(stk)[3] - figbox(stk)[1] + 1
place(cv, stk, (345, 420), round(fh_st * k_stroke), flip=True, tag='polyphemus-stroke@doorway-seat')
place(cv, load('ram-great-slung'), (395, 438), RAM_GREAT_LONG, mode='w', tag='ram-great-slung@ram-at-mouth')
pair = load('ram-pair-slung')
fw_pair = figbox(pair)[2] - figbox(pair)[0] + 1
place(cv, pair, (620, 500), round(fw_pair * (SLUNG_MAN_LONG / (fw_pair * 0.717))), mode='w', tag='ram-pair-slung@mid-floor')
row('cave-escape (ody-v-06/07)', cv,
    'cave-dawn.jpg | stroke (in-pose ram=105px) kneeling @ doorway-seat (345,420) | ram-great-slung 105px @ ram-at-mouth (395,438) | ram-pair-slung (man=75px) @ (620,500)')

# ================================ SEA =====================================
ROWERS = [(556, 444), (586, 455), (616, 466), (573, 430), (603, 441), (633, 452)]
se = master('sea/sea.jpg')
for i, at in enumerate(ROWERS):
    place(se, load('crew-row'), at, ROWER_SEATED, tag='crew-row@rower-%d' % i)
place(se, load('ulysses-taunt'), (518, 426), U_SEA, flip=True, tag='ulysses-taunt@stern-ulysses')
# hurl: total 105 px so BODY reads 89 px (accepted raw-lane proof measured 100-105)
place(se, load('polyphemus-hurl'), (860, 210), 105, tag='polyphemus-hurl@clifftop-giant')
splash = borderkey_cc('prop-splash.png')
ksp = 76.0 / splash.height  # 6 m plume at 12.7 px/m; midpoint bowTip->cliff base
sp_s = splash.resize((round(splash.width * ksp), 76), Image.LANCZOS)
se.alpha_composite(sp_s, (724 - sp_s.width // 2, 528 - 76))
MOUNTS.append({'tag': 'prop-splash@between', 'foot': [724, 528],
               'drawnPx': [sp_s.width, 76],
               'bbox': [724 - sp_s.width // 2, 452, 724 + sp_s.width // 2, 528]})
row('sea-rock1 (ody-vi-01..03)', se,
    'sea.jpg | crew-row x6 @ 15px on both files | ulysses-taunt 22px @ stern (518,426) | hurl 105px total (body=89) @ clifftop-giant (860,210) | splash 76px @ (724,528)')

se = master('sea/sea.jpg')
for i, at in enumerate(ROWERS):
    place(se, load('crew-row'), at, ROWER_SEATED, tag='crew-row@rower-%d' % i)
place(se, load('polyphemus-curse'), (860, 210), 105, tag='polyphemus-curse@clifftop-giant')
row('sea-curse (ody-vi-11)', se,
    'sea.jpg | crew-row x6 @ 15px | curse 105px total (body=89, arms to the firmament) @ clifftop-giant (860,210)')

# ============================== SHEET =====================================
LBL = 30
W = 1408
sheet = Image.new('RGB', (W, len(ROWS) * (768 + LBL)), (12, 12, 16))
dr = ImageDraw.Draw(sheet)
y = 0
for name, img, cap in ROWS:
    dr.rectangle([0, y, W, y + LBL], fill=(24, 24, 32))
    dr.text((8, y + 4), name.upper(), fill=(255, 220, 120))
    dr.text((8, y + 17), cap, fill=(200, 200, 210))
    sheet.paste(img, (0, y + LBL))
    y += 768 + LBL
sheet.save(OUT, quality=90)

print(json.dumps({'sheet': OUT, 'rows': [r[0] for r in ROWS],
                  'mounts': MOUNTS}, indent=1))
