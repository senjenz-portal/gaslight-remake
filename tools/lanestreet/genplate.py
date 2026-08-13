#!/usr/bin/env python3
"""genplate.py -- STAGE 1 of the plate pipeline for SET `street`.

Serpentine Avenue at Briony Lodge, the SET that carries 17 units (beats II + V
+ VI). Two candidates of the master plate, generated from the LOCKED style
template (CONTENT-full.md sec 1.9 / tools/nbpro_prompts.json) + a subject
clause, run in parallel with a hard wall-clock timeout so a hung model can
never stall the lane. Raw-first: every candidate lands immutable under
assets/raw/book-street/<stamp>/ with its full prompt in that dir's
manifest.json before any curated copy exists.

Plate space is 1408x768, which is this API's 1K 16:9 output, so every job asks
for --aspect 16:9. (backdrop.png came out 1408x768; street-arrival.png came out
1024x1024 because nothing asked. That is why it is not a set.)

    python3 genplate.py OUTDIR [--timeout 420] [--only a,b]
"""
import argparse
import concurrent.futures as cf
import json
import os
import subprocess
import sys
import time

NBPRO = '/Users/samz/Documents/gaslight-remake/tools/nbpro.py'

# ---------------------------------------------------------------- the law
# Verbatim from tools/nbpro_prompts.json (every plate in the book opens with
# this string; the subject clause is appended to it and nothing else changes).
LOCKED = ('stylized low poly 3d game diorama, isometric view, floating on a '
          'faceted dark rock base, clean dark navy gradient backdrop, '
          'Prussian-blue night, amber window glow, gas-lamp halos, faceted '
          'Victorian figures with single accent colours, flat-shaded chunky '
          'low poly style, no text, no letters, blank weathered sign boards')

# The marks this SET has to be able to stage, all of them from CONTENT-full.md
# sec 6.2 / 6.4 / 6.6 and the reference street module:
#   * the sitting-room BAY (gate target `window`, and THE REVEAL surface -- a
#     crimson-edged silhouette is drawn INSIDE it, before the glass)
#   * the first-floor window directly above it (the plume's mouth, sec 6.6)
#   * the gas lamp and a CLEAR FLAGSTONE at its foot (gate target `station`,
#     the chalk ring)
#   * sky above the roofline for a plume that climbs its own height again
#   * an empty road for Holmes, the crowd and the maid, all of which arrive as
#     sprite layers -- so the plate paints NO people at all
EMPTY = ('The street is completely EMPTY and quiet: no people, no figures, no '
         'crowd, no pedestrians, no horses, no carriages, no cabs, nothing '
         'moving. NOTHING IS BURNING: no smoke, no smoke plume, no fire '
         'outside, no flames, no haze, clear cold night air above the '
         'rooftops.')

SKY = ('The rooftops sit low in the frame: the top third of the picture is '
       'open deep navy night sky, empty, with nothing in it.')

# ROUND 2. Round 1 (a, b) failed one hard requirement each and shared two:
#   * the villa's roof was CROPPED by the top edge in both -> no sky for the
#     plume, which climbs its own building height again (sec 6.6 / the
#     reference's plume curves run y 5.3 -> 12.0 on a 6.8 m villa)
#   * neither read as the house's own island: backdrop.png is one complete
#     diorama floating in navy with clear margin on ALL FOUR sides
# ISLAND is the framing law, stated as the picture's own subject.
ISLAND = ('FRAMING, the most important instruction: the whole scene is ONE '
          'SMALL FLOATING DIORAMA ISLAND seen from a high three-quarter '
          'isometric angle, complete and entirely inside the picture, with '
          'empty dark navy space all around it on ALL FOUR SIDES. Nothing is '
          'cropped or cut off by the edge of the frame: the villa\'s roof, its '
          'chimney, the gas lamp\'s finial and every corner of the paving slab '
          'are all well inside the picture. Leave a wide clear band of EMPTY '
          'NAVY SKY above the chimney and the roof ridge, at least a quarter '
          'of the picture height, with nothing at all in it.')

NOSHOP = ('This is a quiet residential avenue of private houses: no shop '
          'fronts, no shop windows, no hanging shop signs, no boards, no '
          'awnings, no lettering of any kind anywhere.')

VILLA = (
    'Briony Lodge, a small bijou two-storey Victorian villa built right up to '
    'the road with no front garden; its GROUND FLOOR carries a three-faced bay '
    'of tall long sash windows that reach almost down to the floor, the '
    'sitting room behind the glass glowing warm amber from a fire inside, the '
    'panes clean and clear and unobstructed with nothing standing in front of '
    'them; a dark panelled front door beside the bay under a small portico '
    'with a plain fanlight and two pale stone steps; low black cast-iron area '
    'railings along the front; on the UPPER FLOOR, directly above the bay, one '
    'plain sash window, shut and dark, with clear wall around it')

LAMP = ('a black cast-iron gas lamp standing on the near pavement, its glass '
        'head burning amber inside a soft halo, and a CLEAR EMPTY PAVING '
        'FLAGSTONE at its foot with nothing on it')

CANDIDATES = {
    # A: the reference's own frame -- villa on the right, road across the
    # bottom, lamp near-left. The bay reads big, which is what the reveal wants.
    'a': (
        'Serpentine Avenue in St John\'s Wood at night. ' + VILLA + ', the '
        'whole villa standing in the RIGHT HALF of the frame and turned three '
        'quarters towards the viewer so the bay faces us; ' + LAMP + ' at the '
        'LEFT of the frame, well clear of the house; a plain brick Georgian '
        'terrace of shut dark houses running away down the far LEFT side of '
        'the street; a damp cobbled roadway crossing the lower third of the '
        'frame with soft wet amber reflections and shallow puddles; the whole '
        'street sits on a faceted dark rock base. ' + SKY + ' ' + EMPTY),
    # B: villa nearer the centre and more frontal, the road running away to the
    # left. More pavement in front of the bay -- more room for the sprites.
    'b': (
        'Serpentine Avenue in St John\'s Wood at night, seen from the far '
        'pavement. ' + VILLA + ', the villa standing just RIGHT OF CENTRE and '
        'almost square-on to the viewer so the bay and the door both read '
        'clearly; the cobbled roadway running away diagonally to the LEFT past '
        'a plain brick Georgian terrace of shut dark houses; ' + LAMP + ' in '
        'the near foreground at the LOWER LEFT, close to the viewer, its post '
        'cutting the frame; broad damp paving in front of the villa with soft '
        'wet amber reflections; the whole street sits on a faceted dark rock '
        'base. ' + SKY + ' ' + EMPTY),
    # C: b's diorama language with the framing law and the villa brought back
    # into the middle of the island.
    'c': (
        'Serpentine Avenue in St John\'s Wood at night, one corner of it lifted '
        'out as a floating model. ' + ISLAND + ' ON THE ISLAND: ' + VILLA +
        '; the villa stands JUST RIGHT OF THE CENTRE of the island, turned '
        'three quarters towards the viewer so the bay window faces us and is '
        'the largest, brightest and most important object in the picture, its '
        'amber glass clean and completely unobstructed; a broad damp paving '
        'flagstone pavement runs in front of it, swept and empty; ' + LAMP +
        ' standing on that pavement to the LEFT of the villa with clear space '
        'around it; a low plain brick Georgian terrace of shut dark houses '
        'running away behind the pavement on the far LEFT; a damp cobbled '
        'roadway along the near edge of the island with soft wet amber '
        'reflections; the paving and the road sit on a chunky faceted dark '
        'rock base that tapers underneath. ' + NOSHOP + ' ' + EMPTY),
    # D: same law, camera a touch lower and squarer to the facade, so the bay
    # and the upper window stack vertically -- the plume's mouth directly over
    # the reveal, which is how the reference stages it (crowd LOOK is the upper
    # window at (3.1, 5.15, -2.8); the reveal is in the bay below it).
    'd': (
        'Serpentine Avenue in St John\'s Wood at night, one corner of it lifted '
        'out as a floating model. ' + ISLAND + ' ON THE ISLAND: ' + VILLA +
        '; the villa stands in the RIGHT HALF of the island and is turned only '
        'slightly, nearly square-on to the viewer, so that the upper-floor sash '
        'window sits DIRECTLY ABOVE the ground-floor bay window in a clean '
        'vertical stack, both of them fully visible with plain wall between '
        'them; the bay window is the largest and brightest object in the '
        'picture, glowing amber, its glass clean and completely unobstructed; '
        'a broad damp paving pavement in front of the house, swept and empty; '
        + LAMP + ' standing on the pavement at the LEFT of the island, well '
        'clear of the house; a plain brick Georgian terrace of shut dark '
        'houses standing further back on the LEFT; a damp cobbled roadway '
        'along the near edge with soft wet amber reflections; everything sits '
        'on a chunky faceted dark rock base. ' + NOSHOP + ' ' + EMPTY),
}


def run(job, timeout, manifest):
    t0 = time.time()
    cmd = [sys.executable, NBPRO, '--prompt', job['prompt'], '--out', job['out'],
           '--manifest', manifest, '--aspect', '16:9']
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        tail = (p.stdout or '').strip().splitlines()
        payload = {}
        if tail:
            try:
                payload = json.loads(tail[-1])
            except Exception:
                payload = {'raw': tail[-1][:300]}
        return {'id': job['id'], 'rc': p.returncode,
                'secs': round(time.time() - t0, 1), 'res': payload,
                'stderr': (p.stderr or '')[-300:]}
    except subprocess.TimeoutExpired:
        return {'id': job['id'], 'rc': 'TIMEOUT', 'secs': round(time.time() - t0, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('outdir')
    ap.add_argument('--timeout', type=int, default=420)
    ap.add_argument('--only', default='')
    a = ap.parse_args()

    os.makedirs(a.outdir, exist_ok=True)
    manifest = os.path.join(a.outdir, 'manifest.json')
    keep = {s.strip() for s in a.only.split(',') if s.strip()}
    jobs = [{'id': k, 'prompt': LOCKED + ', ' + v,
             'out': os.path.join(a.outdir, 'street-%s.png' % k)}
            for k, v in sorted(CANDIDATES.items()) if not keep or k in keep]

    with cf.ThreadPoolExecutor(max_workers=len(jobs)) as ex:
        futs = [ex.submit(run, j, a.timeout, manifest) for j in jobs]
        results = [f.result() for f in cf.as_completed(futs)]
    for r in results:
        print(json.dumps(r), flush=True)
    print(json.dumps({'batch_done': True,
                      'ok': sum(1 for r in results if r.get('rc') == 0),
                      'total': len(results)}))


if __name__ == '__main__':
    main()
