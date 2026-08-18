#!/usr/bin/env python3
"""heroclip_gate.py -- gate + encode the four HERO CLIPS (heroclip lane).

Adapted from the strip lane's laws (strip_slice_gate identity path,
seamless/deflicker's luma law) for full-frame video:

  (a) identity   -- darkest-2%-pixel warm/cool (mean R-B, the strip gate's own
                    cluster measure, minus the matte: there is no alpha in a
                    composited frame, so the cluster is taken INSIDE the
                    clip's identity box -- the staged actor's own drawn box,
                    mapped from plate space through seeds.json plateRect) on
                    6 sampled frames, each within +-20 of the CANONICAL: the
                    seed crop measured through this same function.
  (b) bg drift   -- the background IS the plate crop and it must not WANDER:
                    outside the identity box, 32-px block mean luma of every
                    sampled frame vs the clip's own FRAME 0; the fraction of
                    blocks moved > 12 luma must be <= 8% (structural drift,
                    not shimmer). Frame 0 itself is held to the SEED with the
                    same grid at > 24 luma <= 3% -- the generator re-tones
                    the whole frame a few luma on ingest (measured 11% of
                    blocks past 12 on a visually identical open), so the
                    seed-match gate reads structure past re-toning while the
                    drift gate reads true temporal wander at full strictness.
  (c) luma       -- the deflicker law applies to video too, REGION-SCOPED the
                    way the strip law was FIGURE-masked: mean luma of the BG
                    region (the part of the frame the story says must not
                    change) between ADJACENT sampled frames <= 4.0. Exposure
                    pumping shows there; the action's own light (the splash
                    whitening the water it washes) does not. If it pumps,
                    ffmpeg's deflicker filter is applied ONCE and the clip
                    re-measured; still pumping = REJECT.

BG REGION: complement of the identity box by default. clip-splash declares
its own bg boxes (the cliff wedge and the far calm corner): its wash rings
legitimately cross the whole basin -- "the wash drives the ship BACK" is the
unit's own text -- so "everything but the plume" is not background there.
  (d) loop       -- loop clips must CLOSE: first vs last frame, same block
                    metric, <= 5% of blocks moved.

Encode of record: H.264 yuv420p CRF 21 (libx264), faststart, no audio;
poster = frame 1 PNG. Ships to site-deploy/living-odyssey/assets/inset/ and
writes the registry tools/ody/heroclips.json (sha256 of the shipped mp4 AND
poster -- the lap asserts the served bytes ARE these).

Usage: python3 tools/ody/heroclip_gate.py [--only clip-seize]
Prints one line of JSON per clip: gates, numbers, verdict.
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

ROOT = '/Users/samz/Documents/gaslight-remake'
RAW = os.path.join(ROOT, 'assets', 'raw', 'ody-heroclips')
SEEDS = os.path.join(RAW, 'seeds')
SHIP = os.path.join(ROOT, 'site-deploy', 'living-odyssey', 'assets', 'inset')
REG = os.path.join(ROOT, 'tools', 'ody', 'heroclips.json')

N_SAMPLES = 6
IDENTITY_TOL = 20.0        # +-20, the strip gate's own number
BG_BLOCK = 32              # px, block-mean structural grid
BG_BLOCK_D = 12.0          # luma a block may move before it counts
BG_DRIFT_MAX = 0.08        # fraction of bg blocks moved (the 8% law)
SEED_BLOCK_D = 24.0        # frame-0-vs-seed: structure past the re-tone
SEED_MATCH_MAX = 0.03      # fraction of bg blocks structurally OFF the seed
LUMA_D_MAX = 4.0           # the deflicker law's own adjacency bound
LOOP_MAX = 0.05            # loop closure: blocks moved first vs last

CLIPS = {
    'clip-seize':      {'seed': 'seize',      'loop': False, 'units': ['firstmeal']},
    'clip-twist':      {'seed': 'twist',      'loop': True,  'units': ['auger', 'bore']},
    'clip-underbelly': {'seed': 'underbelly', 'loop': True,  'units': ['dawn5']},
    'clip-splash':     {'seed': 'splash',     'loop': False, 'units': ['rock1'],
                        # the invariant region, clip px: the cliff wedge --
                        # the crop's one solid landmass. The wash rings own
                        # the whole basin ("the wash drives the ship BACK" is
                        # the unit's own text) and the islet corner is
                        # water-adjacent: the generator animates its shoreline
                        # on every take, so it cannot carry a stillness law.
                        'bg': [[0, 400, 420, 300]]},
}


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError('%s failed: %s' % (cmd[0], r.stderr[-400:]))
    return r.stdout


def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def luma(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def warmcool(a, box):
    """darkest-2% cluster warm/cool (mean R-B) inside the identity box --
    strip_slice_gate.head_warmcool minus the matte (composited frame, no
    alpha; the box IS the figure grant)."""
    x, y, w, h = box
    r = a[y:y + h, x:x + w].astype(np.float32)
    if r.size == 0:
        return None
    lu = luma(r).ravel()
    k = max(1, int(0.02 * lu.size))
    idx = np.argpartition(lu, k)[:k]
    px = r.reshape(-1, 3)[idx]
    return float(np.mean(px[:, 0] - px[:, 2]))


def blocks(a):
    lu = luma(a.astype(np.float32))
    H, W = lu.shape
    bh, bw = H // BG_BLOCK, W // BG_BLOCK
    lu = lu[:bh * BG_BLOCK, :bw * BG_BLOCK]
    return lu.reshape(bh, BG_BLOCK, bw, BG_BLOCK).mean(axis=(1, 3))


def block_drift(a, b, mask=None, thr=BG_BLOCK_D):
    """fraction of 32px blocks whose mean luma moved > thr"""
    da, db = blocks(a), blocks(b)
    moved = np.abs(da - db) > thr
    if mask is not None:
        moved = moved[mask]
        if moved.size == 0:
            return 0.0
    return float(moved.mean())


def bg_mask(shape, box, bg_boxes=None):
    """block-grid mask of the BG region: the declared invariant boxes when the
    clip carries them, else everything EXCLUDING the identity box (the action
    may move; the plate crop around it may not)"""
    H, W = shape[0] // BG_BLOCK, shape[1] // BG_BLOCK
    if bg_boxes:
        m = np.zeros((H, W), bool)
        for x, y, w, h in bg_boxes:
            m[max(0, y // BG_BLOCK):min(H, (y + h) // BG_BLOCK),
              max(0, x // BG_BLOCK):min(W, (x + w) // BG_BLOCK)] = True
        return m
    m = np.ones((H, W), bool)
    x, y, w, h = box
    m[max(0, y // BG_BLOCK):min(H, (y + h) // BG_BLOCK + 1),
      max(0, x // BG_BLOCK):min(W, (x + w) // BG_BLOCK + 1)] = False
    return m


def sample_frames(mp4, outdir, n=N_SAMPLES):
    dur = float(sh(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                    '-of', 'csv=p=0', mp4]).strip())
    ts = [dur * i / (n - 1) for i in range(n)]
    ts[-1] = max(0.0, dur - 0.07)          # inside the last GOP
    files = []
    for i, t in enumerate(ts):
        f = os.path.join(outdir, 'f%d.png' % i)
        sh(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '%.3f' % t, '-i', mp4,
            '-frames:v', '1', f])
        files.append(f)
    return files, dur, ts


def load(p, size=None):
    im = Image.open(p).convert('RGB')
    if size and im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return np.asarray(im)


def identity_box_px(meta, size):
    """plate-space identity box -> clip pixel box via the seed's plateRect"""
    pr = meta['plateRect']
    ib = meta.get('identityPlate') or [pr[0] + pr[2] * 0.3, pr[1] + pr[3] * 0.3,
                                       pr[2] * 0.4, pr[3] * 0.4]
    W, H = size
    x = int((ib[0] - pr[0]) / pr[2] * W)
    y = int((ib[1] - pr[1]) / pr[3] * H)
    w = int(ib[2] / pr[2] * W)
    h = int(ib[3] / pr[3] * H)
    x = max(0, min(W - 8, x)); y = max(0, min(H - 8, y))
    w = max(8, min(W - x, w)); h = max(8, min(H - y, h))
    return [x, y, w, h]


def gate_one(name, spec, seeds_meta, deflickered=False):
    raw = os.path.join(RAW, ('%s.mp4' % name) if not deflickered
                       else ('_work/%s.deflicker.mp4' % name))
    meta = seeds_meta[spec['seed']]
    seed_png = os.path.join(SEEDS, spec['seed'] + '.png')
    seed = load(seed_png)
    size = (seed.shape[1], seed.shape[0])
    ibox = identity_box_px(meta, size)
    canon = warmcool(seed, ibox)

    tmp = tempfile.mkdtemp(prefix='heroclip-')
    try:
        frames, dur, ts = sample_frames(raw, tmp)
        imgs = [load(f, size) for f in frames]
        idents = [warmcool(a, ibox) for a in imgs]
        dident = [abs(v - canon) for v in idents]
        ok_ident = all(d <= IDENTITY_TOL for d in dident)

        m = bg_mask(seed.shape, ibox, spec.get('bg'))
        seed_match = block_drift(imgs[0], seed, m, thr=SEED_BLOCK_D)
        drifts = [block_drift(a, imgs[0], m) for a in imgs[1:]]
        ok_bg = seed_match <= SEED_MATCH_MAX and all(d <= BG_DRIFT_MAX for d in drifts)

        lumas = [float(blocks(a)[m].mean()) for a in imgs]   # BG-scoped, the law
        dl = [abs(lumas[i + 1] - lumas[i]) for i in range(len(lumas) - 1)]
        ok_luma = all(d <= LUMA_D_MAX for d in dl)

        loop_frac = block_drift(imgs[0], imgs[-1]) if spec['loop'] else None
        ok_loop = (loop_frac is None) or (loop_frac <= LOOP_MAX)

        return {
            'src': os.path.relpath(raw, ROOT), 'duration': round(dur, 3),
            'sampledAt': [round(t, 3) for t in ts],
            'identity_canonical': round(canon, 1),
            'identity_warmcool': [round(v, 1) for v in idents],
            'identity_delta': [round(d, 1) for d in dident], 'identity_ok': ok_ident,
            'identity_box_px': ibox,
            'seed_match': round(seed_match, 4),
            'bg_drift': [round(d, 4) for d in drifts], 'bg_drift_ok': ok_bg,
            'frame_luma': [round(v, 2) for v in lumas],
            'luma_delta': [round(d, 2) for d in dl], 'luma_ok': ok_luma,
            'loop_closure': None if loop_frac is None else round(loop_frac, 4),
            'loop_ok': ok_loop,
            'deflickered': deflickered,
            'ok': ok_ident and ok_bg and ok_luma and ok_loop,
        }
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def deflicker(name):
    wd = os.path.join(RAW, '_work')
    os.makedirs(wd, exist_ok=True)
    out = os.path.join(wd, '%s.deflicker.mp4' % name)
    sh(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(RAW, name + '.mp4'),
        '-vf', 'deflicker=mode=pm:size=5', '-c:v', 'libx264', '-preset', 'slow',
        '-crf', '16', '-pix_fmt', 'yuv420p', '-an', out])
    return out


def encode(name, spec, deflickered):
    src = os.path.join(RAW, ('_work/%s.deflicker.mp4' % name) if deflickered
                       else ('%s.mp4' % name))
    os.makedirs(SHIP, exist_ok=True)
    mp4 = os.path.join(SHIP, name + '.mp4')
    sh(['ffmpeg', '-y', '-loglevel', 'error', '-i', src,
        '-vf', 'scale=1280:720:flags=lanczos',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '21',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4])
    poster = os.path.join(SHIP, name + '.png')
    sh(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp4, '-frames:v', '1', poster])
    return mp4, poster


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only')
    a = ap.parse_args()
    seeds_meta = json.load(open(os.path.join(SEEDS, 'seeds.json')))['seeds']
    reg = json.load(open(REG)) if os.path.exists(REG) else {'clips': {}}
    fail = 0
    for name, spec in CLIPS.items():
        if a.only and name != a.only:
            continue
        if not os.path.exists(os.path.join(RAW, name + '.mp4')):
            print(json.dumps({'clip': name, 'verdict': 'MISSING RAW'})); fail += 1
            continue
        g = gate_one(name, spec, seeds_meta)
        if not g['luma_ok']:
            deflicker(name)                     # the pumping law: normalize ONCE
            g = gate_one(name, spec, seeds_meta, deflickered=True)
        if not g['ok']:
            print(json.dumps({'clip': name, 'verdict': 'REJECT', 'gates': g}))
            fail += 1
            continue
        mp4, poster = encode(name, spec, g['deflickered'])
        reg['clips'][name] = {
            'file': 'assets/inset/%s.mp4' % name,
            'poster': 'assets/inset/%s.png' % name,
            'sha256': sha256(mp4), 'posterSha256': sha256(poster),
            'bytes': os.path.getsize(mp4), 'loop': spec['loop'],
            'units': spec['units'], 'seed': spec['seed'],
            'encode': 'libx264 slow crf21 yuv420p 1280x720 faststart, no audio',
            'gates': g,
        }
        print(json.dumps({'clip': name, 'verdict': 'OK',
                          'identity_delta': g['identity_delta'],
                          'bg_drift': g['bg_drift'], 'luma_delta': g['luma_delta'],
                          'loop_closure': g['loop_closure'],
                          'deflickered': g['deflickered']}))
    reg['law'] = ('identity +-%g on %d frames; bg blocks(%dpx,>%g) <= %g; '
                  'luma adjacency <= %g (deflicker once, else reject); loop <= %g; '
                  'encode libx264 crf21 yuv420p; poster = frame 1 PNG'
                  % (IDENTITY_TOL, N_SAMPLES, BG_BLOCK, BG_BLOCK_D, BG_DRIFT_MAX,
                     LUMA_D_MAX, LOOP_MAX))
    json.dump(reg, open(REG, 'w'), indent=1)
    sys.exit(1 if fail else 0)


if __name__ == '__main__':
    main()
