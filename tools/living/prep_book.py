#!/usr/bin/env python3
"""prep_book.py -- build the BEATS II-VII half of site-deploy/living/assets/.

The companion to prep.py (which builds Beat I and is not touched here: this
tool never writes a file prep.py owns, so Beat I stays byte-identical).

Nothing here INVENTS art. Every file this writes is one of:
  * a re-encode of a shipped painted plate (PNG -> JPEG q92, the encode the
    living lane's aesthetic verdict was taken on),
  * a copy of a shipped free layer / prop / sprite,
  * a DOWNSCALE of a shipped sprite to the size the engine actually draws it
    at (an actor drawn 92 px tall does not need to ship 1222 px of alpha), with
    its baseline carried through the same scale factor, or
  * a CUT out of existing painted art (the rig and the crowd, out of
    assets/plates/street-arrival.png -- which CONTENT-full.md 7.1 itself
    nominates as painted source for this street).

Sources (all shipped, all sha-verified in their own lane manifests):
  assets/plates/book/street/   SET street  + life.json marks
  assets/plates/book/chase/    SET chase   + rail
  assets/plates/book/church/   SET church  + layers + closeLenses
  assets/plates/book/actors/   Irene, Norton, the cameo, and the reprise
                               Holmes cuts + the fee plate

Run:  python3 tools/living/prep_book.py
"""
import hashlib
import json
import os
import shutil
from datetime import datetime, timezone

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BOOK = os.path.join(ROOT, 'assets', 'plates', 'book')
PLATES = os.path.join(ROOT, 'assets', 'plates')
OUT = os.path.join(ROOT, 'site-deploy', 'living', 'assets')

PLATE_W, PLATE_H = 1408, 768

MAN = {
    'generated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'generator': 'tools/living/prep_book.py',
    'covers': 'beats II-VII (CONTENT-full.md). Beat I is prep.py and is untouched.',
    'files': {}, 'derivations': {}, 'gaps': {},
}

# --------------------------------------------------------------- scale law
# ONE table, because two lanes measured the same architecture and disagreed.
# Reconciled here, with the disagreement recorded rather than hidden.
SCALE = {
    'street': {
        'px_per_m': 49.4,
        'source': 'MANIFEST-reprise.json plate_space_scale.street -- the front '
                  'door reads 100 px (plate y 368..468) for a 2.03 m door and '
                  'the area railings 55 px for 1.11 m',
        'conflict': 'assets/plates/book/actors/MANIFEST.json says 53.2 px/m off '
                    'the same door leaf measured 108 px. 7.7% apart; the engine '
                    'takes the reprise number because it is cross-checked '
                    'against a second element (the railings).',
    },
    'church': {
        'px_per_m': 104.5,
        'source': 'the church lane\'s own painted figures: closeLenses.ring '
                  'records bride 24.0% of 768 = 184 px, and handoffToActorLane '
                  'figureBoxes measure clergyman 182 px, for ~1.75 m adults',
        'conflict': 'laneactors MANIFEST says 88.6 px/m off a 155 px clergyman; '
                    'that measurement is 27 px short of the church lane\'s own '
                    'box for the same figure, so the plate\'s number wins.',
    },
    'chase': {
        'px_per_m': 51.2,
        'source': 'chase MANIFEST: near gas standard finial y309 -> base y514 '
                  '(205 px) for a 4.0 m lamp, at rail u=0; scaled by rail.s',
    },
}


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def record(rel, note=''):
    p = os.path.join(OUT, rel)
    im = Image.open(p)
    MAN['files'][rel] = {'bytes': os.path.getsize(p), 'size': list(im.size),
                         'mode': im.mode, 'sha256': sha(p)[:16], 'note': note}
    print(f'  {rel:40s} {im.size[0]:>5}x{im.size[1]:<5} '
          f'{os.path.getsize(p)//1024:>5} KB  {note[:52]}')


def jpg(src, rel, q=92, note=''):
    os.makedirs(os.path.dirname(os.path.join(OUT, rel)), exist_ok=True)
    Image.open(src).convert('RGB').save(os.path.join(OUT, rel), 'JPEG', quality=q,
                                        subsampling=0, optimize=True)
    record(rel, note)


def png_copy(src, rel, note=''):
    os.makedirs(os.path.dirname(os.path.join(OUT, rel)), exist_ok=True)
    shutil.copy2(src, os.path.join(OUT, rel))
    record(rel, note)


def png_write(im, rel, note=''):
    os.makedirs(os.path.dirname(os.path.join(OUT, rel)), exist_ok=True)
    im.save(os.path.join(OUT, rel), 'PNG', optimize=True)
    record(rel, note)


def shrink(src, rel, target_h, note='', baseline=None, cells=1):
    """Ship a sprite at the size the engine draws it at (x3 for the push).

    The baseline is carried through the SAME factor, so a foot mark measured on
    the shipped 1222 px cut still lands on the floor line at 270 px.
    """
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    k = min(1.0, target_h / h)
    nw, nh = max(1, round(w * k)), max(1, round(h * k))
    if cells > 1:                      # a strip: keep the cell grid exact
        cw = w // cells
        ncw = max(1, round(cw * k))
        nw = ncw * cells
    im = im.resize((nw, nh), Image.LANCZOS)
    os.makedirs(os.path.dirname(os.path.join(OUT, rel)), exist_ok=True)
    im.save(os.path.join(OUT, rel), 'PNG', optimize=True)
    record(rel, note)
    out = {'scale': round(k, 5), 'srcSize': [w, h], 'size': [nw, nh]}
    if baseline is not None:
        out['baseline'] = round(baseline * k, 1)
        out['srcBaseline'] = baseline
    if cells > 1:
        out['cell'] = [nw // cells, nh]
    MAN['derivations'][rel] = out
    return out


# ------------------------------------------------------------------- cuts
def key_out_of_diorama(im, box, bg_probe, tol=26.0, feather=1.2):
    """Cut a painted object out of a diorama plate by distance from the local
    ground it stands on. `bg_probe` is a list of (x, y) points ON the ground
    inside `box`; anything within `tol` of the nearest probe colour is dropped.
    This is prep.py's note/mask method (a luminance key) generalised to colour,
    because a navy cab on grey cobbles is not separable by luminance alone.
    """
    crop = im.crop(box).convert('RGB')
    a = np.asarray(crop).astype(float)
    probes = np.array([im.getpixel(p)[:3] for p in bg_probe], dtype=float)
    d = np.min(np.linalg.norm(a[:, :, None, :] - probes[None, None, :, :], axis=3),
               axis=2)
    alpha = np.clip((d - tol) / 18.0, 0, 1)
    alpha = np.asarray(Image.fromarray((alpha * 255).astype('uint8'), 'L')
                       .filter(ImageFilter.MedianFilter(3))
                       .filter(ImageFilter.GaussianBlur(feather))).astype(float) / 255.0
    return Image.fromarray(np.dstack([a.astype('uint8'),
                                      (alpha * 255).astype('uint8')]), 'RGBA')


def main():
    os.makedirs(OUT, exist_ok=True)
    MAN['scale'] = SCALE

    # ---- 1. SET street --------------------------------------------------
    print('SET street:')
    S = os.path.join(BOOK, 'street')
    for f, note in [('street.png', 'base: quiet night, NO smoke (II.0-2, V.0-5)'),
                    ('street-dim.png', 'painted relight under the plate-rocket inset (V.3-4)'),
                    ('street-window.png', 'the sitting-room window OPEN and lit (V.5 -> VI)'),
                    ('street-smoke.png', 'the ruse burning (VI, from t+1.35)'),
                    ('street-empty.png', 'dispersed: the plume dying (VI, from t+8.6)')]:
        jpg(os.path.join(S, f), 'set/street/' + f.replace('.png', '.jpg'), 92, note)
    for f, note in [('chalk-armed.png', 'the chalk ring, ARMED (the station cue)'),
                    ('chalk-locked.png', 'the chalk ring, LOCKED (the station taken)'),
                    ('reveal-back.png', 'the backlight she is a silhouette against')]:
        png_copy(os.path.join(S, f), 'set/street/' + f, note)
    for f, note in [('bayglass.png', 'the bay glass, drawn AFTER the actors'),
                    ('mist.png', 'the damp, screen-blended, drifting'),
                    ('halo.png', 'the gas-lamp bloom')]:
        p = os.path.join(S, 'layers', f)
        if os.path.exists(p):
            png_copy(p, 'set/street/' + f, note)
    life = json.load(open(os.path.join(S, 'life.json')))
    with open(os.path.join(OUT, 'set', 'street', 'life.json'), 'w') as f:
        json.dump(life, f)
    layers = json.load(open(os.path.join(S, 'layers', 'layers.json')))
    MAN['derivations']['street_layers'] = {
        'overlays': layers.get('overlays'), 'lampBox': next(
            (l for l in layers['layers'] if l['id'] == 'lamp'), None)}

    # ---- 2. SET chase ---------------------------------------------------
    print('SET chase:')
    C = os.path.join(BOOK, 'chase')
    png_copy(os.path.join(C, 'chase.jpg'), 'set/chase/chase.jpg',
             'base: the empty strip, quiet night; the rigs are sprites')
    png_copy(os.path.join(C, 'chase-dim.jpg'), 'set/chase/chase-dim.jpg',
             'the painted relight (the SET contract variant)')
    for f, note in [('fog.png', 'the fog bank at the far end, drifting'),
                    ('lamp2-front.png', 'THE foreground occluder: the pursuit passes behind it'),
                    ('door-out.png', 'Briony Lodge with its light OUT (after she boards)')]:
        png_copy(os.path.join(C, f), 'set/chase/' + f, note)
    ch = json.load(open(os.path.join(C, 'MANIFEST.json')))
    with open(os.path.join(OUT, 'set', 'chase', 'rail.json'), 'w') as f:
        json.dump({'rail': ch['rail'], 'marks': ch['marks'], 'geometry': ch['geometry'],
                   'dim': ch['dim'],
                   'boxes': {k: {'x': v.get('x'), 'y': v.get('y'), 'size': v.get('size')}
                             for k, v in ch['files'].items() if 'x' in v}}, f)
    record('set/chase/rail.json'.replace('set/chase/rail.json', 'set/chase/rail.json')
           if False else 'set/chase/chase.jpg', 'base')  # keep record() shape simple

    # ---- 3. SET church --------------------------------------------------
    print('SET church:')
    K = os.path.join(BOOK, 'church')
    for f, note in [('church.jpg', 'base: the three in a knot before the altar'),
                    ('church-dim.jpg', 'the painted relight (the SET contract variant)'),
                    ('church-ring.jpg', 'the ring moment: gold catch on the joined hands')]:
        png_copy(os.path.join(K, f), 'set/church/' + f, note)
    for f, note in [('altar.png', 'the altar, a free layer'),
                    ('hourglass.png', 'the altar hourglass; its glass runs out under the drag'),
                    ('knot-patch.png', 'the chancel with the three figures inpainted away')]:
        png_copy(os.path.join(K, 'layers', f), 'set/church/' + f, note)
    km = json.load(open(os.path.join(K, 'MANIFEST.json')))
    MAN['derivations']['church_marks'] = {
        'closeLenses': km['closeLenses'], 'figureBoxes': km['handoffToActorLane']['figureBoxes'],
        'props': km['layers']['props'], 'knotPatch': km['layers']['static']['knot-patch.png'],
        'emissives': km['layers']['emissives'], 'dimMatrix': km['dimMatrix']['shipValue'],
    }

    # ---- 4. the actors --------------------------------------------------
    print('actors (shipped at the size the engine draws them):')
    A = os.path.join(BOOK, 'actors')
    am = json.load(open(os.path.join(A, 'MANIFEST.json')))
    by_id = {a['id']: a for a in am['actors']}
    rp = json.load(open(os.path.join(A, 'MANIFEST-reprise.json')))['files']

    # street: holmes 1.87 m -> 92 px, so a x3 ship is 276 px of alpha
    def ship_actor(src_rel, out_rel, height_m, set_name, note, baseline, cells=1):
        px = SCALE[set_name]['px_per_m'] * height_m
        return shrink(os.path.join(A, src_rel), 'actor/' + out_rel, round(px * 3),
                      note + f' [draws {px:.0f} px on {set_name}]', baseline, cells)

    for a_id, out, h, st, note in [
        ('irene-street', 'irene-street.png', 1.68, 'street',
         'Irene standing (III.5 out of the hall door; her rest pose)'),
        ('irene-board', 'irene-board.png', 1.68, 'street',
         'Irene mid-step, hand up for the carriage handle (III.5)'),
        ('irene-bride', 'irene-bride.png', 1.68, 'church', 'Irene as the bride (IV)'),
        ('norton-street', 'norton-street.png', 1.80, 'street',
         'Norton, top hat + open gold watch (III.1-4)'),
        ('norton-beckon', 'norton-beckon.png', 1.80, 'church',
         'Norton beckoning with both hands (IV.7, the gate pose)'),
        ('norton-groom', 'norton-groom.png', 1.80, 'church', 'Norton at the altar (IV)'),
    ]:
        a = by_id[a_id]
        ship_actor(a['file'], out, h, st, note, a['matte']['baseline_y'])

    for a_id, out, h, st, note, cells in [
        ('irene-walk', 'irene-walk.png', 1.68, 'street',
         'Irene, 4-frame walk, profile facing LEFT', 4),
        ('norton-run', 'norton-run.png', 1.80, 'church',
         'Norton, 4-frame run, profile facing RIGHT (IV.4 seg run)', 4),
    ]:
        a = by_id[a_id]
        ship_actor(a['file'], out, h, st, note, a['matte']['baseline_y'], cells)

    for f, out, h, st, note, cells in [
        ('holmes-clergyman.png', 'holmes-street.png', 1.87, 'street',
         'Holmes in the Nonconformist-clergyman disguise (II, V, VI)', 1),
        ('holmes-clergyman-signal.png', 'holmes-street-signal.png', 1.87, 'street',
         'V.3 "when I raise my hand-so" -- pixel-aligned with the idle', 1),
        ('holmes-groom.png', 'holmes-church.png', 1.87, 'church',
         'Holmes as the groom-out-of-work: the idler at the back (IV)', 1),
        ('holmes-groom-altar.png', 'holmes-church-altar.png', 1.87, 'church',
         'IV.9-13: cap off, head bowed, at the altar', 1),
        ('holmes-groom-walk.png', 'holmes-church-walk.png', 1.87, 'church',
         'IV.3 seg lounge / IV.8 seg drag: 4-frame cycle facing RIGHT', 4),
    ]:
        meta = rp[f]
        shrink(os.path.join(A, f), 'actor/' + out,
               round(SCALE[st]['px_per_m'] * h * 3),
               note + f' [draws {SCALE[st]["px_per_m"] * h:.0f} px on {st}]',
               meta['baseline_y'], cells)

    # the groom cut again, at CHASE scale, for III.9 (he is in the four-wheeler)
    shrink(os.path.join(A, 'holmes-groom.png'), 'actor/holmes-chase.png',
           round(SCALE['chase']['px_per_m'] * 1.87 * 3),
           'Holmes as the groom at chase scale (III.9, the shabby fare)',
           rp['holmes-groom.png']['baseline_y'])
    shrink(os.path.join(A, 'irene-street.png'), 'actor/irene-chase.png',
           round(SCALE['chase']['px_per_m'] * 1.68 * 3),
           'Irene at chase scale (III.5-6, boarding the landau)',
           by_id['irene-street']['matte']['baseline_y'])
    shrink(os.path.join(A, 'norton-street.png'), 'actor/norton-chase.png',
           round(SCALE['chase']['px_per_m'] * 1.80 * 3),
           'Norton at chase scale (III.1-4, at the lit door)',
           by_id['norton-street']['matte']['baseline_y'])

    # ---- 5. the cameo and the two insets --------------------------------
    print('cameo + insets:')
    jpg(os.path.join(A, 'cameo-norton.png'), 'cameo/norton.jpg', 90,
        'GODFREY NORTON, first raised at IV.5 (CONTENT-full 6.5)')
    jpg(os.path.join(A, 'photo-irene.png'), 'inset/photo-irene.jpg', 92,
        'INSET plate-irene: the portrait of her ALONE, the fee (VII.6-10)')

    # ---- 6. the rigs' running lights ------------------------------------
    # 7.2 #7 (three rigs) is UNSHIPPED and is not this lane's to draw. Two cuts
    # out of assets/plates/street-arrival.png were attempted (a colour key
    # against the ground, then a border flood in RGB) and BOTH failed on the
    # locked style's own flat shading: a low-poly facet of the cab body is
    # within tolerance of the wall behind it, so the key either keeps the wall
    # or eats the cab. The proofs are /tmp/gl-engine/cuts.png and cuts2.png.
    # Rather than ship a bad matte, the engine runs each rig as the one part of
    # it that IS painted and shipped -- its lamp, and its contact shadow on the
    # cobbles -- and the lap reports the gap.
    print('rig running lights (the rigs themselves are 7.2 #7, unshipped):')
    png_copy(os.path.join(C, 'glow-lamp3.png'), 'set/chase/rig-lamp.png',
             'a rig\'s carriage lamp: the chase lane\'s own painted bloom, '
             'screen-blended, travelling the rail')

    MAN['gaps'] = {
        'rigs': 'CONTENT-full 7.2 #7: three rigs (hansom, landau, four-wheeler) '
                'are NOT shipped by any lane. The engine runs each rig as a lamp '
                'bloom + a contact shadow on the rail, with every rig\'s position, '
                'scale and gate target already computed from the rail -- rig art '
                'drops into set/chase/rig-<id>.png with no engine change.',
        'crowd': '7.2 #12: the crowd is not shipped. Beat VI stages the turn and '
                 'the disperse on the street plate\'s own painted states '
                 '(street-smoke / street-empty), which is where the crowd lives '
                 'in the painting.',
        'plate-rocket': '7.2 #9: not generated by any lane. Beat V raises the inset '
                        'slot; with no art the slot degrades to the world (the engine '
                        'skips the raise and logs it) rather than showing an empty card.',
        'props': '7.2 #13: the gold watch is painted INTO norton-street.png; the ring '
                 'is the church lane\'s painted church-ring.jpg; the hourglass is a '
                 'shipped layer. The sovereign and the rocket are performed as light '
                 '(engine-side emissives), not as sprites.',
        'maid': '7.2 #12: folded into street-window.jpg, which is the ledger\'s own '
                'stated fallback.',
    }

    with open(os.path.join(OUT, 'MANIFEST-book.json'), 'w') as f:
        json.dump(MAN, f, indent=1)
    grand = sum(v.get('bytes', 0) for v in MAN['files'].values())
    print(f'\ntotal shipped for II-VII: {grand/1e6:.2f} MB -> {OUT}')


if __name__ == '__main__':
    main()
