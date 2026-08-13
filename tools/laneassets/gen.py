#!/usr/bin/env python3
"""gen.py -- run a batch of nbpro_edit.py i2i jobs in parallel, with timeouts.

Jobs live in a JSON file: [{"id","image","out","prompt"}...]. Every job gets a
hard wall-clock timeout so a hung model can never stall the lane, and every
result is appended to the lane manifest by nbpro_edit.py itself (raw-first).

    python3 gen.py /abs/jobs.json [--timeout 420] [--workers 6] [--only id,id]
"""
import argparse
import concurrent.futures as cf
import json
import os
import subprocess
import sys
import time

EDIT = '/Users/samz/Documents/gaslight-remake/tools/nbpro_edit.py'
MANIFEST = '/Users/samz/Documents/gaslight-remake/assets/raw/beat1/manifest.json'


def run(job, timeout):
    t0 = time.time()
    cmd = [sys.executable, EDIT,
           '--image', job['image'], '--out', job['out'],
           '--prompt', job['prompt'], '--manifest', job.get('manifest', MANIFEST)]
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
        return {'id': job['id'], 'rc': p.returncode, 'secs': round(time.time() - t0, 1),
                'res': payload, 'stderr': (p.stderr or '')[-300:]}
    except subprocess.TimeoutExpired:
        return {'id': job['id'], 'rc': 'TIMEOUT', 'secs': round(time.time() - t0, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('jobs')
    ap.add_argument('--timeout', type=int, default=420)
    ap.add_argument('--workers', type=int, default=6)
    ap.add_argument('--only', default='')
    a = ap.parse_args()

    jobs = json.load(open(a.jobs))
    if a.only:
        keep = {s.strip() for s in a.only.split(',')}
        jobs = [j for j in jobs if j['id'] in keep]
    for j in jobs:
        os.makedirs(os.path.dirname(j['out']), exist_ok=True)

    results = []
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {ex.submit(run, j, a.timeout): j for j in jobs}
        for f in cf.as_completed(futs):
            r = f.result()
            results.append(r)
            print(json.dumps(r), flush=True)
    ok = sum(1 for r in results if r.get('rc') == 0)
    print(json.dumps({'batch_done': True, 'ok': ok, 'total': len(results)}))


if __name__ == '__main__':
    main()
