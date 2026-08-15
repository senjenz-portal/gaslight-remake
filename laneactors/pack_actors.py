#!/usr/bin/env python3
"""pack_actors.py -- take the accepted raws through to shipped actor sprites.

One command so the set is reproducible and nothing lands by hand:

  key      matte_actors.py off the magenta field (spill ceiling that holds)
  pull     strips -> the sibling palettepull.py against their own idle, so a
           cycle does not shimmer; church actors -> this lane's platepull.py
           against the plate's OWN painted figure, so a sprite that replaces a
           painting is lit like the painting it replaces
  proof    stageproof_actors.py onto the real plate at the measured scale
  land     curated PNG + the raw it came from + a MANIFEST with sha256, the
           source raw, the scale it ships at and the numbers each gate scored

    python3 pack_actors.py [--only id,id]
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import actor_geom as G  # noqa: E402

ROOT = '/Users/samz/Documents/gaslight-remake'
RAW = os.path.join(ROOT, 'assets/raw/book/actors')
OUT = os.path.join(ROOT, 'assets/plates/book/actors')
TOOLS = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable

# id -> (raw, set, who, frames, pull, role)
#
# PULL POLICY, per actor, stated rather than inferred. The church plate paints
# the bride from the front-side, so her painted self is a valid colour target
# and a full per-channel pull measurably closes the gap. It paints the GROOM
# from behind: his reference pixels are a shadowed back against a warm chancel,
# 60 RGB redder and darker than any front-lit sprite should be, so pulling
# toward them turns a wine coat olive-brown -- tried both full and
# exposure-only, both wrong on the twin proof. Norton's church poses therefore
# take NO pull; the key already put him in the plate's light via the refsheet.
SET = [
    ('irene-street', 'gen2/irene-street-a.png', 'street', 'irene', 1, 'none',
     'her neutral standing pose. Beat III unit 5: she is out of the hall door '
     'and waiting to board; also her rest pose anywhere on the street'),
    ('irene-board', 'gen3/irene-street-c.png', 'street', 'irene', 1, 'none',
     'mid-step, near hand up for the carriage handle. Beat III unit 5, the '
     'moment she shoots out of the hall door and boards the landau'),
    ('irene-walk', 'gen4/irene-walk-a.png', 'street', 'irene', 4, 'strip',
     '4-frame walk cycle, strict profile facing the VIEWER\'S LEFT, feet '
     'baseline-aligned. She crosses from the hall door to the landau'),
    ('irene-bride', 'gen3/irene-bride-b.png', 'church', 'irene', 1, 'plate-full',
     'the bride at the altar, hands forward to be taken. Beat IV; the costume '
     "is locked to the church plate's own painted bride"),
    ('norton-street', 'gen2/norton-street-a.png', 'street', 'norton', 1, 'none',
     'top hat, gold watch open in his raised hand. Beat III unit 4 (l.622-624) '
     '"he pulled a gold watch from his pocket and looked at it earnestly"'),
    ('norton-run', 'gen4/norton-run-strip-a.png', 'street', 'norton', 4, 'strip',
     '4-frame run cycle, strict profile facing the VIEWER\'S RIGHT. Beat IV '
     'unit 4 seg `run` (l.654-655) "came running as hard as he could"'),
    ('norton-beckon', 'gen3/norton-beckon-b.png', 'church', 'norton', 1, 'none',
     'the two-handed beckon, palms curled to his own chest, mouth open. Beat '
     'IV units 5 and 7 -- the gate pose for `iv-07-comeman`, the one target '
     'click in the beat'),
    ('norton-groom', 'gen4/norton-groom-c.png', 'church', 'norton', 1, 'none',
     'the groom at the altar, both hands out to take hers. Beat IV unit 9; '
     "costume locked to the church plate's own painted groom"),
]

IDLE_FOR_STRIP = {'irene-walk': 'irene-street', 'norton-run': 'norton-street'}


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if p.returncode != 0:
        raise SystemExit('FAILED %s\n%s' % (' '.join(cmd[-3:]), p.stderr[-500:]))
    text = (p.stdout or '').strip()
    # These tools print EITHER one compact JSON line (matte, palettepull) or one
    # indented JSON object over many lines (stageproof). Try the whole payload
    # first: scanning line-by-line finds a bare "0.5" inside a pretty-printed
    # object and happily returns a float instead of the report.
    try:
        return json.loads(text)
    except Exception:
        pass
    for l in reversed([l for l in text.splitlines() if l.strip()]):
        try:
            v = json.loads(l)
        except Exception:
            continue
        if isinstance(v, dict):
            return v
    return {}


def spill(path):
    """max magenta excess IN THE RIM -- the only place it means spill.

    Measuring it over the whole figure was the mistake that hid the clamp
    damage: wine-burgundy and crimson score 24-31 on this measure honestly, so
    a whole-figure number can only be kept under a ceiling of 20 by repainting
    the costume. The rim is where backing bleed lives and where the ceiling is
    a real guarantee.
    """
    from matte_actors import _edge_band
    a = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32)
    ex = (a[..., 0] + a[..., 2]) * 0.5 - a[..., 1]
    band = _edge_band(a[..., 3] / 255.0)
    body = a[..., 3] > 250
    return {'rim_max': round(float(ex[band].max()), 1) if band.any() else 0.0,
            'body_max': round(float(ex[body].max()), 1) if body.any() else 0.0,
            'body_note': 'wine and crimson score high here BY DESIGN; only the '
                         'rim number is a spill gate'}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    keep = {s.strip() for s in a.only.split(',')} if a.only else None

    os.makedirs(OUT, exist_ok=True)
    os.makedirs(os.path.join(OUT, 'raws'), exist_ok=True)
    work = '/tmp/actors/pack'
    os.makedirs(work, exist_ok=True)

    entries = []
    keyed = {}
    for aid, raw, sset, who, frames, policy, role in SET:
        if keep and aid not in keep:
            continue
        raw_path = os.path.join(RAW, raw)
        k1 = os.path.join(work, aid + '.key.png')
        cmd = [PY, '-W', 'ignore', os.path.join(TOOLS, 'matte_actors.py'),
               raw_path, k1, '--json', os.path.join(work, aid + '.matte.json')]
        if frames > 1:
            cmd += ['--strip', str(frames)]
        m = run(cmd)
        keyed[aid] = k1

        final = os.path.join(work, aid + '.final.png')
        pull = None
        if policy == 'strip':
            idle = keyed.get(IDLE_FOR_STRIP[aid])
            if idle is None:
                idle = os.path.join(work, IDLE_FOR_STRIP[aid] + '.key.png')
            run([PY, '-W', 'ignore', os.path.join(ROOT, 'tools/laneassets/palettepull.py'),
                 k1, idle, final, str(frames), '0.65'])
            pull = {'kind': 'palettepull vs own idle', 'ref': IDLE_FOR_STRIP[aid],
                    'k': 0.65}
            # palettepull does not know about the spill ceiling; restore it.
            sys.path.insert(0, TOOLS)
            from matte_actors import clamp_spill_proportional, _edge_band
            im = Image.open(final).convert('RGBA')
            arr = np.asarray(im).astype(np.float32).copy()
            # RIM ONLY, and at the figure's own ceiling -- a whole-image clamp
            # here would undo the key's costume-aware correction and brown the
            # wine coat all over again.
            al = arr[..., 3] / 255.0
            band, interior = _edge_band(al), al > 0.98
            ex = (arr[..., 0] + arr[..., 2]) * 0.5 - arr[..., 1]
            ceil = max(20.0, float(np.percentile(ex[interior], 98))) \
                if interior.sum() > 500 else 20.0
            fixed = clamp_spill_proportional(arr[..., :3], ceil)
            arr[..., :3][band] = fixed[band]
            Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA').save(final)
            pull['spill_ceiling_reapplied'] = round(ceil, 1)
        elif policy.startswith('plate-'):
            mode = policy.split('-', 1)[1]
            r = run([PY, '-W', 'ignore', os.path.join(TOOLS, 'platepull.py'),
                     k1, sset, who, final, '--k', '0.65', '--mode', mode])
            pull = {'kind': "platepull vs the plate's own painted figure",
                    'k': 0.65, 'mode': mode,
                    'residual_before': r.get('residual_before_per_frame'),
                    'residual_after': r.get('residual_after_per_frame'),
                    'spill_ceiling_reapplied': r.get('spill_ceiling_reapplied')}
        else:
            shutil.copy(k1, final)
            pull = {'kind': 'none', 'why': (
                'the street and chase plates paint no figure to match; and St '
                "Monica's paints its groom from BEHIND, so its pixels are a "
                'shadowed back and are not a colour target for a front-lit '
                'sprite -- both a full and an exposure-only pull were measured '
                'and both browned the wine coat on the twin proof')}

        curated = os.path.join(OUT, aid + '.png')
        shutil.copy(final, curated)
        raw_copy = os.path.join(OUT, 'raws', os.path.basename(raw))
        shutil.copy(raw_path, raw_copy)

        proof = os.path.join(work, 'proof-' + aid + '.png')
        one = curated
        if frames > 1:
            im = Image.open(curated)
            cw = im.width // frames
            one = os.path.join(work, aid + '.f1.png')
            im.crop((0, 0, cw, im.height)).save(one)
        pr = run([PY, '-W', 'ignore', os.path.join(TOOLS, 'stageproof_actors.py'),
                  sset, who, one, proof])

        im = Image.open(curated)
        entries.append({
            'id': aid, 'file': aid + '.png', 'set': sset, 'who': who,
            'frames': frames, 'role': role,
            'size': list(im.size), 'bytes': os.path.getsize(curated),
            'sha256': sha(curated),
            'raw': {'file': 'raws/' + os.path.basename(raw),
                    'from': 'assets/raw/book/actors/' + raw,
                    'sha256': sha(raw_path)},
            'matte': m, 'pull': pull,
            'shipsAt': {
                'figure_px': round(G.px_height(who, sset), 1),
                'pxPerMetre': round(
                    G.STREET['pxPerMetre'] if sset == 'street'
                    else G.CHURCH['pxPerMetre'], 1),
                'height_m': G.HEIGHT_M[who],
            },
            'gates': {
                'magenta_excess': spill(curated),
                'magenta_excess_rim_ceiling': 20.0,
                'rim': pr.get('rim'),
                'palette': pr.get('palette'),
            },
            'proof': os.path.basename(proof),
        })
        print(json.dumps({'packed': aid, 'size': list(im.size),
                          'spill': spill(curated)}), flush=True)

    man_path = os.path.join(OUT, 'MANIFEST.json')
    manifest = {}
    if os.path.exists(man_path):
        with open(man_path) as f:
            manifest = json.load(f)
    # MERGE, don't replace: a --only re-pack of two actors must not delete the
    # other six from the manifest while their PNGs are still sitting in the
    # directory. Keyed by id, new entries win, order follows SET.
    merged = {e['id']: e for e in manifest.get('actors', [])}
    merged.update({e['id']: e for e in entries})
    order = [s[0] for s in SET]
    entries = sorted(merged.values(),
                     key=lambda e: order.index(e['id']) if e['id'] in order else 999)
    # THE CAMEO is a deliverable in its own right (CONTENT-full.md 7.2 GAP #11,
    # the one card Beat IV unit 5 raises on `thankgod`) and it is generated
    # t2i off the locked cameo template, not through the actor pipeline, so it
    # is recorded here rather than in the actor loop.
    cam = os.path.join(OUT, 'cameo-norton.png')
    cameo = None
    if os.path.exists(cam):
        cimg = Image.open(cam)
        cameo = {
            'id': 'cameo-norton', 'file': 'cameo-norton.png',
            'who': 'norton', 'kind': 'cameo card',
            'role': 'cameo `norton`, caption GODFREY NORTON, raised at '
                    '`iv-05-thankgod` (his first appearance). CONTENT-full.md '
                    '7.2 GAP #11 and 6.3 cameo table',
            'size': list(cimg.size), 'sha256': sha(cam),
            'bytes': os.path.getsize(cam),
            'raw': 'raws/cameo-norton-2.png',
            'conform': '1376x768 -> 1408x768 by gradient extrapolation of the '
                       'field, NO resample (tools/laneactors/conform_cameo.py)',
            'gate': 'tools/laneactors/cameocheck.py, scored against the five '
                    'shipped cameo cards',
        }
    manifest.update({
        'sharedDirectory': (
            'assets/plates/book/actors/ is shared with tools/lanereprise '
            '(Holmes in disguise, the fee plate). This lane owns exactly the '
            'files listed under `actors` and `cameo` here; it only ever '
            'UPDATES MANIFEST.json and never rewrites the sibling lane\'s '
            '`reprise` key.'),
        'cameo': cameo,
        'gaps_closed': [
            '7.2 GAP #4  -- actor IRENE: the street/boarding figure, a 4-frame '
            'walk, and the bride (blocks beats III and IV). NOT closed: the '
            'Beat VI reveal SILHOUETTE, which the ledger itself calls a '
            'different asset and which belongs inside the bay glass at the '
            "street lane's own 36.0 x 53.3 px/m, not on the pavement",
            '7.2 GAP #5  -- actor NORTON: the street figure with the gold '
            'watch, a 4-frame run, the two-handed beckon and the groom at the '
            'altar (blocks beats III and IV)',
            '7.2 GAP #11 -- cameo `norton`, the one card',
        ],
        'not_closed': {
            'irene-silhouette': 'Beat VI, behind the bay glass. Needs the '
                                'street lane\'s reveal box [698,318,806,430] '
                                'and reveal-back.png, and is a backlit '
                                'crimson-edged silhouette rather than a lit '
                                'figure -- a different generation, not a '
                                'relight of these sprites',
            'irene-in-landau / norton-in-hansom':
                'Beat III seats them in vehicles; the vehicle rigs (7.2 GAP '
                '#7) do not exist yet, and the seated cut depends on the rig '
                'geometry',
        },
        'lane': 'NEW ACTORS -- Irene Adler + Godfrey Norton',
        'generatedBy': 'tools/laneactors/* (pack_actors.py)',
        'plateSpace': [1408, 768],
        'law': {
            'content': 'CONTENT-full.md 7.2 items 4, 5 and 11',
            'reference': '/tmp/thebook/books/sherlock/book/main.js LINES + '
                         'story/COMPREHENSION.md',
            'styleTemplate': "tools/nbpro_prompts.json cameo prefix, verbatim",
            'pipeline': 'PIPELINE-LIVING.md stage 4 -- refsheet-locked i2i, '
                        'magenta key + spill ceiling, palette pull vs the '
                        'target plate, stageproof composite acceptance',
        },
        'scale': {
            'street_pxPerMetre': round(G.STREET['pxPerMetre'], 1),
            'street_measure': G.STREET['measure'],
            'church_pxPerMetre': round(G.CHURCH['pxPerMetre'], 1),
            'church_measure': G.CHURCH['measure'],
            'chase_pxPerMetre_at_rail_start': round(G.CHASE['pxPerMetreAtRailStart'], 1),
            'chase_measure': G.CHASE['measure'],
            'heights_m': G.HEIGHT_M,
            'module': 'tools/laneactors/actor_geom.py',
        },
        'actors': entries,
    })
    with open(man_path, 'w') as f:
        json.dump(manifest, f, indent=1)
    print(json.dumps({'manifest': man_path, 'actors': len(entries)}))


if __name__ == '__main__':
    main()
