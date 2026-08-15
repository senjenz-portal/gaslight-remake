#!/usr/bin/env python3
"""Tripo 3.1 image-to-3D pipeline tool (Scenario API, stdlib only).

Sibling of scenario3d.py (reuses its request/poll/verify helpers) targeting
model_tripo-v3-1-image-to-3d (capability img23d).

Flow: upload/reuse image asset -> POST /v1/generate/custom/model_tripo-v3-1-image-to-3d
      -> poll GET /v1/jobs/{id} -> download output assets -> verify GLB -> asset thumbnail.

Auth: SCENARIO_API_TOKEN, or parsed in-python from the story-orbit .env by
scenario3d._token (the .env has a zsh parse error at line 82 so it is never sourced).
Token is never printed.
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scenario3d import (_req, _submit, _poll, _asset_info, _download_asset,
                        _upload_image, _sha256, _frag, verify_glb)

TRIPO_MODEL = "model_tripo-v3-1-image-to-3d"


def _resolve_image_asset(a):
    """Reuse --image-asset if it still exists server-side, else upload --image."""
    if a.image_asset:
        try:
            _asset_info(a.image_asset)
            return a.image_asset, "reused existing Scenario asset"
        except Exception as e:
            print(f"[{a.name}] image-asset {a.image_asset} not usable ({e}); "
                  f"falling back to upload", flush=True)
            if not a.image:
                raise
    return _upload_image(a.image), "uploaded by tools/tripo3d.py"


def _guess_ext(info, blob):
    fname = (info.get("metadata", {}).get("fileName") or info.get("name") or
             info.get("url", "").split("?")[0])
    for ext in (".glb", ".fbx", ".obj", ".usdz", ".gltf", ".zip"):
        if ext in fname.lower():
            return ext
    if blob[:4] == b"glTF":
        return ".glb"
    if blob[:20].startswith(b"Kaydara FBX") or b"FBX" in blob[:64]:
        return ".fbx"
    return ".bin"


def _fetch_thumb(asset_id, dest):
    """Same pattern as tools/fetch_thumbs.py: Scenario-rendered mesh preview thumbnail."""
    info = _asset_info(asset_id)
    thumb = (info.get("thumbnail") or {}).get("url") or (info.get("preview") or {}).get("url")
    if not thumb:
        return None
    blob = _req("GET", "", raw_url=thumb)
    with open(dest, "wb") as f:
        f.write(blob)
    return dest


def cmd_mesh(a):
    image_asset, asset_note = _resolve_image_asset(a)
    body = {
        "image": image_asset,
        "texture": True,
        "textureQuality": a.texture_quality,
        "orientation": "align_image",
        "pbr": a.pbr,
        "smartLowPoly": True,
        "faceLimit": a.face_limit,
        "autoSize": True,
        "seed": a.seed,
        "textureSeed": a.texture_seed,
    }
    if getattr(a, "texture_alignment", None):
        body["textureAlignment"] = a.texture_alignment
    adaptations = []
    try:
        job_id = _submit(TRIPO_MODEL, body)
    except RuntimeError as e:
        msg = str(e)
        if "HTTP 400" in msg and '"image"' in msg and "images" in msg:
            # minimal adaptation: some Scenario models take an images array
            body["images"] = [body.pop("image")]
            adaptations.append({"param": "image", "change": "renamed to images[]",
                                "reason": msg[:300]})
            job_id = _submit(TRIPO_MODEL, body)
        else:
            raise
    print(f"[{a.name}] tripo job {job_id} params="
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
                 "generator": "scenario-tripo-img23d", "modelId": TRIPO_MODEL,
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
    p.add_argument("--face-limit", type=int, required=True)
    p.add_argument("--texture-quality", required=True,
                   choices=["standard", "detailed", "extreme"])
    p.add_argument("--texture-alignment", default=None,
                   choices=["original_image", "geometry"],
                   help="omit to use model default (original_image)")
    p.add_argument("--pbr", action="store_true", default=False)
    p.add_argument("--seed", type=int, required=True)
    p.add_argument("--texture-seed", type=int, required=True)
    p.add_argument("--timeout", type=int, default=2400)
    a = p.parse_args()
    if a.image_with_asset:
        a.image, a.image_asset = a.image_with_asset
    cmd_mesh(a)


if __name__ == "__main__":
    main()
