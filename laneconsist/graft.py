#!/usr/bin/env python3
"""graft.py -- put a regenerated HEAD back into an accepted BODY without moving it.

THE RULE THIS ENFORCES. A shipped actor carries four things that took a lane
each to earn: a keyed silhouette, a palette pulled to its own plate, a measured
baseline, and (for a pair like holmes-church / holmes-church-altar) pixel
alignment with its twin. A regenerated head must not cost any of them. So:

  ALPHA IS NEVER TAKEN FROM THE GENERATION. The master's own alpha is the
  silhouette, always. The graft can only ever change colour INSIDE the figure,
  which is why the baseline, the bbox, the strip cell and the twin alignment
  survive by construction.

  THE GENERATION IS ALIGNED, NOT TRUSTED. Edit models drift a pixel or three.
  The bottom band of the crop is body the prompt asked to leave alone, so it is
  a registration target: the integer shift that minimises SSD there is applied
  to the whole panel before anything is pasted.

  THE GENERATION IS COLOUR-MATCHED TO THE MASTER, on that same untouched band,
  per channel. A model that returns the head one stop brighter would otherwise
  weld a bright head onto a dim body.

  THE SEAM IS A RAMP, NOT AN EDGE. Weight is 1 over the head and falls to 0
  across the bottom of the crop (and at the left/right margins), so the graft
  dissolves into pixels that were never regenerated.

Reports `bg_leak_pct`: pixels inside the silhouette where the generation put
its own background. Those become flat navy against the plate, so a high number
means the model shrank the hair or hat and the graft must be rejected.

    python3 graft.py MASTER.png GEN.png CROP.json OUT.png [--panel left|full]
"""
import argparse, json
import numpy as np
from PIL import Image


def panel_from(gen, sheet_json, panel):
    g = Image.open(gen).convert('RGB')
    if panel == 'full':
        return g
    W, H = sheet_json['sheet']
    g = g.resize((W, H), Image.LANCZOS)
    x0, y0, x1, y1 = sheet_json['left_px']
    return g.crop((x0, y0, x1, y1))


def best_shift(a, b, rad=8):
    """integer (dx,dy) minimising SSD of b shifted onto a"""
    best, bd = (0, 0), None
    for dy in range(-rad, rad + 1):
        for dx in range(-rad, rad + 1):
            bb = np.roll(np.roll(b, dy, 0), dx, 1)
            m = rad + 2
            d = ((a[m:-m or None, m:-m or None] - bb[m:-m or None, m:-m or None]) ** 2).mean()
            if bd is None or d < bd:
                bd, best = d, (dx, dy)
    return best, float(bd)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('master'); ap.add_argument('gen'); ap.add_argument('cropjson')
    ap.add_argument('out')
    ap.add_argument('--panel', default='left')
    ap.add_argument('--feather', type=float, default=0.22)
    ap.add_argument('--side', type=float, default=0.06)
    ap.add_argument('--bg', default='24,28,46')
    ap.add_argument('--json', default='')
    ap.add_argument('--no-shift', action='store_true')
    ap.add_argument('--reg', default='band', choices=['band', 'full'])
    # THE REJECT BAND. It must sit BELOW the darkest colour the canonical
    # actually contains, or the gate eats the thing it was built to protect:
    # Irene's canonical hair is #1B1928 and the crop backing is #181C2E, 7 RGB
    # apart, so a 20..42 band rejected 60% of her new black hair and handed the
    # auburn back. 10..26 clears the hair and still catches a flat dropout.
    ap.add_argument('--exposure-lock', action='store_true')
    ap.add_argument('--rejlo', type=float, default=10.0)
    ap.add_argument('--rejhi', type=float, default=26.0)
    a = ap.parse_args()

    cj = json.load(open(a.cropjson))
    box = cj['box'] if 'box' in cj else cj['left_px']
    sheet = cj if 'sheet' in cj else None
    if sheet and 'box' not in cj:
        # a twinsheet json written by twinsheet.py: the box lives in the crop
        # json its `target` came from, so the graft lands where the cut was made
        box = json.load(open(cj['target'].replace('-head.png', '.json')))['box']
    x0, y0, x1, y1 = box
    cw, ch = x1 - x0, y1 - y0

    m = Image.open(a.master).convert('RGBA')
    mc = np.asarray(m.crop((x0, y0, x1, y1))).astype(np.float32)
    al = mc[..., 3:4] / 255.0
    bgc = np.array([float(v) for v in a.bg.split(',')], np.float32)
    m_flat = mc[..., :3] * al + bgc * (1 - al)

    g = panel_from(a.gen, sheet, 'left' if sheet else 'full').resize((cw, ch), Image.LANCZOS)
    gc = np.asarray(g).astype(np.float32)

    # ---- register on the bottom band (body the prompt was told not to touch).
    # A FULL-FIGURE graft has no such band -- the bottom of a walk strip is
    # empty backdrop with two boots in it, whose variance is too low to fit a
    # gain against (it came back NaN, and NaN silently disabled the match). So
    # a full-figure graft registers and matches on the whole figure instead.
    b0 = 0 if a.reg == 'full' else int(ch * (1 - a.feather * 1.4))
    lum = lambda z: z @ np.array([0.299, 0.587, 0.114], np.float32)
    if a.no_shift:
        (dx, dy), ssd = (0, 0), -1.0
    else:
        (dx, dy), ssd = best_shift(lum(m_flat[b0:]), lum(gc[b0:]), 12)
        gc = np.roll(np.roll(gc, dy, 0), dx, 1)

    # ---- colour match on that same band
    band_m, band_g = m_flat[b0:].reshape(-1, 3), gc[b0:].reshape(-1, 3)
    gain = np.ones(3, np.float32); off = np.zeros(3, np.float32)
    for c in range(3):
        x, y = band_g[:, c], band_m[:, c]
        vx = x.var()
        if vx > 1e-3:
            k = float(np.clip(((x - x.mean()) * (y - y.mean())).mean() / vx, 0.75, 1.35))
        else:
            k = 1.0
        gain[c] = k; off[c] = float(y.mean() - k * x.mean())
    gcm = np.clip(gc * gain + off, 0, 255)

    # ---- EXPOSURE LOCK on the head itself.
    # The band fit matches the SHOULDERS, which is what keeps the seam invisible
    # -- but a model that returns the whole panel a stop down then leaves a face
    # in shadow welded to a correctly-lit body, and the seam gate cannot see it
    # because the seam is fine. So, optionally, a second scalar gain is fitted on
    # the LIT SKIN itself: p85 luminance of the head region, after, equals p85
    # before. Colour and facet structure are the model's; the key light is the
    # master's.
    exp_k = 1.0
    if a.exposure_lock:
        hm = (mc[..., 3] > 200)
        hm[int(ch * 0.62):] = False
        if hm.sum() > 200:
            lm, lg = lum(mc[..., :3])[hm], lum(gcm)[hm]
            p_m, p_g = float(np.percentile(lm, 85)), float(np.percentile(lg, 85))
            if p_g > 1.0:
                exp_k = float(np.clip(p_m / p_g, 0.7, 1.6))
                gcm = np.clip(gcm * exp_k, 0, 255)

    # ---- how much of the figure did the generation leave as its own backdrop?
    d_bg = np.sqrt(((gcm - bgc) ** 2).sum(2))
    inside = mc[..., 3] > 200
    leak = float(((d_bg < a.rejlo + 4) & inside).sum()) / max(1, int(inside.sum())) * 100.0

    # ---- the ramp
    w = np.ones((ch, cw), np.float32)
    # WHERE THE GENERATION PUT ITS OWN BACKDROP, KEEP THE MASTER. A model that
    # drops the cap, or paints the hair narrower than the master's silhouette,
    # would otherwise punch a flat navy hole through the figure -- and the hole
    # only shows up later, on the plate, as a shadow-coloured bite out of the
    # actor. Rejecting those pixels makes the graft strictly non-destructive:
    # the worst case is the master's own pixel, never a hole.
    rej = np.clip((d_bg - a.rejlo) / max(1.0, a.rejhi - a.rejlo), 0.0, 1.0)
    k = 3
    pad = np.pad(rej, k, mode='edge')
    acc = np.zeros_like(rej)
    for dyy in range(2 * k + 1):
        for dxx in range(2 * k + 1):
            acc += pad[dyy:dyy + ch, dxx:dxx + cw]
    w *= np.minimum(rej, acc / ((2 * k + 1) ** 2) * 1.6).clip(0, 1)
    fh = max(2, int(ch * a.feather))
    w[ch - fh:] *= np.linspace(1, 0, fh)[:, None]
    sw = max(2, int(cw * a.side))
    w[:, :sw] *= np.linspace(0, 1, sw)[None, :]
    w[:, cw - sw:] *= np.linspace(1, 0, sw)[None, :]
    w = w[..., None]

    outc = mc.copy()
    outc[..., :3] = mc[..., :3] * (1 - w) + gcm * w
    res = np.asarray(m).astype(np.float32).copy()
    res[y0:y1, x0:x1] = outc
    Image.fromarray(res.astype(np.uint8), 'RGBA').save(a.out)
    rec = {'master': a.master, 'gen': a.gen, 'out': a.out, 'box': [x0, y0, x1, y1],
           'shift': [dx, dy], 'band_ssd': round(ssd, 2),
           'gain': [round(float(v), 3) for v in gain],
           'offset': [round(float(v), 1) for v in off],
           'bg_leak_pct': round(leak, 2), 'exposure_k': round(exp_k, 3)}
    if a.json: json.dump(rec, open(a.json, 'w'), indent=1)
    print(json.dumps(rec))

main()
