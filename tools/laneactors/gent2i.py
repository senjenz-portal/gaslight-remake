#!/usr/bin/env python3
"""gent2i.py -- run a batch of nbpro.py TEXT-TO-IMAGE jobs in parallel.

The sibling laneassets/gen.py drives nbpro_edit.py (i2i). Cameo cards are t2i
off the locked style template, so they need nbpro.py and its --aspect flag,
which gen.py cannot pass. Same discipline: hard wall-clock timeout per job so a
hung model can never stall the lane; every result lands in the lane manifest by
nbpro.py itself (raw-first).

    python3 gent2i.py /abs/jobs.json [--timeout 420] [--workers 4] [--only id,id]
"""
import argparse
import concurrent.futures as cf
import json
import os
import subprocess
import sys
import time

GEN = '/Users/samz/Documents/gaslight-remake/tools/nbpro.py'
MANIFEST = ('/Users/samz/Documents/gaslight-remake/assets/raw/book/actors/'
            'manifest.json')


def run(job, timeout, manifest):
    t0 = time.time()
    cmd = [sys.executable, GEN, '--out', job['out'], '--prompt', job['prompt'],
           '--manifest', job.get('manifest', manifest)]
    if job.get('aspect'):
        cmd += ['--aspect', job['aspect']]
    if job.get('models'):
        cmd += ['--models', job['models']]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        out = (p.stdout or '').strip().splitlines()
        payload = {}
        if out:
            try:
                payload = json.loads(out[-1])
            except Exception:
                payload = {'raw': out[-1][:300]}
        return {'id': job['id'], 'rc': p.returncode,
                'secs': round(time.time() - t0, 1), 'res': payload,
                'stderr': (p.stderr or '')[-300:]}
    except subprocess.TimeoutExpired:
        return {'id': job['id'], 'rc': 'TIMEOUT',
                'secs': round(time.time() - t0, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('jobs')
    ap.add_argument('--timeout', type=int, default=420)
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--only', default='')
    ap.add_argument('--manifest', default=MANIFEST)
    a = ap.parse_args()

    jobs = json.load(open(a.jobs))
    if a.only:
        keep = {s.strip() for s in a.only.split(',')}
        jobs = [j for j in jobs if j['id'] in keep]
    for j in jobs:
        os.makedirs(os.path.dirname(j['out']), exist_ok=True)

    results = []
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {ex.submit(run, j, a.timeout, a.manifest): j for j in jobs}
        for f in cf.as_completed(futs):
            r = f.result()
            results.append(r)
            print(json.dumps(r), flush=True)
    ok = sum(1 for r in results if r.get('rc') == 0)
    print(json.dumps({'batch_done': True, 'ok': ok, 'total': len(results)}))


if __name__ == '__main__':
    main()
