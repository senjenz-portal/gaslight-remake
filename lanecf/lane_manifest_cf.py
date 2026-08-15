#!/usr/bin/env python3
"""lane_manifest_cf.py — RAW-FIRST BOOKKEEPING for the CHURCH lane's F4 + F5.

Nine files' bytes changed closing the marriage's two majors and three of them did
not exist in MANIFEST-book.json at all. The manifest still carried the PRE-PATCH
sha for the four bitmaps that paint the chancel, which is the worst state it can
be in: the book ships an emptied chancel and its own ledger says the mannequins
are still there. This refreshes what exists, adds what does not, and records for
each file the defect it closes, the tool that produced it, where its raw
artefacts live (prompt, model id, input sha, gate numbers) and what the gate
measured — so any byte in site-deploy traces back to the call that made it.

The gate numbers, once, because a round whose law is "every fix ships with its
measurement" has to write the measurement down:

  [F4] the three figure boxes of church.jpg measured 3.37 / 7.86 / 7.03 % of
       their area as bright desaturated cloth (gown, veil, shirt-front, surplice)
       and 0.00 % after; the i2i paste changed 0 px outside the figures' bbox in
       every variant, at align p99 8.33 of a 9.0 gate.
  [F5] every sole column of every standing cut is over painted floor or hidden
       behind BOTH pew cuts: 0 on furniture, where the pre-pew_end layer left the
       witness's left boot on the front pew's end standard while the floorFrac
       patch at his mark read 0.893.

Usage: python3 tools/lanecf/lane_manifest_cf.py
"""
import hashlib
import json
import os
from datetime import datetime, timezone

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = os.path.join(ROOT, 'site-deploy', 'living', 'assets')
MAN = os.path.join(A, 'MANIFEST-book.json')
RAW = 'assets/raw/book-cf/20260813T1100Z'

CHANCEL = ('the three baked faceless figures LIFTED OFF the plate: a confined '
           'i2i repaint of the chancel (nbpro / gemini-3-pro-image, prompt and '
           'input sha in %s/manifest.json) pasted back through the figures\' own '
           'difference mask. Diff-gated: 0 changed px outside the figure bbox, '
           'align p99 8.33 of a 9.0 gate. Bright-cloth in the three figure boxes '
           '3.37/7.86/7.03%% -> 0.00%%' % RAW)

ENTRIES = {
    'set/church/church.jpg': ('F4', 'tools/lanecf/chancel_patch.py', CHANCEL),
    'set/church/church-dim.jpg': ('F4', 'tools/lanecf/chancel_patch.py',
                                  CHANCEL + ' (the relit variant — it rides ctx.dim '
                                  'on every unit of the beat)'),
    'set/church/church-ring.jpg': ('F4', 'tools/lanecf/chancel_patch.py',
                                   CHANCEL + ' (the candlelight lift — it carries '
                                   'the whole of fact M.4)'),
    'set/church/altar.png': ('F4', 'tools/lanecf/chancel_patch.py + pack_cf.py',
                             'the FOREGROUND cut re-cut off the emptied chancel: the '
                             'clergyman was inside this one too (alpha 54092 -> 39687 '
                             '-> 37617 px over two passes), and the layer now draws '
                             'UNDER the actors — as a foreground it laid the altar\'s '
                             'own frontal across two painted faces'),
    'actor/clergyman-altar.png': ('F4', 'tools/lanecf/refsheet_cf.py',
                                  'the fourth participant had NO cut at all '
                                  '(CONTENT-full 6.3 GAP #6): generated to the '
                                  'canonical-sheet law off the plate\'s own painted '
                                  'figure so the surpliced man at the rail is painted '
                                  'in the same register as the other three'),
    'actor/irene-bride.png': ('F4', 'tools/lanecf/pack_cf.py',
                              'the bride STAGED at last — the cut had a real face and '
                              'had never been placed, while the plate painted a '
                              'faceless mannequin in her place'),
    'actor/norton-groom.png': ('F4', 'tools/lanecf/pack_cf.py',
                               'the ONE Norton. He existed twice in the book — a '
                               'painted man in the aisle and a maroon mannequin at the '
                               'altar — and the altar one is gone with the plate patch, '
                               'so this cut now walks to his own mark and stands on it'),
    'set/church/pews-front.png': ('F5', 'tools/lanecf/pew_front.py + pew_end.py',
                                  'the pew/rail FOREGROUND cut: the plate\'s own pixels '
                                  'below the measured front contour T(x), laid OVER the '
                                  'actors so a foot at the altar goes BEHIND the pew '
                                  'exactly where the painting cut its own figures off '
                                  '(residual 0.62 px bride / 0.89 px groom over 77 '
                                  'columns). pew_end.py then added the front pew\'s END '
                                  'STANDARD, +2402 px over x 648..690, T\' 458..511 — '
                                  'the piece of furniture the witness\'s left boot was '
                                  'standing on'),
    'set/church/pews-front-ring.png': ('F5', 'tools/lanecf/pew_front.py + pew_end.py',
                                       'the same cut off the ring plate, +2407 px, so '
                                       'the one strip of frame in front of the actors '
                                       'warms with the candlelight lift instead of '
                                       'staying cold — and a foot is only counted hidden '
                                       'if BOTH cuts hide it'),
}


def main():
    m = json.load(open(MAN))
    files = m['files']
    log = []
    for rel, (defect, tool, note) in ENTRIES.items():
        p = os.path.join(A, rel)
        b = open(p, 'rb').read()
        im = Image.open(p)
        was = files.get(rel, {}).get('sha256')
        old_note = (files.get(rel, {}).get('note') or '').split(' | ')[0]
        files[rel] = {
            'bytes': len(b), 'size': list(im.size), 'mode': im.mode,
            'sha256': hashlib.sha256(b).hexdigest(),
            'note': old_note or note,
            'fixRound': {'defect': defect, 'tool': tool, 'raw': RAW, 'change': note},
        }
        log.append('%-32s %s -> %s' % (rel, (was or 'ABSENT')[:12],
                                       files[rel]['sha256'][:12]))
    m.setdefault('fixRounds', []).append({
        'round': 'fable-pass fix round 1',
        'lane': 'CHURCH — ONE REGISTER + FLOOR-TRUE MARKS',
        'defects': ['F4', 'F5'],
        'at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'assertions':
            'tools/living/lap.mjs [F4] cloth<=0.40% in all four chancel bitmaps + '
            'every participant a cut-out on every church unit + all four inside the '
            'lens once the witness stands on the altar mark (<=12 css px clip); '
            '[F5] floorFrac>=0.60 or the pew swallows the footwear block, feet line '
            'within 4.0 plate px of the mark off the cut\'s own alpha, and 0 sole '
            'columns on pew furniture (the sole-span law, per column of the drawn '
            'box). Proved to bite by tools/living/teeth-sole.sh, which restores the '
            'pre-pew_end cuts and requires the lap to name the floating boot.',
    })
    with open(MAN, 'w') as f:
        json.dump(m, f, indent=1)
    print('\n'.join(log))
    print('MANIFEST-book.json updated (%d files)' % len(files))


if __name__ == '__main__':
    main()
