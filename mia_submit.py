#!/usr/bin/env python3
"""Submit king2-tripo.glb to the Make-It-Animatable HF Space (jasongzy/Make-It-Animatable).

Free experiment for pipeline #3 falsification (review/PIPELINE-RESEARCH.md).
Raw-first: outputs + manifest to assets/raw/makeitanimatable/<ts>/.
"""

import datetime
import hashlib
import json
import os
import shutil
import sys
import time

from gradio_client import Client, handle_file

ROOT = "/Users/samz/Documents/gaslight-remake"
SPACE = "jasongzy/Make-It-Animatable"
INPUT_GLB = os.path.join(ROOT, "assets/plates/king-v2/king2-tripo.glb")
ANIM_FBX = "/tmp/Standard Run.fbx"
BUDGET_S = 15 * 60  # hard stop per task instructions

OUTPUT_NAMES = [
    "joints-coarse.glb",
    "canonicalized-input.glb",
    "sampled-point-clouds.glb",
    "joints.glb",
    "blend-weights.glb",
    "rest-pose-vis.glb",
    "rest-pose-lbs.glb",
    "animatable-model-preview.glb",
    "animatable-model.fbx",
]

PARAMS = {
    "no_fingers": True,
    "rest_pose_type": "No",
    "ignore_pose_parts": [],
    "is_gs": False,
    "opacity_threshold": 0.01,
    "use_normal": True,
    "bw_fix": True,
    "bw_vis_bone": "LeftArm",
    "reset_to_rest": True,
    "animation_file": "Standard Run.fbx (Mixamo, from jasongzy/Make-It-Animatable HF model repo data/)",
    "retarget": True,
    "in_place": True,
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    outdir = os.path.join(ROOT, "assets/raw/makeitanimatable", ts)
    os.makedirs(outdir, exist_ok=True)
    print(f"outdir: {outdir}", flush=True)

    input_sha = sha256(INPUT_GLB)
    anim_sha = sha256(ANIM_FBX)
    print(f"input sha256: {input_sha}", flush=True)

    t0 = time.time()
    client = Client(SPACE)
    print(f"connected in {time.time()-t0:.1f}s", flush=True)

    job = client.submit(
        handle_file(INPUT_GLB),   # input_3d
        PARAMS["no_fingers"],      # input_no_fingers
        PARAMS["rest_pose_type"],  # input_rest_pose
        PARAMS["ignore_pose_parts"],  # input_rest_parts
        PARAMS["is_gs"],           # input_is_gs
        PARAMS["opacity_threshold"],  # input_opacity_threshold
        PARAMS["use_normal"],      # input_normal
        PARAMS["bw_fix"],          # input_bw_fix
        PARAMS["bw_vis_bone"],     # input_bw_vis_bone
        PARAMS["reset_to_rest"],   # input_reset_to_rest
        handle_file(ANIM_FBX),     # input_animation_file
        PARAMS["retarget"],        # input_retarget
        PARAMS["in_place"],        # input_inplace
        api_name="/pipeline",
    )

    t_submit = time.time()
    last_status = None
    while not job.done():
        st = job.status()
        code = str(st.code)
        if code != last_status:
            print(f"[{time.time()-t_submit:7.1f}s] status={code} queue_pos={st.rank}", flush=True)
            last_status = code
        if time.time() - t_submit > BUDGET_S:
            print("BUDGET EXCEEDED (15 min) — cancelling and stopping.", flush=True)
            job.cancel()
            sys.exit(2)
        time.sleep(5)

    elapsed = time.time() - t_submit
    print(f"job finished in {elapsed:.1f}s", flush=True)

    # /pipeline is a generator endpoint: job.result() returns only the FIRST yield.
    # Collect all yields and scan from the end for the one carrying real filepaths.
    try:
        all_outputs = job.outputs()
    except Exception as e:
        print(f"JOB FAILED: {type(e).__name__}: {e}", flush=True)
        sys.exit(1)
    print(f"{len(all_outputs)} yields from generator", flush=True)

    def path_of(v):
        """Extract a local file path from a yield value (str, FileData dict, or update dict)."""
        if isinstance(v, str):
            return v if os.path.isfile(v) else None
        if isinstance(v, dict):
            inner = v.get("path") or v.get("value")
            if isinstance(inner, dict):
                inner = inner.get("path")
            if isinstance(inner, str) and os.path.isfile(inner):
                return inner
        return None

    def file_of(v):
        return path_of(v)

    # merge: for each output slot, keep the last file-bearing value across yields
    result = [None] * len(OUTPUT_NAMES)
    for y in all_outputs:
        vals = y if isinstance(y, (list, tuple)) else [y]
        for i, v in enumerate(vals):
            if i < len(result) and file_of(v) is not None:
                result[i] = v
    if all(r is None for r in result):
        print("NO FILE-BEARING VALUES FOUND; dumping all yields:", flush=True)
        for i, y in enumerate(all_outputs):
            print(f"  yield {i}: {str(y)[:400]}", flush=True)
        st = job.status()
        print(f"final status: code={st.code} rank={st.rank} success={st.success}", flush=True)
        try:
            job.result()
        except Exception as e:
            print(f"underlying exception: {type(e).__name__}: {e}", flush=True)
        sys.exit(1)
    print(f"file-bearing slots: {[i for i, r in enumerate(result) if r is not None]}", flush=True)

    saved = {}
    for i, r in enumerate(result):
        name = OUTPUT_NAMES[i] if i < len(OUTPUT_NAMES) else f"output-{i}"
        path = path_of(r)
        if path and os.path.isfile(path):
            # keep server extension if it differs
            ext = os.path.splitext(path)[1].lower()
            base = os.path.splitext(name)[0]
            dest = os.path.join(outdir, base + ext)
            shutil.copy2(path, dest)
            saved[base + ext] = {"sha256": sha256(dest), "bytes": os.path.getsize(dest), "server_path": str(r)[:300]}
            print(f"  saved {base + ext} ({os.path.getsize(dest)} B)", flush=True)
        else:
            saved[name] = {"raw_value": str(r)[:300]}
            print(f"  output {i} ({name}): not a file: {str(r)[:200]}", flush=True)

    manifest = {
        "experiment": "pipeline-3-falsification: free auto-rig via Make-It-Animatable HF Space",
        "space_id": SPACE,
        "space_sha": "cf2d235e067d478985e2c077f209b341af0fe1a6",
        "space_hardware": "zero-a10g",
        "endpoint": "/pipeline",
        "submitted_utc": ts,
        "elapsed_s": round(elapsed, 1),
        "input": {"path": INPUT_GLB, "sha256": input_sha, "bytes": os.path.getsize(INPUT_GLB)},
        "animation_input": {"path": ANIM_FBX, "sha256": anim_sha, "bytes": os.path.getsize(ANIM_FBX)},
        "params": PARAMS,
        "outputs": saved,
    }
    with open(os.path.join(outdir, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"manifest written: {os.path.join(outdir, 'manifest.json')}", flush=True)


if __name__ == "__main__":
    main()
