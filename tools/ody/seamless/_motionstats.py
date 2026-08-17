#!/usr/bin/env python3
"""Motion-continuity stats over /tmp/motion/*.ndjson (30 fps recordings).

Per moving track:
  velocity profile  v(t) px/s off the pose mark (and rendered feet)
  glide index       CV of speed over the mid-window (std/mean; a real walk
                    pulses per step, CV ~0 is a glide)
  bob               std of rendered box-bottom (feet) residual vs 0.5 s
                    moving average, px  (and same for box top = head line)
  easing            frames from rest to >=80% of peak speed (onset) and from
                    >=80% of peak back to rest (offset); v on first moving frame
  sub-threshold     px covered + duration at 0 < v < STRIDE_MIN while the
                    STAND cut is shown (walking=false) — the stand-cut glide
  stride slip       observed px of ground per strip-frame advance vs the
                    registry pxPerFrame; visual steps counted vs expected
"""
import json, math, sys, statistics as st
from pathlib import Path

FPS = 30.0
RUNS = ['shore-landfall','shore-hunt','shore-council','shore-crossing',
        'cave-entry','cave-giant-entry','cave-flock-out','cave-flock-in',
        'cave-ram-stream','cave-free-men']

PPF = {  # registry pxPerFrame = stride_px / (n/2), n=10 for all walk strips
  ('shore','u'):    0.75*11.3/5,   # 1.695
  ('shore','crew'): 0.71*11.3/5,   # 1.605
  ('shore','run'):  1.50*11.3/5,   # 3.390
  ('cave','giant'): 2.60*43/5,     # 22.36
  ('cave','crew'):  0.75*43/5,     # 6.45
  ('cave','ram'):   0.60*43/5,     # 5.16
}
STRIDE_MIN = 6.0  # px/s, both sets

def load(run):
    p = Path('/tmp/motion')/f'{run}.ndjson'
    return [json.loads(l) for l in p.read_text().splitlines()]

def track_metrics(name, pos, extra=None, ppf=None, frames=None, walking=None,
                  feet=None, top=None, visible=None):
    """pos: list of (x,y) mark per frame (None where absent)."""
    n = len(pos)
    vis = visible or [p is not None for p in pos]
    v = [0.0]*n
    for i in range(1, n):
        if pos[i] is None or pos[i-1] is None: continue
        v[i] = math.hypot(pos[i][0]-pos[i-1][0], pos[i][1]-pos[i-1][1]) * FPS
    moving = [i for i in range(n) if v[i] > 1.0 and vis[i]]
    if not moving: return None
    a, b = moving[0], moving[-1]
    span = [v[i] for i in range(a, b+1)]
    total = sum(s/FPS for s in span)
    peak = max(span)
    # mid-window CV (drop 15% each end of the moving window)
    m0 = a + max(1,int(0.15*(b-a))); m1 = b - max(1,int(0.15*(b-a)))
    mid = [v[i] for i in range(m0, m1+1)] or span
    cv = (st.pstdev(mid)/st.mean(mid)) if st.mean(mid) > 0 else 0.0
    # largest single-frame speed step mid-path (a path-vertex pop reads as a lurch)
    jump = 0.0; jump_at = None
    for i in range(m0+1, m1+1):
        d = abs(v[i]-v[i-1])
        if d > jump: jump, jump_at = d, i
    jump_pc = jump/st.mean(mid)*100 if st.mean(mid) > 0 else 0.0
    # onset/offset
    onset = next((i-a for i in range(a, b+1) if v[i] >= 0.8*peak), None)
    offset = next((b-i for i in range(b, a-1, -1) if v[i] >= 0.8*peak), None)
    v_first = v[a]
    # sub-threshold stand-glide: v in (0.3, STRIDE_MIN), stand shown
    sub = [i for i in range(n) if vis[i] and 0.3 < v[i] < STRIDE_MIN
           and (walking is None or not walking[i])]
    sub_px = sum(v[i]/FPS for i in sub)
    # bob off rendered feet/top: residual vs 0.5 s moving average.
    # measured over WALKING frames when a walk exists (a pose swap at the
    # walk's end must not masquerade as bob), else over the whole move
    wframes = [i for i in range(a, b+1) if walking and walking[i]]
    bob_idx = wframes if len(wframes) >= 20 else list(range(a, b+1))
    def resid_std(seq):
        idx = [i for i in bob_idx if seq and i < len(seq) and seq[i] is not None]
        if len(idx) < 20: return None
        vals = [seq[i] for i in idx]
        w = 15  # 0.5 s
        res = []
        for j in range(len(vals)):
            lo, hi = max(0, j-w//2), min(len(vals), j+w//2+1)
            res.append(vals[j] - sum(vals[lo:hi])/(hi-lo))
        return st.pstdev(res)
    bob_feet = resid_std(feet)
    bob_top = resid_std(top)
    # stride slip: strip-frame advances vs ground covered while walking
    slip = None; steps = 0; walk_px = 0.0; cadence = None
    if frames is not None and walking is not None:
        last = None
        n_cells = 10
        for i in range(a, b+1):
            if not walking[i]: last = None; continue
            walk_px += v[i]/FPS
            if last is not None:
                steps += (frames[i] - last) % n_cells   # modular cell delta
            last = frames[i]
        if steps and ppf:
            obs = walk_px/steps
            slip = (obs - ppf)/ppf
            wsecs = sum(1 for i in range(a,b+1) if walking[i])/FPS
            cadence = steps/wsecs if wsecs else None
    walk_frac = (sum(1 for i in range(a,b+1) if walking[i])/(b-a+1)) if walking else None
    return dict(name=name, n_moving=b-a+1, dur=(b-a+1)/FPS, total_px=total,
                peak=peak, mean_mid=st.mean(mid), cv_mid=cv,
                jump_pc=jump_pc, jump_at=jump_at,
                onset_f=onset, offset_f=offset, v_first=v_first,
                sub_px=sub_px, sub_s=len(sub)/FPS,
                bob_feet=bob_feet, bob_top=bob_top,
                strip_steps=steps, walk_px=walk_px, slip=slip, cadence=cadence,
                walk_frac=walk_frac, extra=extra)

def fmt(m):
    if m is None: return '  (no motion)'
    o = (f"  move {m['dur']:.2f}s {m['total_px']:.0f}px  peak {m['peak']:.1f}px/s"
         f"  mid-mean {m['mean_mid']:.1f}  CV {m['cv_mid']*100:.1f}%"
         f"  max-jump {m['jump_pc']:.0f}%@f{m['jump_at']}\n"
         f"  onset->80% {m['onset_f']}f (v_first {m['v_first']:.1f}px/s)"
         f"  80%->stop {m['offset_f']}f"
         f"  stand-glide {m['sub_px']:.1f}px/{m['sub_s']:.2f}s\n"
         f"  bob feet {('%.3f'%m['bob_feet']) if m['bob_feet'] is not None else '-'}px"
         f"  top {('%.3f'%m['bob_top']) if m['bob_top'] is not None else '-'}px")
    if m['strip_steps']:
        o += (f"\n  strip: {m['strip_steps']} frame-advances over {m['walk_px']:.0f}px walked"
              f"  -> {m['walk_px']/m['strip_steps']:.2f}px/frame (slip {m['slip']*100:+.1f}%)"
              f"  cadence {m['cadence']:.1f}f/s  walking {m['walk_frac']*100:.0f}% of move")
    elif m['walk_frac'] is not None:
        o += f"\n  strip: NEVER CYCLED while covering {m['total_px']:.0f}px (walking {m['walk_frac']*100:.0f}% of move)"
    return o

def feet_of(node_seq, key='fy'):
    return [ (nd[key] if nd and nd.get('op',0) > 0.05 else None) for nd in node_seq ]

def main():
    for run in RUNS:
        recs = load(run)
        s = recs[0]['set']
        print(f"\n=== {run} ({s}, {len(recs)} frames @30fps) ===")
        out = []
        # ulysses
        pos = [r['u']['mark'] if r['u']['op'] > 0.05 else None for r in recs]
        walking = [bool(r['u'].get('walking')) for r in recs]
        framesq = [r['u'].get('frame',0) for r in recs]
        stand = [r['u'].get('stand') for r in recs]
        strip = [r['u'].get('strip') for r in recs]
        live = [ (st_ if (st_ and st_.get('op',0)>0.05) else (sp if (sp and sp.get('op',0)>0.05) else None))
                 for st_,sp in zip(stand,strip) ]
        m = track_metrics('ulysses', pos, ppf=PPF[(s,'u') if s=='shore' else (s,'crew')],
                          frames=framesq, walking=walking,
                          feet=[nd['fy'] if nd else None for nd in live],
                          top=[nd['ty'] if nd else None for nd in live])
        if m: out.append(m)
        # crew
        for i in range(12):
            pos = [r['crew'][i]['mark'] if r['crew'][i]['op'] > 0.05 else None for r in recs]
            walking = [bool(r['crew'][i].get('walking')) for r in recs]
            framesq = [r['crew'][i].get('frame',0) for r in recs]
            stand = [r['crew'][i].get('stand') for r in recs]
            strip = [r['crew'][i].get('strip') for r in recs]
            runn = [r['crew'][i].get('run') for r in recs]
            live = []
            for st_,sp,rn in zip(stand,strip,runn):
                nd = None
                for cand in (sp, rn, st_):
                    if cand and cand.get('op',0)>0.05: nd = cand; break
                live.append(nd)
            running = any(r['crew'][i].get('running') for r in recs)
            ppf = PPF[(s,'run')] if running else PPF[(s,'crew')]
            m = track_metrics(f'crew{i}'+('(run)' if running else ''), pos, ppf=ppf,
                              frames=framesq, walking=walking,
                              feet=[nd['fy'] if nd else None for nd in live],
                              top=[nd['ty'] if nd else None for nd in live])
            if m and m['total_px'] > 3: out.append(m)
        if s == 'cave':
            # giant
            pos = [r['giant']['mark'] for r in recs]
            walking = [bool(r['giant'].get('walking')) for r in recs]
            framesq = [r['giant'].get('frame',0) for r in recs]
            live = []
            for r in recs:
                nd = None
                for cand in (r['giant'].get('strip'), r['giant'].get('stand'), r['giant'].get('seat')):
                    if cand and cand.get('op',0)>0.05: nd = cand; break
                live.append(nd)
            m = track_metrics('GIANT('+recs[0]['giant']['pose']+')', pos, ppf=PPF[(s,'giant')],
                              frames=framesq, walking=walking,
                              feet=[nd['fy'] if nd else None for nd in live],
                              top=[nd['ty'] if nd else None for nd in live])
            if m and m['total_px'] > 3: out.append(m)
            # rams (stream walkers)
            for i in range(5):
                pos = [r['rams'][i]['at'] for r in recs]
                framesq = [r['rams'][i].get('frame',0) for r in recs]
                walking = [r['rams'][i]['at'] is not None for r in recs]
                live = [r['rams'][i].get('box') for r in recs]
                m = track_metrics(f'ram{i}', pos, ppf=PPF[(s,'ram')],
                                  frames=framesq, walking=walking,
                                  feet=[nd['fy'] if nd and nd.get('op',0)>0.05 else None for nd in live],
                                  top=[nd['ty'] if nd and nd.get('op',0)>0.05 else None for nd in live])
                if m and m['total_px'] > 3: out.append(m)
            # trio pairs (rendered box only — static cuts)
            for i in range(len(recs[0].get('pairs',[]))):
                boxes = [r['pairs'][i] for r in recs]
                pos = [ (nd['fx'], nd['fy']) if nd and nd.get('op',0)>0.05 else None for nd in boxes]
                m = track_metrics(f'trio-pair{i}', pos, walking=[False]*len(recs),
                                  frames=[0]*len(recs),
                                  feet=[nd['fy'] if nd and nd.get('op',0)>0.05 else None for nd in boxes],
                                  top=[nd['ty'] if nd and nd.get('op',0)>0.05 else None for nd in boxes])
                if m and m['total_px'] > 3: out.append(m)
            # great ram (static cut glide)
            pos = [tuple(r['great']['at']) if r['great']['at'] else None for r in recs]
            live = []
            for r in recs:
                nd = None
                for cand in (r['great'].get('slung'), r['great'].get('box')):
                    if cand and cand.get('op',0)>0.05: nd = cand; break
                live.append(nd)
            m = track_metrics('GREAT-RAM', pos, walking=[False]*len(recs), frames=[0]*len(recs),
                              feet=[nd['fy'] if nd else None for nd in live],
                              top=[nd['ty'] if nd else None for nd in live])
            if m and m['total_px'] > 3: out.append(m)
        if s == 'shore' and recs[0].get('crossing') is not None or run=='shore-crossing':
            ks = [r.get('crossing') for r in recs]
        for m in out:
            print(f"[{m['name']}]"); print(fmt(m))
        if not out: print('  (no tracks moved)')

main()
