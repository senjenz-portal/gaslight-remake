#!/usr/bin/env python3
"""Hunyuan 3D 2.1 image-to-3D pipeline tool (Scenario API, stdlib only).

Sibling of tripo3d.py (reuses scenario3d.py request/poll/verify helpers)
targeting model_hunyuan-3d-v2-1 (capability img23d).

Inputs per GET /v1/models/model_hunyuan-3d-v2-1 (probed 2026-08-11):
  image (file, required, "Front view ... should remove background"),
  paint (bool, default true), steps (10-100, default 30, costImpact),
  guidanceScale (1-10, default 5), targetFaceNum (100-1000000, default 40000,
  costImpact), seed (0-2147483647).

Flow: reuse/upload image asset -> POST /v1/generate/custom/model_hunyuan-3d-v2-1
      -> poll GET /v1/jobs/{id} -> download output assets -> verify GLB -> thumb.

Auth: SCENARIO_API_TOKEN or parsed in-python from the story-orbit .env by
scenario3d._token. Token is never printed.
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scenario3d import (_req, _submit, _poll, _asset_info, _upload_image,
                        _sha256, _frag, verify_glb)
from tripo3d import _guess_ext, _fetch_thumb

HUNYUAN_MODEL = "model_hunyuan-3d-v2-1"


def _resolve_image_asset(a):
    if a.image_asset:
        try:
            _asset_info(a.image_asset)
            return a.image_asset, "reused existing Scenario asset"
        except Exception as e:
            print(f"[{a.name}] image-asset {a.image_asset} not usable ({e}); "
                  f"falling back to upload", flush=True)
            if not a.image:
                raise
    return _upload_image(a.image), "uploaded by tools/hunyuan3d.py"


def cmd_mesh(a):
    image_asset, asset_note = _resolve_image_asset(a)
    body = {
        "image": image_asset,
        "paint": not a.no_paint,
        "steps": a.steps,
        "guidanceScale": a.guidance,
        "targetFaceNum": a.target_faces,
        "seed": a.seed,
    }
    adaptations = []
    try:
        job_id = _submit(HUNYUAN_MODEL, body)
    except RuntimeError as e:
        msg = str(e)
        if "HTTP 400" in msg and '"image"' in msg and "images" in msg:
            body["images"] = [body.pop("image")]
            adaptations.append({"param": "image", "change": "renamed to images[]",
                                "reason": msg[:300]})
            job_id = _submit(HUNYUAN_MODEL, body)
        else:
            raise
    print(f"[{a.name}] hunyuan job {job_id} params="
          f"{json.dumps({k: v for k, v in body.items() if k not in ('image', 'images')})}",
          flush=True)
    assets = _poll(job_id, timeout_s=a.timeout, interval=15)
    if not assets:
        raise RuntimeError(f"job {job_id} returned no assets")
    results = []
    for i, aid in enumerate(assets):
        info = _asset_info(aid)
        blob = _req("GET", "", raw_url=info["url"])
        ext = _guess_ext(info, blob)
        suffix = "" if i == 0 else f".{i}"
        dest = os.path.join(a.outdir, f"{a.name}{suffix}{ext}")
        with open(dest, "wb") as f:
            f.write(blob)
        chk = verify_glb(dest) if ext == ".glb" else {"ok": False,
                                                      "error": f"non-glb output ({ext})"}
        thumb = None
        try:
            thumb = _fetch_thumb(aid, os.path.join(a.outdir, f"{a.name}{suffix}.meshthumb.jpg"))
        except Exception as e:
            print(f"[{a.name}] thumbnail fetch failed: {e}", flush=True)
        entry = {"filename": os.path.basename(dest), "sha256": _sha256(dest),
                 "generator": "scenario-hunyuan-img23d", "modelId": HUNYUAN_MODEL,
                 "prompt": None,
                 "params": {k: v for k, v in body.items() if k not in ("image", "images")},
                 "imageAssetId": image_asset, "imageAssetNote": asset_note,
                 "inputSha256": _sha256(a.image) if a.image else None,
                 "adaptations": adaptations,
                 "jobId": job_id, "assetId": aid, "bytes": os.path.getsize(dest),
                 "verify": chk,
                 "thumbnail": os.path.basename(thumb) if thumb else None,
                 "scenarioMeta": {k: info.get("metadata", {}).get(k) for k in
                                  ("faceCount", "vertexCount", "dimensions",
                                   "hasUVs", "materialCount")}}
        _frag(a.outdir, a.name, f"mesh{suffix or '.0'}", entry)
        results.append((dest, chk))
        print(f"[{a.name}] {ext} -> {dest} verify={json.dumps(chk)}", flush=True)
    return results


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--name", required=True)
    p.add_argument("--outdir", required=True)
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--image")
    p.add_argument("--image-asset")
    g.add_argument("--image-with-asset", nargs=2, metavar=("PATH", "ASSET_ID"),
                   help="local path (for sha) + existing Scenario asset id to reuse")
    p.add_argument("--target-faces", type=int, required=True)
    p.add_argument("--steps", type=int, default=30)
    p.add_argument("--guidance", type=float, default=5)
    p.add_argument("--no-paint", action="store_true", default=False)
    p.add_argument("--seed", type=int, required=True)
    p.add_argument("--timeout", type=int, default=2400)
    a = p.parse_args()
    if a.image_with_asset:
        a.image, a.image_asset = a.image_with_asset
    cmd_mesh(a)


if __name__ == "__main__":
    main()
