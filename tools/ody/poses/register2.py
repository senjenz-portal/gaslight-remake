#!/usr/bin/env python3
"""register2.py -- merge the CREW + RAMS rows into MANIFEST-poses.json.

The manifest's own law: 'merge-write: each pose lane owns exactly its own
actor key.' This lane adds poses.crew + poses.rams (ulysses-lean row shape)
and actors.crew + actors.rams (polyphemus-style lane metadata). Nothing owned
by the sibling lanes is read-modified.
"""
import hashlib
import json
import os

ROOT = '/Users/samz/Documents/gaslight-remake'
OUT = os.path.join(ROOT, 'assets/plates/odyssey/actors')
MAN = os.path.join(OUT, 'MANIFEST-poses.json')
RAWD = 'assets/raw/ody-poses'


def sha16(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()[:16]


def row(pid, raw, note):
    from PIL import Image
    f = os.path.join(OUT, pid + '.png')
    with open('/tmp/ody-poses/' + pid + '.matte.json') as fh:
        m = json.load(fh)
    im = Image.open(f)
    return {'file': 'assets/plates/odyssey/actors/' + pid + '.png',
            'sha256': sha16(f), 'size': list(im.size),
            'baseline_y': m['baseline_y'], 'pad': 6, 'raw': raw, 'note': note}


CREW = {
    'a-stand': row('crew-a-stand', 'assets/plates/odyssey/actors/crew-canonical.png',
                   'matted single cut from the pair - ochre young = A; council/huddle/'
                   'beach dressing, headcount law 12->6 (O.6) doubles him'),
    'b-stand': row('crew-b-stand', 'assets/plates/odyssey/actors/crew-canonical.png',
                   'matted single cut from the pair - slate elder = B'),
    'row': row('crew-row', RAWD + '/crew-row-cand1.png',
               'seated mid-pull, profile, oar in-sprite; works doubled along a '
               'gunwale (sea rower marks 1n..3f, ~15 px seated; i-07 crossing, v-12 aboard); '
               'scaleX(-1) to face either bow'),
    'carry': row('crew-carry', RAWD + '/crew-carry-cand1.png',
                 'A + B shouldering one mast-thick beam in file, facing left; iii-04 '
                 'club montage + iv-01..03 drive silhouettes; scale by MAN height (75 px cave)'),
    'plead': row('crew-plead', RAWD + '/crew-plead-cand2.png',
                 'reaching-restraining, near hand open to seize an arm, face anguished; '
                 'THE MEN vi-05 menbeg (stays lit under G6 click 2 - the O.12 mechanism); '
                 'also ii-01 beg at cave scale; reaches LEFT, flip for a stern-side grip'),
    'slung': row('crew-slung', RAWD + '/crew-slung-cand1.png',
                 'horizontal face-up, head LEFT, fists up in the wool - like ulysses-slung '
                 'but ochre; composites under any ram belly for custom trio staging (v-02/03)'),
    '_canonical': 'assets/plates/odyssey/actors/crew-canonical.png (untouched; pair cut apart per lane brief)',
    '_stageproof': ['tools/ody/work/poses/proof-cave.jpg',
                    'tools/ody/work/poses/proof-sea.jpg',
                    'tools/ody/work/poses/proof-carry.jpg'],
}

RAMS = {
    'great': row('ram-great', 'assets/plates/odyssey/actors/ram-great-canonical.png',
                 'matted canonical; MUST ship 100-110 px long in cave (ledger: hides a '
                 'slung 75 px Ulysses while the painted 45 px ewes stay normal); G5 target '
                 'at ram-stand (838,430), anchor (838,415); v-07..10 at ram-at-mouth (395,438)'),
    'great-slung': row('ram-great-slung', RAWD + '/ram-great-slung-cand1.png',
                       'THE tableau (O.11): crimson-chiton man lashed beneath the belly '
                       'fleece, partially hidden, ankles roped; same scale as great - swap-in '
                       'after the G5 slingUnder gateAct; v-05..11'),
    'walk': row('ram-walk', RAWD + '/ram-walk-cand1.png',
                'generic plainer flock male, ~52 px long in cave (1.2 m), small grey-brown '
                'horns so the great ram stays THE great ram; mid-step facing LEFT; flock '
                'streams (K5, iii-02, iii-06, v-05), doubles and flips'),
    'pair-slung': row('ram-pair-slung', RAWD + '/ram-pair-slung-cand1.png',
                      'two plainer rams abreast with an OCHRE man slung under the middle '
                      'of the three-abreast read (v-03 threetoaman, O.11 trios); scale the '
                      'GROUP so the slung man reads 75 px long (man spans 71.7% of width)'),
    '_canonical': 'assets/plates/odyssey/actors/ram-great-canonical.png (untouched)',
    '_stageproof': ['tools/ody/work/poses/proof-cave.jpg'],
}

ACTORS_CREW = {
    'lane': 'ody-poses-crew-rams',
    'canonical': 'assets/plates/odyssey/actors/crew-canonical.png',
    'law': 'PIPELINE-LIVING.md 3.3 - never touch the canonical; every pose keeps its body, inherits this head',
    'raw': RAWD, 'generated': '2026-08-14',
    'scale': {'cave': {'pxPerM': 43, 'standingPx': 75},
              'shore': {'pxPerM': 11.3, 'standingPx': 20},
              'sea': {'pxPerM': 12.7, 'standingPx': 22, 'seatedRowerPx': 15,
                      'marks': {'rower-1n': [556, 444], 'rower-2n': [586, 455],
                                'rower-3n': [616, 466], 'rower-1f': [573, 430],
                                'rower-2f': [603, 441], 'rower-3f': [633, 452]}}},
    'stageproofs': ['tools/ody/work/poses/proof-cave.jpg',
                    'tools/ody/work/poses/proof-sea.jpg',
                    'tools/ody/work/poses/proof-carry.jpg',
                    'tools/ody/work/poses/keys-sheet.jpg'],
    'matte': 'tools/ody/poses/matte_navy.py - border-flood key + enclosed-pocket clear '
             '(an arm/oar loop encloses flat field: pure-backing pockets >=120 px are '
             'cleared), rim-only blue-excess clamp at the costume\'s own ceiling '
             '(slate tunic measures 22-29 honestly; a flat ceiling would repaint it)',
}
ACTORS_RAMS = {
    'lane': 'ody-poses-crew-rams',
    'canonical': 'assets/plates/odyssey/actors/ram-great-canonical.png',
    'law': 'PIPELINE-LIVING.md 3.3 - never touch the canonical',
    'raw': RAWD, 'generated': '2026-08-14',
    'scale': {'cave': {'pxPerM': 43, 'greatRamLongPx': [100, 110],
                       'genericRamLongPx': 52, 'slungManLongPx': 75,
                       'marks': {'ram-stand': [838, 430], 'ram-at-mouth': [395, 438]}}},
    'stageproofs': ['tools/ody/work/poses/proof-cave.jpg',
                    'tools/ody/work/poses/keys-sheet.jpg'],
    'matte': ACTORS_CREW['matte'],
}

with open(MAN) as f:
    man = json.load(f)
assert isinstance(man.get('poses'), dict) and isinstance(man.get('actors'), dict)
for k in ('crew', 'rams'):
    assert k not in man['poses'] and k not in man['actors'], 'key %s already owned' % k
man['poses']['crew'] = CREW
man['poses']['rams'] = RAMS
man['actors']['crew'] = ACTORS_CREW
man['actors']['rams'] = ACTORS_RAMS
with open(MAN, 'w') as f:
    json.dump(man, f, indent=1)
print(json.dumps({'registered': ['poses.crew (6)', 'poses.rams (4)',
                                 'actors.crew', 'actors.rams'],
                  'manifest': MAN}))
