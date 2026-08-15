#!/usr/bin/env python3
"""ship_props.py -- land the three CHURCH PROPS that carry facts M.4 and M.6.

CONTENT-full 7.2 #13 ships no ring, no sovereign and no chain, and the two
facts they carry were being drawn as CSS radial gradients: a 26 px yellow blur
for "the bride gave me a sovereign", and nothing at all for the ring. Both are
contract facts and both must read at a close lens, so both are pictures now.

  ring          the band that goes on her hand under `ringScrub`
  sovereign     the coin whose three holders are fact M.6's whole shape
  watch-chain   the third holder. `holmes-church-altar.png` has no chain on it,
                so leg 2 of the coin's journey arrived nowhere; the chain is
                staged as a prop on his waistcoat and comes up as the coin lands.

Keyed off the magenta field by the actor lane's matte, despilled by the rig
lane's min(R,B)-G probe (magenta survives on thin geometry -- chain links are
nothing but thin geometry), then landed with a manifest entry.

    python3 ship_props.py
"""
import hashlib
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = '/Users/samz/Documents/gaslight-remake'
RAW = os.path.join(ROOT, 'assets/raw/book-church/props')
DEST = os.path.join(ROOT, 'site-deploy/living/assets/set/church')
MANIFEST = os.path.join(ROOT, 'site-deploy/living/assets/MANIFEST-book.json')
sys.path.insert(0, os.path.join(ROOT, 'tools/lanechase'))
from ship_rigs import despill  # noqa: E402

# out name -> (chosen raw, shipped long edge, note)
PROPS = {
    'ring': ('prop-ring-a.png', 128,
             'fact M.4: the gold band, scrubbed onto the joined hands 0->1'),
    'sovereign': ('prop-sovereign-b.png', 128,
                  'fact M.6: the sovereign, bride -> witness -> watch chain'),
    'watch-chain': ('prop-chain-b.png', 192,
                    "fact M.6's third holder: the chain on the witness's "
                    'waistcoat, which the actor cut does not paint'),
}


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()[:16]


def main():
    man = json.load(open(MANIFEST))
    os.makedirs(os.path.join(RAW, 'keyed'), exist_ok=True)
    for name, (src, edge, note) in PROPS.items():
        keyed = os.path.join(RAW, 'keyed', name + '.png')
        subprocess.run([sys.executable,
                        os.path.join(ROOT, 'tools/laneactors/matte_actors.py'),
                        os.path.join(RAW, 'gen', src), keyed],
                       check=True, capture_output=True)
        im = Image.open(keyed).convert('RGBA')
        a = np.array(im)[..., 3] > 6
        im = im.crop(Image.fromarray((a * 255).astype(np.uint8)).getbbox())
        s = edge / max(im.size)
        im = im.resize((max(1, round(im.size[0] * s)), max(1, round(im.size[1] * s))),
                       Image.LANCZOS)
        arr = despill(np.array(im))
        arr[..., :3][arr[..., 3] == 0] = 0
        out = os.path.join(DEST, name + '.png')
        Image.fromarray(arr).save(out, optimize=True)
        man['files']['set/church/%s.png' % name] = {
            'bytes': os.path.getsize(out), 'size': list(Image.open(out).size),
            'mode': 'RGBA', 'sha256': sha(out), 'note': note,
        }
        print(json.dumps({name: Image.open(out).size, 'bytes': os.path.getsize(out)}))
    json.dump(man, open(MANIFEST, 'w'), indent=1)


if __name__ == '__main__':
    main()
