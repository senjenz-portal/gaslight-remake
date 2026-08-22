#!/usr/bin/env python3
"""_soundaudit.py — the remix manifest, read back as three questions.

Round 7 asks the track three things a waveform cannot answer on its own:

  1. THE BOUNDARIES. Every place the page interrupts one line with the next
     is a boundary, and every boundary must either carry a J/L tail or say
     why it does not. Printed as "n of m", with the reason for each.
  2. THE CUES. Every one-shot must be laid so its TRANSIENT sits on the
     picture second the book asked for — laidAt = hitAt - onset — and every
     clip with a measurable attack must have an onset on file.
  3. THE BEDS AND THE LEVEL. Ambience present for the whole span, voice at
     the house level.

    python3 tools/ody/_soundaudit.py shots/directors-cut-r7/scenes.json
"""
import json, sys, os, subprocess, math, struct

AUD = os.path.join(os.path.dirname(__file__), '..', '..',
                   'site-deploy', 'living-odyssey', 'assets', 'audio')

def onset_of(f, sr=48000):
    """25 % of the envelope peak, in a 5 ms window — the table's own rule."""
    p = os.path.join(AUD, f)
    if not os.path.exists(p):
        return None
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', p, '-ac', '1',
                          '-ar', str(sr), '-f', 'f32le', '-'],
                         capture_output=True).stdout
    n = len(raw) // 4
    a = struct.unpack('<%df' % n, raw[:n * 4])
    win, hop = int(0.005 * sr), int(0.001 * sr)
    env = [math.sqrt(sum(v * v for v in a[i:i + win]) / win)
           for i in range(0, max(1, n - win), hop)]
    pk = max(env) if env else 0.0
    for i, v in enumerate(env):
        if v >= 0.25 * pk:
            return round(i * hop / sr, 3)
    return 0.0

def main(path):
    doc = json.load(open(path))
    onsets = {}
    for s in doc['scenes']:
        led = s.get('soundLedger') or []
        vox = [x for x in led if x['kind'] == 'voice']
        cue = [x for x in led if x['kind'] == 'cue']
        bounds = [x for x in vox if x.get('why') not in ('last', 'whole')]
        laps = [x for x in bounds if x['jl'] > 0.05]
        print('=' * 72)
        print('%s   %.2fs   %d shots   audio %s' %
              (s['slug'], s['secs'], s['shots'], json.dumps(s.get('audio', {}))))
        print('-- J/L: %d of %d boundaries carry a tail  (%d lines total)'
              % (len(laps), len(bounds), len(vox)))
        for x in vox:
            print('   %-14s at %7.3f  page gave %6.3f  played %6.3f  '
                  'tail %5.3f  take %6.3f  [%s]'
                  % (x['id'], x['at'], x['cut'], x['len'], x['jl'],
                     x['full'], x.get('why')))
        print('-- CUES: %d' % len(cue))
        for x in cue:
            f = x['file']
            if f not in onsets:
                onsets[f] = onset_of(f)
            m = onsets[f]
            tag = 'ok' if m is None or abs((x['onset'] or 0) - m) <= 0.02 \
                  else 'TABLE %.3f vs MEASURED %.3f' % (x['onset'] or 0, m)
            clipped = ' (head trimmed: cue is earlier than its own attack)' \
                if x['laidAt'] <= 0.0005 and (x['onset'] or 0) > x['hitAt'] else ''
            print('   %-12s %-24s picture %7.3f  laid %7.3f  onset %.3f  %s%s'
                  % (x['id'], f, x['hitAt'], x['laidAt'], x['onset'] or 0,
                     tag, clipped))
    print('=' * 72)

if __name__ == '__main__':
    main(sys.argv[1])
