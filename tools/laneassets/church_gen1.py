#!/usr/bin/env python3
"""church_gen1.py -- stage 1 of the PLATE lane for SET `church`.

Fires the stage-1 candidates in parallel, each with a hard wall-clock timeout so
a hung model can never stall the lane. Raw-first: every call writes its bytes
verbatim and appends a full entry (prompt, model, sha256, params) to the lane
manifest via nbpro.py / nbpro_edit.py themselves.

Two candidates are text-to-image off the LOCKED PLATE TEMPLATE + a scene seed
(church-a composition-first, church-b staging-first); a third is an i2i re-frame
of the approved immutable reference plate, which church.js declares is the file
every one of its colours was sampled from.

    python3 church_gen1.py OUTDIR [--reps 2] [--timeout 420]

--reps N asks for N independent draws of each candidate (the API is stochastic;
one draw is a sample, not a candidate), suffixed -1, -2, ...
"""
import argparse
import concurrent.futures as cf
import json
import os
import subprocess
import sys
import time

ROOT = '/Users/samz/Documents/gaslight-remake'
SPEC = os.path.join(ROOT, 'tools', 'laneassets', 'church-stage1.json')
T2I = os.path.join(ROOT, 'tools', 'nbpro.py')
I2I = os.path.join(ROOT, 'tools', 'nbpro_edit.py')


def run(cmd, ident, timeout):
    t0 = time.time()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        tail = (p.stdout or '').strip().splitlines()
        payload = {}
        if tail:
            try:
                payload = json.loads(tail[-1])
            except Exception:
                payload = {'raw': tail[-1][:300]}
        return {'id': ident, 'rc': p.returncode, 'secs': round(time.time() - t0, 1),
                'res': payload, 'stderr': (p.stderr or '')[-300:]}
    except subprocess.TimeoutExpired:
        return {'id': ident, 'rc': 'TIMEOUT', 'secs': round(time.time() - t0, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('outdir')
    ap.add_argument('--reps', type=int, default=2)
    ap.add_argument('--timeout', type=int, default=420)
    ap.add_argument('--workers', type=int, default=6)
    a = ap.parse_args()

    spec = json.load(open(SPEC))
    os.makedirs(a.outdir, exist_ok=True)
    man = os.path.join(a.outdir, 'manifest.json')

    jobs = []
    for c in spec['candidates']:
        prompt = spec['lock'] + c['seed']
        for i in range(1, a.reps + 1):
            ident = '%s-%d' % (c['id'], i)
            out = os.path.join(a.outdir, ident + '.png')
            jobs.append(([sys.executable, T2I, '--prompt', prompt, '--out', out,
                          '--manifest', man, '--aspect', '16:9'], ident))
    r = spec['reframe']
    for i in range(1, a.reps + 1):
        ident = '%s-%d' % (r['id'], i)
        out = os.path.join(a.outdir, ident + '.png')
        jobs.append(([sys.executable, I2I, '--image', r['image'],
                      '--prompt', r['prompt'], '--out', out,
                      '--manifest', man], ident))

    print(json.dumps({'stage': 1, 'jobs': len(jobs), 'outdir': a.outdir}), flush=True)
    results = []
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = [ex.submit(run, c, i, a.timeout) for c, i in jobs]
        for f in cf.as_completed(futs):
            res = f.result()
            results.append(res)
            print(json.dumps(res), flush=True)
    ok = sum(1 for x in results if x.get('rc') == 0)
    print(json.dumps({'stage1_done': True, 'ok': ok, 'total': len(results)}), flush=True)


if __name__ == '__main__':
    main()
