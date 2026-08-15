#!/usr/bin/env python3
"""setmanifest.py -- seal SET `street`: one manifest over everything the lane
landed, plus a contact sheet of the five painted states.

    python3 setmanifest.py SETDIR RAWDIR
"""
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

from PIL import Image, ImageDraw

STATES = [('street.png', 'BASE - quiet night, no smoke', 'II.0-2, V.0-5'),
          ('street-dim.png', 'DIM - painted relight under a raised inset', 'V.3-4'),
          ('street-window.png', 'WINDOW - the sitting-room sash thrown open', 'V.5 -> VI'),
          ('street-smoke.png', 'SMOKE - the ruse burning, first-floor window', 'VI, t+1.35'),
          ('street-empty.png', 'EMPTY - the plume dying', 'VI, t+8.6')]

ROLES = {
    'street.png': 'the SET. Base state: quiet night, NO smoke - the reference '
                  'stands its ruse plume UP in its authored rest state and the '
                  'book explicitly closes that gate on arrival',
    'street-dim.png': 'painted relight the plate crossfades to under the '
                      'plate-rocket inset (V.3-4)',
    'street-window.png': 'the sitting-room window OPEN and lit; the state Beat '
                         'VI is played on',
    'street-smoke.png': 'the ruse burning: plume out of the first-floor window, '
                        'its pane hot. The BAY IS UNTOUCHED - the reveal must '
                        'read through it',
    'street-empty.png': 'dispersed: the plume dying to a wisp, the hot pane cool',
    'chalk-armed.png': 'free layer: the chalk ring, ARMED (gate `station` cue)',
    'chalk-locked.png': 'free layer: the chalk ring, LOCKED (the station taken)',
    'reveal-back.png': 'free layer: the backlight she is a silhouette against; '
                       'alpha is the pane mask, so it brightens glass only',
    'life.json': 'the life pass: emissive table, mist, ground plane, and every '
                 'gate/staging mark in plate pixels',
    'proof-reveal.png': 'proof sheet: plate | figure with no glass | figure '
                        'behind the glass layer',
}


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def main():
    setdir, rawdir = sys.argv[1], sys.argv[2]
    man = {
        'lane': 'lanestreet (PLATE lane, SET `street` - Serpentine Avenue at '
                'Briony Lodge)',
        'generated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'law': 'CONTENT-full.md sec 6.2 (SET `street`), 6.4 (gates), 6.6 (the '
               'Beat VI clock), 7.2 GAP #1',
        'carries': {'units': 17, 'beats': ['II (3)', 'V (6)', 'VI (8)'],
                    'leaves': [2, 5]},
        'plate_space': [1408, 768],
        'pipeline': {
            'stage1': 'tools/lanestreet/genplate.py -> tools/nbpro.py '
                      '(gemini-3-pro-image, --aspect 16:9), locked template + '
                      'subject clause; 4 candidates over 2 rounds',
            'curate': 'tools/lanestreet/curate.py (1376x768 -> 1408x768 LANCZOS)',
            'stage2': 'tools/lanestreet/slice_street.py (helpers imported from '
                      'tools/lanea/slice_plate.py) -> pack_street.py -> '
                      'lifepass.py -> reveal_proof.py',
            'stage3': 'tools/lanestreet/jobs-variants.json -> '
                      'tools/laneassets/gen.py -> tools/nbpro_edit.py (i2i), '
                      'each gated by tools/lanestreet/gate.py',
        },
        'raws': os.path.abspath(rawdir),
        'files': {}, 'variants': {}, 'layers': {},
        'rulings': [
            {'id': 'R1', 'what': 'the master plate is candidate D of 4',
             'why': 'A and B both CROPPED the villa roof at the top edge, which '
                    'leaves no sky for a plume that climbs its own building '
                    'height again (sec 6.6), and neither read as the house\'s '
                    'own island (backdrop.png is one complete diorama floating '
                    'in navy, clear on all four sides). C fixed the framing but '
                    'paints FURNITURE inside the bay, which fights the '
                    'silhouette the bay exists to carry, and shipped a hard '
                    'octagonal polygon artefact where the lamp halo should be. '
                    'D is the only candidate that is a bijou stucco villa with '
                    'a fanlight and long windows almost to the floor (canon '
                    'l.565-567), keeps a clean unfurnished bay, stacks the '
                    'first-floor window directly over it, and puts a clear '
                    'flagstone at the lamp\'s foot for the chalk ring'},
            {'id': 'R2', 'what': '1376x768 -> 1408x768 by LANCZOS resize',
             'why': 'the API\'s 1K 16:9 output is 1376 wide; plate space is '
                    '1408. A resize invents no pixels and leaves no seam, where '
                    'padding would have to invent 32 columns of backdrop. The '
                    'i2i variants come back at their input size, so every '
                    'variant is already in plate space'},
            {'id': 'R3', 'what': 'NO CROWD is painted into any of the five plates',
             'why': 'sec 6.2 lists the crowd under FREE LAYERS ("so it can turn '
                    'and then scatter"). "crowd turned to it" in the smoke row '
                    'and "the crowd gone" in the empty row are therefore states '
                    'the sprite layer delivers over these plates, not paint. '
                    'Painting them in would freeze the one thing the beat needs '
                    'to animate, and would put 8 figures inside the diff gate'},
            {'id': 'R4', 'what': 'the plume leaves the FIRST-FLOOR window while '
                                 'the gate target `window` is the GROUND-FLOOR bay',
             'why': 'this looks like a contradiction inside sec 6.2/6.4/6.6 and '
                    'it is not. Checked in the reference rather than guessed: '
                    'main.js targetAt(\'window\') anchors the throw target on '
                    'the street module\'s published `story-irene` node - she '
                    'stands BEHIND THE BAY GLASS, so the target is the bay - '
                    'while street.js sets the crowd\'s LOOK vector to '
                    '(3.1, 5.15, -2.8), the upper smoke window, and hangs both '
                    'main plume curves off it (y 5.3 -> 12.0). So: the reader '
                    'clicks the lit bay he is stationed at, the ruse goes up '
                    'into the window above it, and the reveal happens in the '
                    'bay BELOW the smoke. That is why street-smoke.png keeps '
                    'the bay clean, and why the gate carries a SACRED box'},
            {'id': 'R5', 'what': 'two dim candidates; the deeper one ships',
             'why': 'both passed the gate. The choice was made on the measured '
                    'relight matrix against the shipped room variant '
                    '(blur(dim)/blur(base) over the subject): first candidate '
                    '[0.845, 0.898, 0.938], second [0.725, 0.868, 0.962], room '
                    '[0.701, 0.769, 0.824]. The second matches the room in the '
                    'channel this plate\'s light actually lives in'},
            {'id': 'R6', 'what': 'the bay-glass polygon was 32 px too wide and '
                                 'was re-cut',
             'why': 'the first cut ran to x 838, over the bay\'s right CHEEK. '
                    'Because the alpha model makes non-amber pixels opaque, '
                    'that strip came out at alpha 1.0 and proof-reveal.png '
                    'showed it blanking the silhouette the layer exists to '
                    'reveal (mean glass alpha over the figure 0.765). Re-cut to '
                    'the measured glazing (x 696-808): 0.313'},
            {'id': 'R7', 'what': 'the chalk ring is AUTHORED, not generated',
             'why': 'it is a shape with a required radius (the reference\'s '
                    '0.52 m torus), a required position (gate `station`) and a '
                    'required colour (0xd9cfae, zero text). A drawing routine '
                    'gets all three exactly right; an image model gets none of '
                    'them reliably. `off` ships no file - it is the absence of '
                    'the layer'},
            {'id': 'R8', 'what': 'tools/nbpro.py gained --aspect and the '
                                 'env-file key fallback',
             'why': 'nbpro.py could only read GEMINI_API_KEY from the '
                    'environment, which on this lane means putting the key on a '
                    'command line; nbpro_edit.py already had the in-Python '
                    '.env parse and that code is now shared. --aspect is why '
                    'these plates are 16:9 and street-arrival.png is 1024x1024'},
            {'id': 'R9', 'what': 'NO DUSK VARIANT for Beat II',
             'why': 'the brief floated "dusk for beat II vs night" as a likely '
                    'variant. The law does not: sec 6.2 lists exactly five '
                    'states and puts Beat II\'s units II.0-2 on `street.jpg`, '
                    'the same base plate Beat V opens on. Beat V is Beat II '
                    'RESUMING - same night, same minute, no heading (sec 0.3) - '
                    'so a dusk Beat II would make the told story last an hour '
                    'and break the one join the chapter cannot afford'},
            {'id': 'R10', 'what': 'the recomposition proof is NOT zero, and is '
                                  'not supposed to be',
             'why': 'stacking void + terrace + villa + base + lamp and adding '
                    'the halo back differs from the plate by mean 1.18, with '
                    '6663 px (0.6%) over 8. layers/proof-residual.png shows '
                    'every one of them lying on a band seam, and they are the '
                    'method working: each band carries 13 px of HARMONICALLY '
                    'INPAINTED headroom into its neighbour so a parallax reveal '
                    'shows plausible pixels instead of a hole, and at rest the '
                    'nearer band draws that inpaint over the farther band\'s '
                    'real pixels. It matches where the inpaint is smooth (the '
                    'walls) and misses where it crosses a hard edge (the '
                    'villa\'s corner, the railings, the kerb). The number to '
                    'watch is not the residual, it is that the residual is '
                    'CONFINED TO THE SEAMS - a scatter anywhere else would mean '
                    'the void model or the halo lift was wrong'},
        ],
    }

    for fn in sorted(os.listdir(setdir)):
        p = os.path.join(setdir, fn)
        if os.path.isdir(p):
            continue
        e = {'bytes': os.path.getsize(p), 'sha256': sha(p)[:16],
             'role': ROLES.get(fn, '')}
        try:
            im = Image.open(p)
            e['size'] = list(im.size)
            e['mode'] = im.mode
        except Exception:
            pass
        man['files'][fn] = e

    lp = os.path.join(setdir, 'layers', 'layers.json')
    if os.path.exists(lp):
        lj = json.load(open(lp))
        man['layers'] = {'dir': 'layers/', 'drawOrder': lj['drawOrder'],
                         'bands': [{k: l[k] for k in ('id', 'file', 'x', 'y',
                                                      'w', 'h', 'bytes')}
                                   for l in lj['layers']],
                         'overlays': [{k: l[k] for k in ('id', 'file', 'x', 'y',
                                                         'w', 'h', 'bytes')}
                                      for l in lj['overlays']],
                         'static': {k: v['size'] for k, v in lj['static'].items()},
                         'recompositionProof': lj['recompositionProof'],
                         'bayGlass': lj['bayGlass']}

    dd = os.path.join(rawdir, 'diff')
    if os.path.isdir(dd):
        for fn in sorted(os.listdir(dd)):
            if fn.endswith('-gate.json'):
                g = json.load(open(os.path.join(dd, fn)))
                man['variants'][g['label']] = g

    lifep = os.path.join(setdir, 'life.json')
    if os.path.exists(lifep):
        life = json.load(open(lifep))
        man['marks'] = life['marks']
        man['emissives'] = life['emissives']
        man['groundPlane'] = life['groundPlane']

    # ---- contact sheet ------------------------------------------------
    tw, th = 469, 256
    sheet = Image.new('RGB', (tw * 2 + 18, (th + 26) * 3 + 12), (14, 16, 24))
    d = ImageDraw.Draw(sheet)
    for i, (fn, label, used) in enumerate(STATES):
        p = os.path.join(setdir, fn)
        if not os.path.exists(p):
            continue
        col, row = i % 2, i // 2
        x, y = col * (tw + 12) + 6, row * (th + 26) + 6
        sheet.paste(Image.open(p).convert('RGB').resize((tw, th), Image.LANCZOS), (x, y))
        d.text((x + 3, y + th + 4), '%s   -   %s' % (label, used), fill=(226, 208, 170))
    sheet.save(os.path.join(setdir, 'contact-sheet.png'))
    man['files']['contact-sheet.png'] = {
        'bytes': os.path.getsize(os.path.join(setdir, 'contact-sheet.png')),
        'role': 'the five painted states, side by side'}

    with open(os.path.join(setdir, 'MANIFEST.json'), 'w') as f:
        json.dump(man, f, indent=1)
    print(json.dumps({'files': len(man['files']),
                      'variants_gated': list(man['variants']),
                      'bands': [b['id'] for b in man['layers'].get('bands', [])],
                      'out': os.path.join(setdir, 'MANIFEST.json')}, indent=1))


if __name__ == '__main__':
    main()
