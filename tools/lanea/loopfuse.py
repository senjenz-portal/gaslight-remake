#!/usr/bin/env python3
"""Bake a seamless loop into the clip itself.

A two-copy cross-fade in JS cannot work here: to hide the wrap the copies have
to be half a cycle apart, which means the blend mixes two *different* moments of
the fire and the lamp -- a permanent double exposure, not a cross-fade.

The classic offline construction has no such cost. For a clip of D frames and a
blend window of N, the loop length is L = D - N and

    out[i] = clip[i]                                  N <= i < L
    out[i] = lerp(clip[i+L], clip[i], i/N)            0 <= i < N

so out[L-1] = clip[L-1] and out[0] = clip[L] -- the wrap lands on the frame that
genuinely follows it. Continuity is exact by construction, and because the model
was already forced (first frame == last frame) the two ends being blended are
near-identical, so the window shows no ghost either.

Usage: loopfuse.py IN.mp4 OUT.mp4 [--blend 12] [--crf 20]
"""
import argparse, json, os, shutil, subprocess, sys, tempfile
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("dest")
ap.add_argument("--blend", type=int, default=12)
ap.add_argument("--crf", type=int, default=20)
a = ap.parse_args()

probe = json.loads(subprocess.run(
    ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
     "stream=width,height,r_frame_rate,nb_frames", "-of", "json", a.src],
    capture_output=True, text=True, check=True).stdout)["streams"][0]
num, den = (int(x) for x in probe["r_frame_rate"].split("/"))
fps = num / den
tmp = tempfile.mkdtemp(prefix="loopfuse-")
try:
    subprocess.run(["ffmpeg", "-v", "error", "-i", a.src,
                    os.path.join(tmp, "f%04d.png")], check=True)
    names = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))
    D = len(names)
    N = a.blend
    L = D - N
    if L <= N:
        sys.exit("clip too short for a %d-frame blend" % N)
    frames = [np.asarray(Image.open(os.path.join(tmp, n)).convert("RGB"), dtype=np.float32)
              for n in names]
    out = tempfile.mkdtemp(prefix="loopfuse-out-")
    ghost = 0.0
    for i in range(L):
        if i < N:
            w = i / N
            g = np.abs(frames[i + L] - frames[i]).mean()
            ghost = max(ghost, g)
            f = frames[i + L] * (1 - w) + frames[i] * w
        else:
            f = frames[i]
        Image.fromarray(np.clip(f, 0, 255).astype(np.uint8)).save(
            os.path.join(out, "g%04d.png" % i))
    seam = np.abs(np.asarray(Image.open(os.path.join(out, "g0000.png")), dtype=np.float32) -
                  np.asarray(Image.open(os.path.join(out, "g%04d.png" % (L - 1))), dtype=np.float32))
    mid = np.abs(np.asarray(Image.open(os.path.join(out, "g%04d.png" % (L // 2))), dtype=np.float32) -
                 np.asarray(Image.open(os.path.join(out, "g%04d.png" % (L // 2 + 1))), dtype=np.float32))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "%.6f" % fps,
                    "-i", os.path.join(out, "g%04d.png"),
                    "-c:v", "libx264", "-crf", str(a.crf), "-preset", "slow",
                    "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", a.dest], check=True)
    print(json.dumps({
        "src": a.src, "dest": a.dest, "srcFrames": D, "loopFrames": L,
        "blendFrames": N, "fps": round(fps, 3), "loopSeconds": round(L / fps, 3),
        "maxGhostInBlendWindow": round(float(ghost), 3),
        "wrapDeltaMean": round(float(seam.mean()), 3),
        "wrapPctOver6": round(float((seam.max(axis=2) > 6).mean() * 100), 3),
        "midClipAdjacentDeltaMean": round(float(mid.mean()), 3),
        "bytes": os.path.getsize(a.dest)}, indent=1))
    shutil.rmtree(out, ignore_errors=True)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
