#!/usr/bin/env python3
"""shotclip_gate.py -- SHOTGEN clip gates, the gate_b.py (prototype B) laws
generalized for full-frame shot clips.

(a) IDENTITY: darkest-2% warm/cool (mean R-B) inside each declared character
    box on 6 sampled frames, each within +-20 of the CANONICAL measured on
    the SEED (the gated repainted poster the clip was conditioned on).
(b) LUMA (deflicker law, [strip-luma <= 4]): mean luma of the BG region
    (complement of the character boxes AND the declared firebox -- the
    subject that is ALLOWED to flicker) between ADJACENT sampled frames
    <= 4.0. If pumping, ffmpeg deflicker ONCE and re-measure.
(c) BG drift (info + gate): block means vs frame0, changed-block share
    <= 0.08 (the prototype's bound).
Also reported: frame0-vs-seed block match.

Usage: shotclip_gate.py <cfg.json> <clip.mp4>
cfg: { "seed": path, "boxes": {WHO: [x0,y0,x1,y1]}, "firebox": [..] optional }
boxes are 1366x768 frame px; frames + seed are normalized to 1366x768.
Prints JSON; exit 0 iff ok. Writes <clip>.deflick.mp4 if deflickered.
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

N = 6
IDENTITY_TOL = 20.0
LUMA_D_MAX = 4.0
BG_BLOCK = 32
BG_BLOCK_D = 12.0
BG_DRIFT_MAX = 0.08
SEED_BLOCK_D = 24.0
W, H = 1366, 768


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-300:])
    return r.stdout


def luma(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def warmcool(a, box):
    x0, y0, x1, y1 = box
    r = a[y0:y1, x0:x1].astype(np.float32).reshape(-1, 3)
    lu = (r[:, 0] * 0.299 + r[:, 1] * 0.587 + r[:, 2] * 0.114)
    k = max(30, int(0.02 * lu.size))
    idx = np.argpartition(lu, k)[:k]
    sel = r[idx]
    return float(np.mean(sel[:, 0] - sel[:, 2]))


def load(path):
    return np.asarray(Image.open(path).convert('RGB').resize((W, H), Image.LANCZOS))


def sample(clip, n):
    dur = float(json.loads(sh(['ffprobe', '-v', 'error', '-show_entries',
                               'format=duration', '-of', 'json', clip]))['format']['duration'])
    ts = [dur * i / (n - 1) for i in range(n)]
    ts[-1] = max(0.0, dur - 0.07)
    frames = []
    with tempfile.TemporaryDirectory() as td:
        for i, t in enumerate(ts):
            p = os.path.join(td, '%d.png' % i)
            sh(['ffmpeg', '-y', '-ss', '%.3f' % t, '-i', clip, '-frames:v', '1', p])
            frames.append(load(p))
    return ts, frames


def measure(cfg, clip):
    seed = load(cfg['seed'])
    mask = np.ones((H, W), bool)
    for box in list(cfg['boxes'].values()) + ([cfg['firebox']] if cfg.get('firebox') else []):
        x0, y0, x1, y1 = box
        mask[y0:y1, x0:x1] = False
    canon = {w: warmcool(seed, b) for w, b in cfg['boxes'].items()}
    ts, fr = sample(clip, N)

    def blocks(a):
        lu = luma(a.astype(np.float32))
        out = []
        for by in range(0, H - BG_BLOCK + 1, BG_BLOCK):
            for bx in range(0, W - BG_BLOCK + 1, BG_BLOCK):
                mb = mask[by:by + BG_BLOCK, bx:bx + BG_BLOCK]
                if mb.mean() > 0.5:
                    out.append(lu[by:by + BG_BLOCK, bx:bx + BG_BLOCK][mb].mean())
        return np.array(out)

    ident = {}
    id_ok = True
    for who, box in cfg['boxes'].items():
        wc = [warmcool(f, box) for f in fr]
        deltas = [abs(v - canon[who]) for v in wc]
        ok = all(d <= IDENTITY_TOL for d in deltas)
        id_ok = id_ok and ok
        ident[who] = {'canonical': round(canon[who], 2),
                      'warmcool': [round(v, 2) for v in wc],
                      'delta': [round(d, 2) for d in deltas], 'ok': ok}
    bg_lu = [float(luma(f.astype(np.float32))[mask].mean()) for f in fr]
    lu_d = [abs(bg_lu[i + 1] - bg_lu[i]) for i in range(len(bg_lu) - 1)]
    lu_ok = all(d <= LUMA_D_MAX for d in lu_d)
    b0, bs = blocks(fr[0]), blocks(seed)
    drift = [float((np.abs(blocks(f) - b0) > BG_BLOCK_D).mean()) for f in fr[1:]]
    return {
        'sampledAt': [round(t, 3) for t in ts],
        'identity': ident, 'identity_ok': id_ok,
        'bg_luma': [round(v, 2) for v in bg_lu],
        'luma_delta': [round(d, 2) for d in lu_d], 'luma_ok': lu_ok,
        'seed_match': round(float((np.abs(b0 - bs) > SEED_BLOCK_D).mean()), 4),
        'bg_drift': [round(d, 4) for d in drift],
        'bg_drift_ok': all(d <= BG_DRIFT_MAX for d in drift),
    }


def main():
    cfg = json.load(open(sys.argv[1]))
    clip = sys.argv[2]
    res = measure(cfg, clip)
    res['deflickered'] = False
    res['clip'] = clip
    if not res['luma_ok']:
        df = clip.replace('.mp4', '.deflick.mp4')
        sh(['ffmpeg', '-y', '-i', clip, '-vf', 'deflicker', '-c:v', 'libx264',
            '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', df])
        res = measure(cfg, df)
        res['deflickered'] = True
        res['clip'] = df
    res['ok'] = bool(res['identity_ok'] and res['luma_ok'] and res['bg_drift_ok'])
    print(json.dumps(res, indent=1))
    sys.exit(0 if res['ok'] else 1)


if __name__ == '__main__':
    main()
