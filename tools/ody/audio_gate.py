#!/usr/bin/env python3
"""audio_gate.py — lap-ody.mjs's served-audio measurement (audit-audio.md law).

Measures every mp3 in site-deploy/living-odyssey/assets/audio/ exactly the way
the audit did: LUFS/true-peak from ffmpeg loudnorm input stats; SFM = median
spectral-flatness of the 100 Hz-8 kHz power spectrum over 93 ms frames
(mono 22.05k); dead-air tail from 50 ms RMS windows; loop-wrap continuity
(100 ms edge-RMS jump + first/last sample step) for the manifest's loop files.
Prints one JSON object keyed by filename. The LAP asserts; this only measures.

Usage: python3 tools/ody/audio_gate.py [audio_dir]
"""
import json
import math
import os
import subprocess
import sys

import numpy as np

SR_SPEC = 22050
SR_FULL = 44100


def loudnorm_stats(path):
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af",
         "loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
        capture_output=True, text=True)
    tail = p.stderr[p.stderr.rfind("{"):p.stderr.rfind("}") + 1]
    d = json.loads(tail)
    return float(d["input_i"]), float(d["input_tp"])


def decode_mono(path, sr):
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", path,
         "-f", "f32le", "-ar", str(sr), "-"], capture_output=True)
    x = np.frombuffer(p.stdout, dtype=np.float32)
    return (x[0::2] + x[1::2]) * 0.5 if len(x) % 2 == 0 else x  # (L+R)/2


def sfm_of(path):
    x = decode_mono(path, SR_SPEC)
    n = 2048
    if len(x) < n:
        return None
    freqs = np.fft.rfftfreq(n, 1 / SR_SPEC)
    band = (freqs >= 100) & (freqs <= 8000)
    win = np.hanning(n)
    fl = []
    for i in range(len(x) // n):
        ps = np.abs(np.fft.rfft(x[i * n:(i + 1) * n] * win)) ** 2
        ps = ps[band]
        if ps.sum() < 1e-12:
            continue
        ps = ps + 1e-20
        fl.append(np.exp(np.mean(np.log(ps))) / np.mean(ps))
    return round(float(np.median(fl)), 3) if fl else None


def tail_and_wrap(path):
    x = decode_mono(path, SR_FULL)
    if not len(x):
        return {}
    w = int(0.05 * SR_FULL)
    m = len(x) // w
    db = 20 * np.log10(np.sqrt(np.mean(x[:m * w].reshape(m, w) ** 2, axis=1)
                               + 1e-20))
    tail = 0
    for v in db[::-1]:
        if v < -60:
            tail += 1
        else:
            break
    e = int(0.1 * SR_FULL)
    edge_a = 20 * math.log10(math.sqrt(float(np.mean(x[:e] ** 2))) + 1e-12)
    edge_b = 20 * math.log10(math.sqrt(float(np.mean(x[-e:] ** 2))) + 1e-12)
    return {"tail_dead_s": round(tail * 0.05, 2),
            "edge_jump_db": round(abs(edge_b - edge_a), 1),
            "wrap_step_fs": round(abs(float(x[-1]) - float(x[0])), 4)}


def main():
    adir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(__file__), "..", "..",
        "site-deploy", "living-odyssey", "assets", "audio")
    man = {}
    mp = os.path.join(adir, "manifest.json")
    if os.path.exists(mp):
        man = json.load(open(mp)).get("assets", {})
    out = {}
    for f in sorted(os.listdir(adir)):
        if not f.endswith(".mp3"):
            continue
        path = os.path.join(adir, f)
        lufs, tp = loudnorm_stats(path)
        rec = {"lufs": lufs, "tp_dbtp": tp, "sfm": sfm_of(path)}
        rec.update(tail_and_wrap(path))
        name = f[:-4]
        if name in man:
            rec["role"] = man[name]["role"]
            rec["loop"] = bool(man[name].get("loop"))
        else:
            rec["role"] = "engine"
            rec["loop"] = False
        out[f] = rec
    print(json.dumps(out))


if __name__ == "__main__":
    main()
