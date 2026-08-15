#!/usr/bin/env python3
"""gate.py -- STAGE 3's acceptance gate: confined change, or rejected.

Wraps tools/laneassets/platediff.py and applies thresholds that were CALIBRATED
ON THE ART THAT ALREADY SHIPPED, not chosen to let this lane's output through.
Measured on Beat I's own variants before a single street variant existed:

    backdrop -> plate-darker        changed 18.51%  edge_iou 0.484  shift (0,0)
    plate-door -> -door-darker      changed 21.15%  edge_iou 0.508  shift (0,0)
    plate-door -> -door-open        changed  3.29%  edge_iou 0.637  shift (0,0)
                                    leak_ratio 0.40 against the door box

So: a relight moves a fifth of the frame and keeps half its edges; a confined
change moves a few per cent and keeps two thirds; and even a shipped confined
change leaks 40% of its changed pixels outside the box, because opening a door
also moves the light it lets out. The thresholds sit just outside those.

RULE 0, for every variant: best_global_shift must be exactly (0,0). A model that
re-rendered instead of editing comes back offset, and no amount of good-looking
is worth a set whose geometry moved under the actors' marks.

    python3 gate.py ORIG CAND OUTDIR --label id --kind relight|confined|plume
                    [--region x0,y0,x1,y1]
"""
import argparse
import json
import subprocess
import sys

PLATEDIFF = '/Users/samz/Documents/gaslight-remake/tools/laneassets/platediff.py'

# kind -> (max changed_pct, min edge_iou, max leak_ratio, must_darken)
RULES = {
    'relight':  (30.0, 0.45, None, True),
    'confined': (8.0, 0.55, 0.45, False),
    # a plume is new STRUCTURE in what was empty sky: it changes more of the
    # frame than a door and it destroys edges nowhere, it only adds them, so
    # the IoU floor is lower and the area ceiling higher. It still may not
    # touch the bay.
    'plume':    (18.0, 0.42, 0.35, False),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('orig')
    ap.add_argument('cand')
    ap.add_argument('outdir')
    ap.add_argument('--label', required=True)
    ap.add_argument('--kind', required=True, choices=sorted(RULES))
    ap.add_argument('--region', default='')
    ap.add_argument('--sacred', default='',
                    help='x0,y0,x1,y1 that must NOT change at all (the bay)')
    ap.add_argument('--sacred-max-pct', type=float, default=6.0)
    a = ap.parse_args()

    cmd = [sys.executable, PLATEDIFF, a.orig, a.cand, a.outdir, '--label', a.label]
    if a.region:
        cmd += ['--region', a.region]
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    if p.returncode != 0:
        print(json.dumps({'label': a.label, 'verdict': 'ERROR',
                          'stderr': p.stderr[-400:]}))
        sys.exit(2)
    d = json.loads(p.stdout)

    maxpct, minio, maxleak, darken = RULES[a.kind]
    fails = []
    sh = d['best_global_shift']
    if (sh['dx'], sh['dy']) != (0, 0):
        fails.append('global shift (%d,%d) - the model re-rendered, it did not edit'
                     % (sh['dx'], sh['dy']))
    if d['changed_pct'] > maxpct:
        fails.append('changed %.2f%% > %.1f%%' % (d['changed_pct'], maxpct))
    if d['edge_iou'] < minio:
        fails.append('edge_iou %.3f < %.2f - the geometry moved' % (d['edge_iou'], minio))
    if maxleak is not None and 'leak_ratio' in d and d['leak_ratio'] > maxleak:
        fails.append('leak_ratio %.3f > %.2f - the change escaped its region'
                     % (d['leak_ratio'], maxleak))
    if darken and d['mean_lum_cand'] >= d['mean_lum_orig']:
        fails.append('mean lum %.1f -> %.1f, not darker'
                     % (d['mean_lum_orig'], d['mean_lum_cand']))

    sacred = None
    if a.sacred:
        import numpy as np
        from PIL import Image
        x0, y0, x1, y1 = [int(v) for v in a.sacred.split(',')]
        o = np.asarray(Image.open(a.orig).convert('RGB').resize((1408, 768))).astype(float)
        c = np.asarray(Image.open(a.cand).convert('RGB').resize((1408, 768))).astype(float)
        m = np.abs(o - c).max(axis=2)[y0:y1, x0:x1] > 18
        sacred = {'box': [x0, y0, x1, y1], 'changed_pct': round(float(m.mean() * 100), 2)}
        if sacred['changed_pct'] > a.sacred_max_pct:
            fails.append('SACRED box changed %.2f%% > %.1f%% - the reveal surface '
                         'was touched' % (sacred['changed_pct'], a.sacred_max_pct))

    out = {'label': a.label, 'kind': a.kind,
           'verdict': 'REJECT' if fails else 'PASS', 'fails': fails,
           'changed_pct': d['changed_pct'], 'edge_iou': d['edge_iou'],
           'shift': [sh['dx'], sh['dy']], 'resid': sh['resid_mean_abs_lum'],
           'lum': [d['mean_lum_orig'], d['mean_lum_cand']],
           'leak_ratio': d.get('leak_ratio'), 'bbox': d['bbox'],
           'sacred': sacred}
    print(json.dumps(out))
    with open('%s/%s-gate.json' % (a.outdir, a.label), 'w') as f:
        json.dump(out, f, indent=1)
    sys.exit(0 if not fails else 1)


if __name__ == '__main__':
    main()
