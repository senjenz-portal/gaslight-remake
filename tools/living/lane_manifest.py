#!/usr/bin/env python3
"""lane_manifest.py — RAW-FIRST BOOKKEEPING for the ROOM + STREET + HEADS lane.

Seven files' bytes changed in this round. MANIFEST-book.json already carried one
of them (actor/norton-chase.png) with the shipped sha, which is now stale, and
carried none of the plate/cameo files at all. This refreshes the entry that
exists and adds the ones that do not, each with its bytes, size, sha256, the
defect it closes, the tool that produced it and where its raw artefacts live —
so the bytes in site-deploy can always be traced back to the call that made them.

Usage: python3 tools/living/lane_manifest.py
"""
import hashlib
import json
import os
from datetime import datetime, timezone

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = os.path.join(ROOT, 'site-deploy', 'living', 'assets')
MAN = os.path.join(A, 'MANIFEST-book.json')

ENTRIES = {
    'plate/room.jpg': ('F9', 'tools/living/watsonectomy.py',
                       'assets/raw/watsonectomy',
                       'the painted Watson removed from the armchair (confined i2i, '
                       'hole-fill pass, diff-gated: 0 leak outside the box, 0 px of '
                       'his coat left in the seat volume)'),
    'plate/room-open.jpg': ('F9', 'tools/living/watsonectomy.py',
                            'assets/raw/watsonectomy', 'the same removal, door-open state'),
    'plate/room-dim.jpg': ('F9', 'tools/living/watsonectomy.py',
                           'assets/raw/watsonectomy', 'the same removal, relit state'),
    'plate/chair.png': ('F9', 'tools/living/watsonectomy.py',
                        'assets/raw/watsonectomy',
                        'the FOREGROUND cut re-cut off the repaired plate: he was inside '
                        'this one too, and above y 400 the outline was his cap, not the chair'),
    'plate/chair-dim.png': ('F9', 'tools/living/watsonectomy.py',
                            'assets/raw/watsonectomy', 'the same cut, relit state'),
    'actor/norton-chase.png': ('F3', 'tools/living/nortonmatte.py',
                               'assets/raw/nortonmatte',
                               'matte pass (the body colour bled into every partial pixel: '
                               'local halo +3.09 -> +0.71 luma) and palette pull (core p95 '
                               '130.4 -> 103.9, 52 -> 0 blown px). Alpha untouched.'),
    'cameo/holmes.jpg': ('F11', 'tools/living/holmescameo.py',
                         'assets/raw/holmescameo',
                         'regenerated FROM the canonical room Holmes via a two-panel sheet '
                         '(his own five actor cuts + the shipped card format). In the circle '
                         'the reader sees: gown 0 -> 4.67%, hue none -> 299.3 (stage 298), '
                         'skin 0 -> 2.82%, green 15.23 -> 0.00%'),
}


def main():
    m = json.load(open(MAN))
    files = m['files']
    log = []
    for rel, (defect, tool, raw, note) in ENTRIES.items():
        p = os.path.join(A, rel)
        b = open(p, 'rb').read()
        im = Image.open(p)
        was = files.get(rel, {}).get('sha256')
        files[rel] = {
            'bytes': len(b), 'size': list(im.size), 'mode': im.mode,
            'sha256': hashlib.sha256(b).hexdigest(),
            'note': (files.get(rel, {}).get('note') or '').split(' | ')[0],
            'fixRound': {'defect': defect, 'tool': tool, 'raw': raw, 'change': note},
        }
        if not files[rel]['note']:
            files[rel]['note'] = note
        log.append('%-26s %s -> %s' % (rel, (was or 'ABSENT')[:12],
                                       files[rel]['sha256'][:12]))
    m.setdefault('fixRounds', []).append({
        'round': 'fable-pass fix round 1',
        'lane': 'ROOM + STREET + HEADS',
        'defects': ['F1', 'F2', 'F3', 'F8', 'F9', 'F10', 'F11'],
        'at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'assertions': 'tools/living/lap.mjs sections [F1] [F2] [F3] [F8] [F9] [F10] [F11]; '
                      'proved to bite by tools/living/teeth.sh',
    })
    with open(MAN, 'w') as f:
        json.dump(m, f, indent=1)
    print('\n'.join(log))
    print('MANIFEST-book.json updated (%d files)' % len(files))


if __name__ == '__main__':
    main()
