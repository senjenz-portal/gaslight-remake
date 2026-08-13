#!/usr/bin/env python3
"""church_gen3.py -- stage 3 of the PLATE lane for SET `church`.

Fires every state variant in parallel, each under a hard wall-clock timeout so a
hung model cannot stall the lane. Raw-first: nbpro_edit.py writes bytes verbatim
and appends the full entry (input image + sha, prompt, model, params) to the
lane manifest itself.

    python3 church_gen3.py OUTDIR [--reps 3] [--timeout 420]
"""
import argparse, concurrent.futures as cf, json, os, subprocess, sys, time

ROOT = '/Users/samz/Documents/gaslight-remake'
SPEC = os.path.join(ROOT, 'tools', 'lanechurch', 'church-stage3.json')
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
        return {'id': ident, 'rc': p.returncode,
                'secs': round(time.time() - t0, 1), 'res': payload,
                'stderr': (p.stderr or '')[-300:]}
    except subprocess.TimeoutExpired:
        return {'id': ident, 'rc': 'TIMEOUT', 'secs': round(time.time() - t0, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('outdir')
    ap.add_argument('--reps', type=int, default=3)
    ap.add_argument('--timeout', type=int, default=420)
    ap.add_argument('--workers', type=int, default=6)
    a = ap.parse_args()

    spec = json.load(open(SPEC))
    os.makedirs(a.outdir, exist_ok=True)
    man = os.path.join(a.outdir, 'manifest.json')

    jobs = []
    for v in spec['variants']:
        for i in range(1, a.reps + 1):
            ident = '%s-%d' % (v['id'], i)
            out = os.path.join(a.outdir, ident + '.png')
            jobs.append(([sys.executable, I2I, '--image', spec['base'],
                          '--prompt', v['prompt'], '--out', out,
                          '--manifest', man], ident))

    print(json.dumps({'stage': 3, 'jobs': len(jobs), 'outdir': a.outdir}), flush=True)
    results = []
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = [ex.submit(run, c, i, a.timeout) for c, i in jobs]
        for f in cf.as_completed(futs):
            r = f.result(); results.append(r)
            print(json.dumps(r), flush=True)
    print(json.dumps({'stage3_done': True,
                      'ok': sum(1 for x in results if x.get('rc') == 0),
                      'total': len(results)}), flush=True)


if __name__ == '__main__':
    main()
