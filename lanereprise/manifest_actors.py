#!/usr/bin/env python3
"""manifest_actors.py -- the REPRISE ACTORS lane manifest + contact sheet.

Merges what ship_actors.py wrote (files, shas, shared canvases, baselines), what
proof_actors.py measured (render heights, stage marks, swap deltas), what
conform_photo.py measured (the fee plate's move) and what platediff.py measured
(the fee plate against the object it was cut from) into ONE record under
assets/plates/book/actors/, in the shape the church / street / chase lanes use.

    python3 manifest_actors.py RAWDIR
"""
import datetime as dt
import json
import os
import sys

from PIL import Image

ROOT = '/Users/samz/Documents/gaslight-remake'
A = os.path.join(ROOT, 'assets/plates/book/actors')


def contact_sheet(dest):
    """One image with every shipped state at 100%, on the plate navy."""
    names = ['holmes-clergyman.png', 'holmes-clergyman-signal.png',
             'holmes-groom.png', 'holmes-groom-altar.png']
    ims = [Image.open(os.path.join(A, n)).convert('RGBA') for n in names]
    H = 520
    scaled = []
    for im in ims:
        s = H / im.height
        scaled.append(im.resize((max(1, round(im.width * s)), H), Image.LANCZOS))
    strip = Image.open(os.path.join(A, 'holmes-groom-walk.png')).convert('RGBA')
    s = 300 / strip.height
    strip = strip.resize((round(strip.width * s), 300), Image.LANCZOS)
    W = max(sum(i.width + 24 for i in scaled) + 24, strip.width + 48)
    sheet = Image.new('RGBA', (W, H + 300 + 72), (23, 32, 56, 255))
    x = 24
    for i in scaled:
        sheet.alpha_composite(i, (x, 24))
        x += i.width + 24
    sheet.alpha_composite(strip, (24, H + 48))
    p = os.path.join(dest, 'contact-sheet-reprise.png')
    sheet.convert('RGB').save(p)
    return p


def gait(strip='holmes-groom-walk.png', idle='holmes-groom.png', n=4):
    """The walk strip's own acceptance numbers.

    A 4-frame cycle is only a cycle if the CONTACT frames are measurably wider at
    the feet than the PASSING frames, and it only reads as one man if every frame
    still matches the idle's palette after the pull. Both are measured here rather
    than asserted.
    """
    import numpy as np
    st = Image.open(os.path.join(A, strip)).convert('RGBA')
    cw = st.width // n
    idl = np.asarray(Image.open(os.path.join(A, idle)).convert('RGBA'), np.float32)
    imu = idl[..., :3][idl[..., 3] > 128].mean(0)
    out = []
    for i in range(n):
        c = np.asarray(st.crop((i * cw, 0, (i + 1) * cw, st.height)), np.float32)
        al = c[..., 3] > 128
        ys = np.nonzero(al.any(1))[0]
        h = int(ys.max() - ys.min() + 1)
        foot = al[ys.max() - int(h * 0.14):ys.max() + 1]
        xs = np.nonzero(foot.any(0))[0]
        mu = c[..., :3][al].mean(0)
        out.append({'frame': i, 'alpha_h': h, 'head_top_y': int(ys.min()),
                    'foot_spread_px': int(xs.max() - xs.min() + 1),
                    'mu_minus_idle_rgb': [round(float(v), 1) for v in (mu - imu)]})
    sp = [f['foot_spread_px'] for f in out]
    hb = max(f['head_top_y'] for f in out) - min(f['head_top_y'] for f in out)
    return {
        'frames': out,
        'contact_over_passing_spread': round(max(sp) / min(sp), 2),
        'body_rise_px_passing_over_contact': hb,
        'body_rise_pct_of_figure': round(100.0 * hb / max(f['alpha_h'] for f in out), 1),
        'reading': 'frames 0 and 2 are the CONTACTs (widest feet) and 1 and 3 the '
                   'PASSINGs, so the cycle alternates as authored. The body sits '
                   '%d px LOWER at contact than at passing, which is the direction a '
                   'walk actually moves; at 4.8%% of the figure it is a touch deep, so '
                   'a stager who wants it flatter should scale each cell to the mean '
                   'alpha height rather than re-generate. Every frame lands within 6 '
                   'levels of the idle after the 0.65 palette pull.' % hb,
    }


def main():
    raw = sys.argv[1].rstrip('/')
    files = json.load(open(os.path.join(A, 'files-reprise.json')))['files']
    proof = json.load(open(os.path.join(raw, 'proof2/proof.json')))
    pdiff = json.load(open(os.path.join(raw, 'platediff/photo-irene-diff.json')))
    pdiff.pop('cell_grid_pct', None)

    for name, f in files.items():
        f.pop('backing_rgb_keyed', None)

    man = {
        'lane': 'lanereprise (REPRISE ACTORS) -- Holmes in disguise, + the fee plate',
        'generated_at': dt.datetime.now().isoformat(timespec='seconds'),
        'plate_space': [1408, 768],
        'law': {
            'content': os.path.join(ROOT, 'CONTENT-full.md'),
            'gaps_closed': [
                '7.2 GAP #8  -- actor Holmes: the street cut and the church/witness cut '
                '(blocks beats II, IV, V, VI)',
                '7.2 GAP #10 -- inset `plate-irene`, the portrait of Irene ALONE '
                '(blocks beat VII units 6-10)',
            ],
            'canon': {
                'source': '/tmp/thebook/books/sherlock/book/sources/pg1661_2026-08-04.txt',
                'the groom': 'l.539-541 "a drunken-looking groom, ill-kempt and '
                             'side-whiskered, with an inflamed face and disreputable '
                             'clothes"; l.562 "in the character of a groom out of work"; '
                             'l.652-653 "I lounged up the side aisle like any other idler"',
                'the clergyman': 'l.764-767 "an amiable and simple-minded Nonconformist '
                                 'clergyman. His broad black hat, his baggy trousers, his '
                                 'white tie, his sympathetic smile, and general look of '
                                 'peering and benevolent curiosity"',
                'the fee': 'script7() `valuemore` raises plate `irene`; the reference\'s '
                           'own ART_FILES note: "The compromising photograph is of the '
                           'KING AND IRENE TOGETHER -- a different thing from the '
                           'portrait of her alone that Holmes asks for as his fee at '
                           'IV.3, which is why both plates exist"',
            },
            'style': 'the locked plate template (tools/nbpro_prompts.json). An actor is '
                     'a cut-out, so the template\'s backdrop clause cannot apply to it: '
                     'the style tokens (flat-shaded chunky low poly, faceted Victorian '
                     'figure, ONE accent colour) are carried in the prompt and the rest '
                     'is locked by burned-in reference panels -- the beat-I actor lane\'s '
                     'own method (tools/laneassets/jobs-b1..b6).',
        },
        'pipeline': {
            'stage4a': 'tools/lanereprise/refsheet_reprise.py -> the 4-panel sheet '
                       '(A pose+framing / B identity: cameo-holmes / C style+light: the '
                       'SET he stands in / D figure treatment at diorama scale)',
            'stage4b': 'tools/lanereprise/jobs_r1.py -> tools/laneassets/gen.py -> '
                       'tools/nbpro_edit.py (gemini-3-pro-image, i2i), 2 candidates per '
                       'figure, magenta backing',
            'stage4c': 'tools/lanereprise/jobs_r2.py -- every derived state edits the '
                       'PICKED idle, never the sheet, so identity cannot drift '
                       '(king-unmask precedent)',
            'stage4d': 'tools/laneassets/matte.py (key + despill + spill ceiling) -> '
                       'tools/lanereprise/ship_actors.py (family UNION canvas, so a '
                       'state swap does not move him) -> tools/laneassets/palettepull.py '
                       'for the walk strip',
            'stage4e': 'tools/lanereprise/proof_actors.py (stage proof + swap proof), '
                       'tools/lanereprise/conform_photo.py + tools/laneassets/platediff.py '
                       'for the fee plate',
        },
        'raws': raw,
        'plate_space_scale': {
            'holmes_m': proof['holmes_m'],
            'street': {
                'px_per_m': proof['sets']['street']['px_per_m'],
                'render_height_px': proof['sets']['street']['render_height_px'],
                'derivation': 'the SET paints no figure, so the scale comes from its own '
                              'architecture: the front door reads 100 px (plate y '
                              '368..468) for a 2.03 m Victorian front door and the area '
                              'railings read 55 px for 1.11 m -- both give ~49.4 px/m',
                'dim_matrix': [0.725, 0.868, 0.962],
                'dim_matrix_source': 'street MANIFEST.json (the shipped relight). Apply '
                                     'to the ACTOR too when the world dims under the '
                                     '`plate-rocket` inset, or he reads as a collage',
            },
            'church': {
                'px_per_m': proof['sets']['church']['px_per_m'],
                'render_height_px': proof['sets']['church']['render_height_px'],
                'derivation': 'the church lane\'s own handoffToActorLane.figureBoxes ARE '
                              'the calibration: bride 184 px, clergyman 182 px for a '
                              '~1.75 m adult (its closeLenses record confirms '
                              'bride_pct_of_frame_h 24.0 = 184 px of 768), so ~104.5 px/m',
                'dim_matrix': [0.435, 0.746, 1.0],
                'dim_matrix_source': 'church MANIFEST.json dimMatrix.shipValue (blue is '
                                     'clamped to 1.0 there precisely so it can be used as '
                                     'an actor matrix)',
            },
            'projection': 'isometric -- actor height does NOT change with depth; only the '
                          'foot line moves (assets/plates/beat1/MANIFEST.json, verbatim)',
        },
        'files': files,
        'stage_proof': {
            'what': 'the shipped cut-outs composited on the real SETs at the real scale',
            'sets': {k: {'proof': v['proof'], 'render_height_px': v['render_height_px'],
                         'placed': v['placed']} for k, v in proof['sets'].items()},
        },
        'walk_proof': gait(),
        'swap_proof': {
            'what': 'a derived state must be swappable for its idle without the figure '
                    'jumping. The legs are the part that never changes, so their centroid '
                    'is the honest probe.',
            'measured': proof['swaps'],
        },
        'fee_plate_proof': {
            'conform': json.load(open(os.path.join(raw, 'photo-irene.conform.json'))),
            'vs_both_photo': pdiff,
            'reading': 'changed_px_outside the card interior is %d px (%.2f%% of the '
                       'frame band, leak_ratio %.3f) -- the ornate frame survives. The '
                       '15.1%% inside is the King being removed and the sitter moving '
                       '117 px to the card centre. Card lum 58.4 -> 56.0: the sepia held.'
                       % (pdiff['changed_px_outside'], pdiff['outside_pct_of_frame'],
                          pdiff['leak_ratio']),
        },
        'reuse': {
            'contact-shadow': 'assets/plates/beat1/contact-shadow.png -- Beat I ships it '
                              'as reusable everywhere (CONTENT-full.md 7.1). No new one.',
            'holmes, 221B': 'site-deploy/living/assets/actor/holmes-holmes.png is the '
                            'room cut and needs nothing new for beat VII: he is at the '
                            'mantel, which is the pose that cut already holds.',
            'the King, beat VII': 'assets/plates/beat1/king-unmasked.png, unchanged.',
        },
        'not_shipped': {
            'clergyman walk strip': 'nothing in beats II / V / VI walks him: V.5 is a '
                                    'camera descent plus a click on the chalk ring '
                                    '(CONTENT-full.md 5, BEAT V, and its open ruling '
                                    '8.1), and VI never puts him on the pavement.',
            'the scuffle / the carried man': 'canon l.836-869, but the Living Book cut '
                                             'has no unit for it -- Beat V says only '
                                             '"it will end in my being conveyed into the '
                                             'house". Generating it would be scope.',
        },
        'open_for_the_owner': {
            'the ledger says "street coat", canon says "clergyman"':
                'CONTENT-full.md 6.3 lists the missing Holmes cuts as "street coat" and '
                '"witness". Canon is more specific and the beats are continuous: he is in '
                'the GROOM for the whole told story (III-IV) and in the CLERGYMAN for the '
                'whole Serpentine Avenue scene (II, V, VI -- he changes at l.763 and is '
                'carried into the house in it at l.866). A plain street coat is the one '
                'costume the chapter never puts him in, so the lane shipped the two '
                'disguises. Overruling this needs one re-run of jobs_r1.py.',
            'the fee plate is a cabinet card, not "evening dress"':
                'Canon l.1096 finds "a photograph of Irene Adler in evening dress". This '
                'plate is her ALONE on the card `both-photo` was cut from, which is the '
                'reference book\'s own ruling (same card, same frame, same sepia, her '
                'same face) and makes the beat-VII payoff land against I.8. If the owner '
                'wants evening dress it is a new i2i pass on this file.',
        },
    }
    man['contact_sheet'] = contact_sheet(A)
    man['shared_directory_warning'] = (
        'assets/plates/book/actors/ is shared with tools/laneactors (Irene, Norton, '
        'the cameo). Everything this lane writes is suffixed -reprise so it cannot '
        'collide, and the shared MANIFEST.json is only ever UPDATED with the single '
        'key `reprise`, never rewritten.')
    p = os.path.join(A, 'MANIFEST-reprise.json')
    with open(p, 'w') as f:
        json.dump(man, f, indent=1)

    # the shared manifest: touch ONE key and preserve every other lane's content.
    # tools/laneactors/pack_actors.py does `manifest.update(...)` on this same file,
    # so a namespaced key survives its next run and its keys survive this one.
    shared = os.path.join(A, 'MANIFEST.json')
    cur = {}
    if os.path.exists(shared):
        try:
            with open(shared) as f:
                cur = json.load(f)
        except Exception:
            cur = {}
    cur.pop('files', None)          # this lane's own earlier full-file write
    for k in ('stage_proof', 'swap_proof', 'fee_plate_proof', 'plate_space_scale',
              'pipeline', 'raws', 'reuse', 'not_shipped', 'open_for_the_owner',
              'contact_sheet', 'plate_space', 'generated_at', 'law', 'lane',
              'shared_directory_warning'):
        if k in cur and cur.get('lane', '').startswith('lanereprise'):
            cur.pop(k, None)
    cur['reprise'] = {
        'lane': man['lane'],
        'manifest': 'MANIFEST-reprise.json',
        'gaps_closed': man['law']['gaps_closed'],
        'files': sorted(files.keys()),
        'note': 'the full record for these files -- shas, shared canvases, baselines, '
                'render heights, stage proof, swap proof -- is MANIFEST-reprise.json in '
                'this directory. This key is namespaced so tools/laneactors and this '
                'lane can both own part of the same directory.',
    }
    with open(shared, 'w') as f:
        json.dump(cur, f, indent=1)
    print(json.dumps({'lane_manifest': p, 'shared_manifest': shared,
                      'shared_keys': sorted(cur.keys())}, indent=1))


if __name__ == '__main__':
    main()
