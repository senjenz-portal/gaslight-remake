#!/usr/bin/env python3
"""prep.py -- build site-deploy/living/assets/ out of the lanes' painted art.

Nothing here INVENTS art. Every file this writes is one of:
  * a copy (actors, walk strips, the Holmes puppet parts, the chair occluder),
  * a re-encode (the opaque full-frame plates -> JPEG q92, which is what the
    living-plate lane shipped and what the aesthetic verdict was taken on),
  * a CUT out of existing painted art (the note prop, the mask prop, the
    Holmes hole-patch), or
  * a relight TRANSFER of such a cut, so a patch made from the bright plate
    still matches when the room dims (the ratio comes from the two painted
    plates themselves, not from a guess at a brightness value).

Run:  python3 tools/living/prep.py
"""
import hashlib
import json
import os
import shutil
from datetime import datetime, timezone

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC_PLATES = os.path.join(ROOT, 'assets', 'plates')
SRC_BEAT1 = os.path.join(SRC_PLATES, 'beat1')
SRC_AUDIO = os.path.join(ROOT, 'assets', 'audio')
SRC_LP = os.path.join(ROOT, 'site-deploy', 'king-demo', 'living-plate')
SRC_MATTE = os.path.join(ROOT, 'assets', 'raw', 'lanea-actors', '20260811-184321', 'matte')
OUT = os.path.join(ROOT, 'site-deploy', 'living', 'assets')

PLATE_W, PLATE_H = 1408, 768
MAN = {'generated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
       'generator': 'tools/living/prep.py', 'files': {}, 'derivations': {}}


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
    print(f'  {rel:44s} {im.size[0]:>5}x{im.size[1]:<5} {os.path.getsize(p)//1024:>5} KB  {note}')


def jpg(src, rel, q=92, note=''):
    os.makedirs(os.path.dirname(os.path.join(OUT, rel)), exist_ok=True)
    Image.open(src).convert('RGB').save(os.path.join(OUT, rel), 'JPEG', quality=q,
                                        subsampling=0, optimize=True)
    record(rel, note)


def png(im, rel, note=''):
    os.makedirs(os.path.dirname(os.path.join(OUT, rel)), exist_ok=True)
    im.save(os.path.join(OUT, rel), 'PNG', optimize=True)
    record(rel, note)


def copy(src, rel, note=''):
    os.makedirs(os.path.dirname(os.path.join(OUT, rel)), exist_ok=True)
    shutil.copy2(src, os.path.join(OUT, rel))
    record(rel, note)


def main():
    os.makedirs(OUT, exist_ok=True)

    # ---- 1. the room plates -------------------------------------------
    print('plates:')
    jpg(os.path.join(SRC_BEAT1, 'plate-door.png'), 'plate/room.jpg', 92,
        'base set: backdrop + the closed entrance door')
    jpg(os.path.join(SRC_BEAT1, 'plate-door-open.png'), 'plate/room-open.jpg', 92,
        'units 11 + 37: the door standing open')
    jpg(os.path.join(SRC_BEAT1, 'plate-door-darker.png'), 'plate/room-dim.jpg', 92,
        'the painted relight the inset plates dim the world to')

    # ---- 2. the Holmes hole-patch --------------------------------------
    # The base plate has Holmes PAINTED INTO it. The actor lane cut him out and
    # inpainted the hole (plate-clean.png). Laying that hole back over the base
    # plate is what frees the puppet to breathe. The patch is a rect around his
    # cutout with a feathered edge, so no seam survives.
    print('holmes hole-patch:')
    base = Image.open(os.path.join(SRC_BEAT1, 'plate-door.png')).convert('RGB')
    backdrop = Image.open(os.path.join(SRC_PLATES, 'backdrop.png')).convert('RGB')
    clean = Image.open(os.path.join(SRC_MATTE, 'plate-clean.png')).convert('RGB')
    dim = Image.open(os.path.join(SRC_BEAT1, 'plate-door-darker.png')).convert('RGB')
    PATCH = (536, 271, 672, 549)          # Holmes cutout (558,293,89,230) + margin
    px0, py0, px1, py1 = PATCH
    a = np.asarray(base.crop(PATCH)).astype(float)
    b = np.asarray(backdrop.crop(PATCH)).astype(float)
    delta = np.abs(a - b)
    # the door edit must not have touched this rect, or the patch would seam
    MAN['derivations']['holmes_patch'] = {
        'rect': list(PATCH),
        'source': 'assets/raw/lanea-actors/20260811-184321/matte/plate-clean.png',
        'baseVsBackdropMeanAbs': round(float(delta.mean()), 3),
        'baseVsBackdropMaxAbs': int(delta.max()),
        'note': 'plate-clean is an inpaint of backdrop.png; the patch only holds '
                'if plate-door.png left this rect alone. Both numbers are that proof.'}
    print(f'  base vs backdrop in patch rect: mean {delta.mean():.3f} max {delta.max():.0f}')

    feather = 10
    m = Image.new('L', (px1 - px0, py1 - py0), 0)
    m.paste(255, (feather, feather, (px1 - px0) - feather, (py1 - py0) - feather))
    m = m.filter(ImageFilter.GaussianBlur(feather * 0.55))

    # Both patches are the SAME transfer: the clean inpaint, carried onto the
    # plate it has to sit in by that plate's own local tone. For the base plate
    # this only closes the 3.5-mean gap the door edit left in this rect; for the
    # dim plate it is the whole relight. One code path, so they cannot diverge.
    big = 41
    bl = np.asarray(backdrop.filter(ImageFilter.GaussianBlur(big)).crop(PATCH)).astype(float) + 4.0
    cl = np.asarray(clean.crop(PATCH)).astype(float)

    def transfer(target, rel, note):
        tl = np.asarray(target.filter(ImageFilter.GaussianBlur(big)).crop(PATCH)).astype(float) + 4.0
        ratio = np.clip(tl / bl, 0.25, 1.35)
        out = np.clip(cl * ratio, 0, 255).astype('uint8')
        im = Image.fromarray(out).convert('RGBA')
        im.putalpha(m)
        png(im, rel, note)
        return float(ratio.mean())

    r_lit = transfer(base, 'plate/holmes-patch.png',
                     'the inpainted hole where Holmes was painted in')
    r_dim = transfer(dim, 'plate/holmes-patch-dim.png',
                     'the same hole under the painted relight')
    MAN['derivations']['holmes_patch']['method'] = (
        f'plate-clean * blur{big}(target)/blur{big}(backdrop), clipped 0.25..1.35, '
        f'{feather}px feathered alpha')
    MAN['derivations']['holmes_patch']['meanRatioLit'] = round(r_lit, 4)
    MAN['derivations']['holmes_patch']['meanRatioDim'] = round(r_dim, 4)
    print(f'  transfer ratio: lit {r_lit:.4f}  dim {r_dim:.4f}')

    # ---- 3. the actors --------------------------------------------------
    print('actors:')
    for f, note in [('king-masked.png', 'units 11-15, the masked colossus'),
                    ('king-unmasked.png', 'units 16-35, pixel-aligned with the masked plate'),
                    ('king-walk-enter.png', '4 frames, cell 448x473, facing viewer RIGHT'),
                    ('king-walk-exit.png', '4 frames, cell 378x481, facing viewer LEFT'),
                    ('contact-shadow.png', 'ground contact under any actor')]:
        copy(os.path.join(SRC_BEAT1, f), 'actor/' + f, note)
    for f in ['holmes.png', 'part-head.png', 'part-pipe.png', 'part-torso.png',
              'part-skirt.png', 'part-legs.png']:
        copy(os.path.join(SRC_LP, 'actor', f), 'actor/holmes-' + f.replace('part-', ''),
             'sibling lane: the Holmes puppet, cut from the plate itself')
    # the sibling lane's Holmes WALK: 4 cells of 110x234, foot baseline 232 down,
    # every frame normalised to one height and one baseline by actor_sprite.py
    copy(os.path.join(SRC_LP, 'walk.png'), 'actor/holmes-walk.png',
         'sibling lane: 4 frames, cell 110x234, foot baseline 232, facing RIGHT')
    copy(os.path.join(SRC_LP, 'chair.png'), 'plate/chair.png',
         'Watson\'s armchair as a free layer, so an actor can pass BEHIND it')
    # the chair is plate pixels, so it dims with the plate, by the same transfer
    CH = (718, 335, 718 + 176, 335 + 209)
    cb = np.asarray(backdrop.filter(ImageFilter.GaussianBlur(big)).crop(CH)).astype(float) + 4.0
    cd = np.asarray(dim.filter(ImageFilter.GaussianBlur(big)).crop(CH)).astype(float) + 4.0
    ch = Image.open(os.path.join(SRC_LP, 'chair.png')).convert('RGBA')
    cha = np.asarray(ch).astype(float)
    out = np.clip(cha[..., :3] * np.clip(cd / cb, 0.25, 1.35), 0, 255)
    png(Image.fromarray(np.dstack([out, cha[..., 3]]).astype('uint8'), 'RGBA'),
        'plate/chair-dim.png', 'the same armchair under the painted relight')

    # ---- 4. the props the lanes flagged as gaps -------------------------
    print('props (cut from painted art, not invented):')
    # the NOTE: the cream sheet on the table in note-plate.png, keyed off its own
    # luminance. Holmes holds this, and raises it to the candle on the hold gate.
    npl = Image.open(os.path.join(SRC_PLATES, 'note-plate.png')).convert('RGB')
    NCROP = (470, 196, 1010, 600)
    n = np.asarray(npl.crop(NCROP)).astype(float)
    lum = 0.299 * n[..., 0] + 0.587 * n[..., 1] + 0.114 * n[..., 2]
    alpha = np.clip((lum - 96.0) / 40.0, 0, 1)
    alpha = np.asarray(Image.fromarray((alpha * 255).astype('uint8'), 'L')
                       .filter(ImageFilter.MedianFilter(5))).astype(float) / 255.0
    note_im = Image.fromarray(np.dstack([n.astype('uint8'),
                                         (alpha * 255).astype('uint8')]), 'RGBA')
    bb = note_im.getbbox()
    note_im = note_im.crop(bb).resize((160, int(160 * (bb[3] - bb[1]) / (bb[2] - bb[0]))),
                                      Image.LANCZOS)
    png(note_im, 'actor/note-prop.png', 'the note, cut out of note-plate.png by luminance')
    MAN['derivations']['note_prop'] = {'source': 'assets/plates/note-plate.png',
                                       'crop': list(NCROP), 'key': 'lum 96..136 -> alpha',
                                       'bboxAfterKey': list(bb)}

    # the MASK: the black domino off the King's own face, held inside an ellipse
    # so the collar shadow behind him cannot come with it.
    km = Image.open(os.path.join(SRC_BEAT1, 'king-masked.png')).convert('RGBA')
    # tight on the eye band ONLY. A wider box takes the brow, the temple hair
    # and the collar shadow with it, and the prop comes out a brown blob rather
    # than a domino — checked by eye at 4x before this crop was settled on.
    MCROP = (190, 48, 264, 94)
    k = np.asarray(km.crop(MCROP)).astype(float)
    klum = 0.299 * k[..., 0] + 0.587 * k[..., 1] + 0.114 * k[..., 2]
    h, w = klum.shape
    yy, xx = np.mgrid[0:h, 0:w]
    ell = ((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2 * 0.94)) ** 2
    keep = np.clip(1.0 - (ell - 0.55) / 0.45, 0, 1)          # soft ellipse
    ka = np.clip((70.0 - klum) / 22.0, 0, 1) * keep * (k[..., 3] / 255.0)
    ka = np.asarray(Image.fromarray((ka * 255).astype('uint8'), 'L')
                    .filter(ImageFilter.GaussianBlur(0.6))).astype(float) / 255.0
    mask_im = Image.fromarray(np.dstack([k[..., :3].astype('uint8'),
                                         (ka * 255).astype('uint8')]), 'RGBA')
    mask_im = mask_im.crop(mask_im.getbbox())
    png(mask_im, 'actor/mask-prop.png', 'the domino, cut off the King\'s own face')
    MAN['derivations']['mask_prop'] = {'source': 'assets/plates/beat1/king-masked.png',
                                       'crop': list(MCROP),
                                       'key': 'lum<78 inside a soft ellipse',
                                       'alphaPx': int((ka > 0.5).sum())}

    # ---- 5. the inset plates, the cameos, the leaf ----------------------
    print('insets + cameos:')
    for f, note in [('note-plate.png', 'unit 2-4: the note, as a document'),
                    ('watermark-plate.png', 'unit 5-6: the hold reveal'),
                    ('both-photo.png', 'unit 24-26: the photograph of them BOTH')]:
        jpg(os.path.join(SRC_PLATES, f), 'inset/' + f.replace('.png', '.jpg'), 92, note)
    for f in ['cameo-holmes.png', 'cameo-king-masked.png', 'cameo-king-unmasked.png',
              'cameo-irene.png', 'cameo-watson.png']:
        jpg(os.path.join(SRC_PLATES, f), 'cameo/' + f.replace('cameo-', '').replace('.png', '.jpg'),
            90, 'identity card art')
    jpg(os.path.join(SRC_PLATES, 'page-texture.png'), 'page-texture.jpg', 88, 'the leaf')

    # ---- 6. audio -------------------------------------------------------
    print('audio:')
    os.makedirs(os.path.join(OUT, 'audio'), exist_ok=True)
    total = 0
    for f in sorted(os.listdir(SRC_AUDIO)):
        if f.endswith('.mp3'):
            shutil.copy2(os.path.join(SRC_AUDIO, f), os.path.join(OUT, 'audio', f))
            total += os.path.getsize(os.path.join(OUT, 'audio', f))
    shutil.copy2(os.path.join(SRC_AUDIO, 'manifest.json'),
                 os.path.join(OUT, 'audio', 'manifest.json'))
    print(f'  11 clips + manifest, {total//1024} KB')
    MAN['files']['audio/'] = {'clips': 11, 'bytes': total}

    with open(os.path.join(OUT, 'MANIFEST.json'), 'w') as f:
        json.dump(MAN, f, indent=1)
    grand = sum(v.get('bytes', 0) for v in MAN['files'].values())
    print(f'\ntotal shipped: {grand/1e6:.2f} MB -> {OUT}')


if __name__ == '__main__':
    main()
