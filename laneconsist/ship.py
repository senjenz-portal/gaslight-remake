#!/usr/bin/env python3
"""ship.py -- land the accepted regenerations, and ONLY those files.

tools/living/prep_book.py is the book's real ship step, but it rewrites the
whole of site-deploy/living/assets and its MANIFEST from every lane's plates at
once. Other lanes are editing that tree right now, so running it would land
their half-finished work as well as this lane's. This tool therefore reproduces
prep_book's own shrink() -- same LANCZOS, same k = min(1, target/h), same
cell-grid rule for strips, same target heights out of the same SCALE table --
for exactly the files this lane regenerated, and copies the beat-I strip the way
prep.py copies it (verbatim, no resample).

Every write is preceded by a sha256 of what was there before, into
assets/raw/book-consist/SHIP.json, so any of it can be put back.

    python3 ship.py [--dry]
"""
import argparse, hashlib, json, os, shutil, datetime as dt
from PIL import Image

ROOT = '/Users/samz/Documents/gaslight-remake'
R = os.path.join(ROOT, 'assets/raw/book-consist')
BOOK_ACTORS = os.path.join(ROOT, 'assets/plates/book/actors')
BEAT1 = os.path.join(ROOT, 'assets/plates/beat1')
LIVE = os.path.join(ROOT, 'site-deploy/living/assets')

PX_PER_M = {'street': 49.4, 'church': 104.5, 'chase': 51.2}   # prep_book.SCALE


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 16), b''):
            h.update(b)
    return h.hexdigest()


def shrink(src, dst, target_h, cells=1):
    """prep_book.shrink(), byte-for-byte the same operation."""
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    k = min(1.0, target_h / h)
    nw, nh = max(1, round(w * k)), max(1, round(h * k))
    if cells > 1:
        nw = max(1, round((w // cells) * k)) * cells
    im.resize((nw, nh), Image.LANCZOS).save(dst, 'PNG', optimize=True)
    return {'scale': round(k, 5), 'src_size': [w, h], 'size': [nw, nh]}


# accepted master -> (master name, [ (shipped rel, height_m, set, cells) ])
PLAN = [
    ('irene-bride.png',       [('actor/irene-bride.png',        1.68, 'church', 1)]),
    ('holmes-groom.png',      [('actor/holmes-church.png',       1.87, 'church', 1),
                               ('actor/holmes-chase.png',        1.87, 'chase',  1)]),
    ('holmes-groom-altar.png', [('actor/holmes-church-altar.png', 1.87, 'church', 1)]),
    ('holmes-groom-walk.png', [('actor/holmes-church-walk.png',  1.87, 'church', 4)]),
]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()
    log = {'when': dt.datetime.now().isoformat(timespec='seconds'), 'writes': []}

    def land(src, dst, how, **kw):
        rec = {'dst': dst, 'src': src, 'how': how,
               'sha_before': sha(dst) if os.path.exists(dst) else None}
        if not a.dry:
            if how == 'copy':
                shutil.copy2(src, dst)
            else:
                rec.update(shrink(src, dst, kw['target_h'], kw.get('cells', 1)))
            rec['sha_after'] = sha(dst)
        log['writes'].append(rec); print(json.dumps(rec))

    for name, ships in PLAN:
        out = os.path.join(R, 'out', name)
        if not os.path.exists(out):
            print(json.dumps({'skip': name, 'why': 'no accepted output'})); continue
        land(out, os.path.join(BOOK_ACTORS, name), 'copy')
        for rel, h_m, st, cells in ships:
            land(os.path.join(BOOK_ACTORS, name), os.path.join(LIVE, rel), 'shrink',
                 target_h=round(PX_PER_M[st] * h_m * 3), cells=cells)

    kx = os.path.join(R, 'out/king-walk-exit.png')
    if os.path.exists(kx):
        land(kx, os.path.join(BEAT1, 'king-walk-exit.png'), 'copy')
        land(os.path.join(BEAT1, 'king-walk-exit.png'),
             os.path.join(LIVE, 'actor/king-walk-exit.png'), 'copy')

    if not a.dry:
        json.dump(log, open(os.path.join(R, 'SHIP.json'), 'w'), indent=1)
    print(json.dumps({'ship_done': True, 'writes': len(log['writes'])}))


main()
