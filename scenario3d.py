#!/usr/bin/env python3
"""Scenario image-to-3D pipeline tool (stdlib only).

Flow: txt2img concept -> upload/reuse asset -> image-to-3D job -> poll -> download GLB.

Subcommands:
  concept  --name N --prompt "..."            generate concept image, download to raw dir
  mesh     --name N (--image PATH | --image-asset ID)   submit 3D job, poll, download GLB
  pipeline --name N --prompt "..."            concept + mesh end-to-end
  verify   --glb PATH                          parse GLB, print mesh stats (json)
  merge    --outdir DIR                        merge *.frag.json manifests into manifest.json

Auth: SCENARIO_API_TOKEN env var (pre-encoded Basic token). Never printed.
"""
import argparse, base64, glob, hashlib, json, os, struct, sys, time
import urllib.request, urllib.error

API = "https://api.cloud.scenario.com/v1"
TXT2IMG_MODEL = "model_bfl-flux-2-pro"
I23D_MODEL = "model_yvo3d-image-to-3d"

STYLE_TAIL = (", stylized low poly 3d game asset, flat-shaded chunky low poly style, "
              "faceted geometry, single accent colour, Prussian-blue and amber Victorian "
              "night palette, three-quarter view, one single object centered and isolated "
              "on a plain empty dark background, nothing else in frame, no other objects, "
              "studio render, no text, no letters, blank weathered sign boards")


def _token():
    tok = os.environ.get("SCENARIO_API_TOKEN")
    if not tok:
        # fallback: parse env file without sourcing (it has a zsh parse error mid-file)
        envfile = os.environ.get("SCENARIO_ENV_FILE", "/Users/samz/Documents/story-orbit/.env")
        try:
            for line in open(envfile):
                line = line.strip()
                if line.startswith("SCENARIO_API_TOKEN="):
                    tok = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
        except OSError:
            pass
    if not tok:
        sys.exit("SCENARIO_API_TOKEN not found")
    return tok


def _req(method, path, body=None, raw_url=None, retries=4):
    url = raw_url or (API + path)
    data = json.dumps(body).encode() if body is not None else None
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, method=method)
        if not raw_url:
            req.add_header("Authorization", "Basic " + _token())
        if data is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                payload = r.read()
                if raw_url:
                    return payload
                return json.loads(payload)
        except urllib.error.HTTPError as e:
            detail = e.read()[:500].decode(errors="replace")
            last = f"HTTP {e.code} on {method} {path or url.split('?')[0]}: {detail}"
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(5 * (attempt + 1)); continue
            raise RuntimeError(last)
        except (urllib.error.URLError, TimeoutError) as e:
            last = f"net error on {method} {path}: {e}"
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(last or "request failed")


def _sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _submit(model_id, body):
    resp = _req("POST", f"/generate/custom/{model_id}", body)
    job = resp.get("job", resp)
    return job.get("jobId") or job.get("id")


def _poll(job_id, timeout_s=1800, interval=10):
    t0 = time.time()
    while True:
        resp = _req("GET", f"/jobs/{job_id}")
        job = resp.get("job", resp)
        st = job.get("status")
        if st == "success":
            return job.get("metadata", {}).get("assetIds", [])
        if st in ("failure", "failed", "canceled", "error"):
            raise RuntimeError(f"job {job_id} ended with status {st}: "
                               f"{json.dumps(job.get('error') or job.get('metadata', {}).get('error') or '')[:300]}")
        if time.time() - t0 > timeout_s:
            raise RuntimeError(f"job {job_id} timed out after {timeout_s}s (last status {st})")
        time.sleep(interval)


def _asset_info(asset_id):
    return _req("GET", f"/assets/{asset_id}")["asset"]


def _download_asset(asset_id, dest):
    info = _asset_info(asset_id)
    blob = _req("GET", "", raw_url=info["url"])
    with open(dest, "wb") as f:
        f.write(blob)
    return info


def _upload_image(path):
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    resp = _req("POST", "/assets", {"image": b64, "name": os.path.basename(path)})
    return resp["asset"]["id"]


def _frag(outdir, name, kind, entry):
    p = os.path.join(outdir, f"{name}.{kind}.frag.json")
    with open(p, "w") as f:
        json.dump(entry, f, indent=1)


# ---------------- GLB verification ----------------

def verify_glb(path):
    with open(path, "rb") as f:
        head = f.read(12)
        if len(head) < 12 or head[:4] != b"glTF":
            return {"ok": False, "error": "bad magic"}
        version, total = struct.unpack("<II", head[4:12])
        clen, ctype = struct.unpack("<II", f.read(8))
        if ctype != 0x4E4F534A:  # 'JSON'
            return {"ok": False, "error": "first chunk not JSON"}
        gltf = json.loads(f.read(clen))
    meshes = gltf.get("meshes", [])
    accessors = gltf.get("accessors", [])
    tris = 0
    mins, maxs = [1e30] * 3, [-1e30] * 3
    for m in meshes:
        for prim in m.get("primitives", []):
            if "indices" in prim:
                tris += accessors[prim["indices"]]["count"] // 3
            elif "POSITION" in prim.get("attributes", {}):
                tris += accessors[prim["attributes"]["POSITION"]]["count"] // 3
            pos = prim.get("attributes", {}).get("POSITION")
            if pos is not None:
                a = accessors[pos]
                if "min" in a and "max" in a:
                    mins = [min(mins[i], a["min"][i]) for i in range(3)]
                    maxs = [max(maxs[i], a["max"][i]) for i in range(3)]
    bbox = None
    if mins[0] < 1e29:
        bbox = {"min": [round(v, 4) for v in mins], "max": [round(v, 4) for v in maxs],
                "size": [round(maxs[i] - mins[i], 4) for i in range(3)]}
    return {"ok": len(meshes) > 0, "glbVersion": version, "fileBytes": os.path.getsize(path),
            "declaredBytes": total, "meshCount": len(meshes),
            "primitiveCount": sum(len(m.get("primitives", [])) for m in meshes),
            "triangles": tris, "materialCount": len(gltf.get("materials", [])),
            "imageCount": len(gltf.get("images", [])), "bboxLocal": bbox,
            "generator": gltf.get("asset", {}).get("generator")}


# ---------------- commands ----------------

def cmd_concept(a):
    prompt = a.prompt + ("" if a.no_style_tail else STYLE_TAIL)
    body = {"prompt": prompt, "width": a.width, "height": a.height}
    if a.seed is not None:
        body["seed"] = a.seed
    job_id = _submit(a.txt2img_model, body)
    print(f"[{a.name}] concept job {job_id}", flush=True)
    assets = _poll(job_id, timeout_s=600, interval=5)
    if not assets:
        raise RuntimeError("concept job returned no assets")
    dest = os.path.join(a.outdir, f"{a.name}.concept.png")
    _download_asset(assets[0], dest)
    entry = {"filename": os.path.basename(dest), "sha256": _sha256(dest),
             "generator": "scenario-txt2img", "modelId": a.txt2img_model,
             "prompt": prompt, "params": body, "jobId": job_id, "assetId": assets[0],
             "bytes": os.path.getsize(dest)}
    _frag(a.outdir, a.name, "concept", entry)
    print(f"[{a.name}] concept -> {dest} asset={assets[0]}", flush=True)
    return assets[0]


def cmd_mesh(a, image_asset=None):
    if image_asset is None:
        image_asset = a.image_asset or _upload_image(a.image)
    body = {"images": [image_asset], "texture": True, "creativity": a.creativity,
            "roughness": a.roughness, "textureAdherence": "ON",
            "realismLevel": a.realism, "modelGenerator": a.generator,
            "textureResolution": a.texture_res}
    job_id = _submit(I23D_MODEL, body)
    print(f"[{a.name}] mesh job {job_id}", flush=True)
    assets = _poll(job_id, timeout_s=a.timeout, interval=15)
    if not assets:
        raise RuntimeError("mesh job returned no assets")
    results = []
    for i, aid in enumerate(assets):
        suffix = "" if i == 0 else f".{i}"
        dest = os.path.join(a.outdir, f"{a.name}{suffix}.glb")
        info = _download_asset(aid, dest)
        chk = verify_glb(dest)
        entry = {"filename": os.path.basename(dest), "sha256": _sha256(dest),
                 "generator": "scenario-img23d", "modelId": I23D_MODEL,
                 "prompt": None, "params": body, "jobId": job_id, "assetId": aid,
                 "bytes": os.path.getsize(dest), "verify": chk,
                 "scenarioMeta": {k: info.get("metadata", {}).get(k) for k in
                                  ("faceCount", "vertexCount", "dimensions", "hasUVs", "materialCount")}}
        _frag(a.outdir, a.name, f"mesh{suffix or '.0'}", entry)
        results.append((dest, chk))
        print(f"[{a.name}] glb -> {dest} verify={json.dumps(chk)}", flush=True)
    return results


def cmd_pipeline(a):
    asset_id = cmd_concept(a)
    cmd_mesh(a, image_asset=asset_id)


def cmd_merge(a):
    frags = sorted(glob.glob(os.path.join(a.outdir, "*.frag.json")))
    entries = [json.load(open(p)) for p in frags]
    out = os.path.join(a.outdir, "manifest.json")
    with open(out, "w") as f:
        json.dump({"lane": "scenario3d", "created": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                   "files": entries}, f, indent=1)
    print(f"manifest -> {out} ({len(entries)} entries)")


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)

    def common(sp):
        sp.add_argument("--name", required=True)
        sp.add_argument("--outdir", required=True)

    sp = sub.add_parser("concept"); common(sp)
    sp.add_argument("--prompt", required=True)
    sp.add_argument("--width", type=int, default=1024)
    sp.add_argument("--height", type=int, default=1024)
    sp.add_argument("--seed", type=int, default=None)
    sp.add_argument("--txt2img-model", default=TXT2IMG_MODEL)
    sp.add_argument("--no-style-tail", action="store_true")

    def mesh_args(sp):
        sp.add_argument("--creativity", type=float, default=1)
        sp.add_argument("--roughness", type=float, default=1.8)
        sp.add_argument("--realism", type=float, default=0.85)
        sp.add_argument("--generator", default="FAST_TRUE")
        sp.add_argument("--texture-res", default="1K")
        sp.add_argument("--timeout", type=int, default=1800)

    sp = sub.add_parser("mesh"); common(sp); mesh_args(sp)
    g = sp.add_mutually_exclusive_group(required=True)
    g.add_argument("--image"); g.add_argument("--image-asset")

    sp = sub.add_parser("pipeline"); common(sp); mesh_args(sp)
    sp.add_argument("--prompt", required=True)
    sp.add_argument("--width", type=int, default=1024)
    sp.add_argument("--height", type=int, default=1024)
    sp.add_argument("--seed", type=int, default=None)
    sp.add_argument("--txt2img-model", default=TXT2IMG_MODEL)
    sp.add_argument("--no-style-tail", action="store_true")

    sp = sub.add_parser("verify")
    sp.add_argument("--glb", required=True)

    sp = sub.add_parser("merge")
    sp.add_argument("--outdir", required=True)

    a = p.parse_args()
    if a.cmd == "concept":
        cmd_concept(a)
    elif a.cmd == "mesh":
        cmd_mesh(a)
    elif a.cmd == "pipeline":
        cmd_pipeline(a)
    elif a.cmd == "verify":
        print(json.dumps(verify_glb(a.glb), indent=1))
    elif a.cmd == "merge":
        cmd_merge(a)


if __name__ == "__main__":
    main()
