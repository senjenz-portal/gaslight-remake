#!/usr/bin/env python3
"""
ship_grounding.py — ship Explorer C's grounding artefacts into the live book:

  1. the contact shadows (shadowgen.py output, tools/ody/seamless/shadows/)
       -> site-deploy/living-odyssey/assets/actor/shadow/<lane>/<file>
  2. the floor-prop occluder cuts (cutocc.py output, .../occluders/)
       cave cuts   -> assets/set/cave/<file>    (per painted state, room-dim law)
       shore cut   -> assets/set/shore/<file>
  3. app/shadows.js — the SHIPPED shadow registry, generated VERBATIM from the
     three shadowmap.json files (the strips.js pattern: the lap asserts the
     shipped module deep-equals the tool's own json, so no set can drift off
     the generator's numbers).

Pure copy + transcription: no pixel is touched. Same inputs, same bytes.
"""
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SITE = os.path.join(ROOT, 'site-deploy', 'living-odyssey')
LANES = ['cave', 'shore', 'sea']

def main():
    # ---- 1. the shadows ---------------------------------------------------
    maps = {}
    n = 0
    for lane in LANES:
        src = os.path.join(HERE, 'shadows', lane)
        dst = os.path.join(SITE, 'assets', 'actor', 'shadow', lane)
        os.makedirs(dst, exist_ok=True)
        m = json.load(open(os.path.join(src, 'shadowmap.json')))
        maps[lane] = m
        for rec in m['shadows'].values():
            shutil.copyfile(os.path.join(src, rec['file']),
                            os.path.join(dst, rec['file']))
            n += 1
    print(f'{n} shadow PNGs -> assets/actor/shadow/<lane>/')

    # ---- 2. the occluder cuts ----------------------------------------------
    occ = json.load(open(os.path.join(HERE, 'occluders', 'occluders.json')))
    for f in occ:
        lane = 'shore' if f.startswith('firepit') else 'cave'
        shutil.copyfile(os.path.join(HERE, 'occluders', f),
                        os.path.join(SITE, 'assets', 'set', lane, f))
    print(f'{len(occ)} occluder cuts -> assets/set/{{cave,shore}}/')

    # ---- 3. app/shadows.js, the shipped registry ---------------------------
    body = json.dumps(maps, indent=1)
    js = (
        '/**\n'
        ' * shadows.js — THE CONTACT-SHADOW REGISTRY, generated VERBATIM from\n'
        ' * tools/ody/seamless/shadows/<lane>/shadowmap.json by\n'
        ' * tools/ody/seamless/ship_grounding.py — do not hand-edit; re-ship.\n'
        ' *\n'
        ' * The law is the sherlock chase set\'s rig-shadow law (chase.js\n'
        ' * paintRigs), ported per cut by shadowgen.py:\n'
        ' *   shape    the FEET\'S own span (sw = footSpan * 1.55, aspect 0.42),\n'
        ' *            light-aware skew off the lane\'s dominant EMIS anchor,\n'
        ' *            baked into the PNG at peak alpha 0.62;\n'
        ' *   place    `anchor` is the point inside the PNG that lands on the\n'
        ' *            actor\'s PIN (the measured foot on the baseline), scaled\n'
        ' *            by the actor\'s own k = drawnH / cutH;\n'
        ' *   opacity  0.42 + 0.30 * s at runtime (chase.js verbatim; s is the\n'
        ' *            set\'s own depth share of the mark), times the actor\'s own\n'
        ' *            opacity — a shadow never outlives its actor.\n'
        ' * Files ship at assets/actor/shadow/<lane>/<file>.\n'
        ' */\n'
        'export const SHADOWS =\n' + body + ';\n'
    )
    out = os.path.join(SITE, 'app', 'shadows.js')
    with open(out, 'w') as f:
        f.write(js)
    print(f'-> {os.path.relpath(out, ROOT)} '
          f'({sum(len(m["shadows"]) for m in maps.values())} records)')

if __name__ == '__main__':
    main()
