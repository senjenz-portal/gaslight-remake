#!/usr/bin/env python3
"""gent2i.py -- run a batch of nbpro.py TEXT-TO-IMAGE jobs in parallel.

The sibling tools/laneassets/gen.py only drives nbpro_edit.py (i2i). Stage 1 of
the plate pipeline is a fresh master plate, which is t2i, and nbpro.py takes the
key from the ENVIRONMENT only -- so this runner parses the key out of the
story-orbit .env IN PYTHON (that file has a zsh parse error mid-file; never
shell-source it) and hands it to each child through its env. The value is never
printed, never written to a manifest, never passed on a command line.

Jobs live in a JSON file: [{"id","out","prompt"[,"models"][,"manifest"]}...].
Every job gets a hard wall-clock timeout so a hung model cannot stall the lane;
every result is appended to the lane manifest by nbpro.py itself (raw-first).

    python3 gent2i.py /abs/jobs.json [--timeout 420] [--workers 4] [--only id,id]
"""
import argparse
import concurrent.futures as cf
import json
import os
import subprocess
import sys
import time

NBPRO = '/Users/samz/Documents/gaslight-remake/tools/nbpro.py'
ENV_FILE_DEFAULT = '/Users/samz/Documents/story-orbit/.env'


def _key():
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        envfile = os.environ.get('GEMINI_ENV_FILE', ENV_FILE_DEFAULT)
        try:
            for line in open(envfile):
                line = line.strip()
                if line.startswith('GEMINI_API_KEY='):
                    key = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break
        except OSError:
            pass
    if not key:
        sys.exit('GEMINI_API_KEY not found (env or env-file)')
    return key


def run(job, timeout, env):
    t0 = time.time()
    cmd = [sys.executable, NBPRO, '--out', job['out'], '--prompt', job['prompt']]
    if job.get('manifest'):
        cmd += ['--manifest', job['manifest']]
    if job.get('models'):
        cmd += ['--models', job['models']]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True,
                           timeout=timeout, env=env)
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
        return {'id': job['id'], 'rc': 'TIMEOUT', 'secs': round(time.time() - t0, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('jobs')
    ap.add_argument('--timeout', type=int, default=420)
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--only', default='')
    a = ap.parse_args()

    jobs = json.load(open(a.jobs))
    if a.only:
        keep = {s.strip() for s in a.only.split(',')}
        jobs = [j for j in jobs if j['id'] in keep]
    for j in jobs:
        os.makedirs(os.path.dirname(j['out']), exist_ok=True)

    env = dict(os.environ)
    env['GEMINI_API_KEY'] = _key()

    results = []
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {ex.submit(run, j, a.timeout, env): j for j in jobs}
        for f in cf.as_completed(futs):
            r = f.result()
            results.append(r)
            print(json.dumps(r), flush=True)
    ok = sum(1 for r in results if r.get('rc') == 0)
    print(json.dumps({'batch_done': True, 'ok': ok, 'total': len(results)}))


if __name__ == '__main__':
    main()
