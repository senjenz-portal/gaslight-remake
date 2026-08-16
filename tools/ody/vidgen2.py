#!/usr/bin/env python3
"""vidgen2: lanea/vidgen.py extended MINIMALLY with a DISTINCT last frame.

BRIDGES: pass --image POSE_A_CANVAS and --last-image POSE_B_CANVAS so the
clip travels from pose A and lands exactly on pose B (vidgen.py only knew
the loop default: lastFrameImage = the seed itself). Without --last-image,
behaviour is identical to vidgen.py.

Usage:
  vidgen2.py --name bridge --image A.png [--last-image B.png] --outdir DIR \
             --prompt "..." [--model model_bytedance-seedance-2-0] \
             [--duration 8] [--res 720p] [--aspect adaptive] \
             [--no-last-frame] [--poll-timeout 300]
Auth: SCENARIO_API_TOKEN, else parsed in-python from story-orbit/.env (never printed).
"""
import argparse, base64, hashlib, json, os, sys, time
import urllib.request, urllib.error

API = "https://api.cloud.scenario.com/v1"

def _token():
    tok = os.environ.get("SCENARIO_API_TOKEN")
    if not tok:
        envfile = os.environ.get("SCENARIO_ENV_FILE", "/Users/samz/Documents/story-orbit/.env")
        try:
            for line in open(envfile):
                line = line.strip()
                if line.startswith("SCENARIO_API_TOKEN="):
                    tok = line.split("=", 1)[1].strip().strip('"').strip("'"); break
        except OSError:
            pass
    if not tok:
        sys.exit("SCENARIO_API_TOKEN not found")
    return tok

def _req(method, path, body=None, raw_url=None, retries=4, timeout=300):
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
            with urllib.request.urlopen(req, timeout=timeout) as r:
                payload = r.read()
                return payload if raw_url else json.loads(payload)
        except urllib.error.HTTPError as e:
            detail = e.read()[:600].decode(errors="replace")
            last = "HTTP %s on %s %s: %s" % (e.code, method, path or url.split('?')[0], detail)
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(5 * (attempt + 1)); continue
            raise RuntimeError(last)
        except (urllib.error.URLError, TimeoutError) as e:
            last = "net error on %s %s: %s" % (method, path, e)
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(last or "request failed")

def _sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()

def upload(path):
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    return _req("POST", "/assets", {"image": b64, "name": os.path.basename(path)})["asset"]["id"]

def poll(job_id, timeout_s=1800, interval=10):
    t0 = time.time(); last_st = None
    while True:
        job = _req("GET", "/jobs/%s" % job_id).get("job", {})
        st = job.get("status")
        if st != last_st:
            print("[poll] %s -> %s (%ds)" % (job_id, st, int(time.time() - t0)), flush=True)
            last_st = st
        if st == "success":
            return job.get("metadata", {}).get("assetIds", []), job
        if st in ("failure", "failed", "canceled", "error"):
            raise RuntimeError("job %s %s: %s" % (job_id, st, json.dumps(job.get("error") or job.get("metadata", {}))[:600]))
        if time.time() - t0 > timeout_s:
            raise RuntimeError("job %s timed out (last %s)" % (job_id, st))
        time.sleep(interval)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--name", required=True)
    p.add_argument("--image", required=True)
    p.add_argument("--outdir", required=True)
    p.add_argument("--prompt", required=True)
    p.add_argument("--model", default="model_bytedance-seedance-2-0")
    p.add_argument("--duration", type=int, default=8)
    p.add_argument("--res", default="720p")
    p.add_argument("--aspect", default="adaptive")
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--no-last-frame", action="store_true")
    p.add_argument("--last-image", default=None,
                   help="distinct last-frame image (bridge); default: loop on --image")
    p.add_argument("--poll-timeout", type=int, default=2400)
    a = p.parse_args()
    os.makedirs(a.outdir, exist_ok=True)

    print("[%s] uploading %s" % (a.name, os.path.basename(a.image)), flush=True)
    aid = upload(a.image)
    print("[%s] source asset %s" % (a.name, aid), flush=True)
    last_aid = aid
    if a.last_image:
        print("[%s] uploading last frame %s" % (a.name, os.path.basename(a.last_image)), flush=True)
        last_aid = upload(a.last_image)
        print("[%s] last-frame asset %s" % (a.name, last_aid), flush=True)

    body = {"prompt": a.prompt, "image": aid, "duration": a.duration}
    grok = "grok" in a.model
    if grok:
        body["resolution"] = a.res if a.res in ("480p", "720p") else "720p"
        body["aspectRatio"] = "auto" if a.aspect == "adaptive" else a.aspect
        body["numOutputs"] = 1
    else:
        body["resolution"] = a.res
        body["aspectRatio"] = a.aspect
        body["generateAudio"] = False
        if not a.no_last_frame:
            body["lastFrameImage"] = last_aid     # loop trick, or bridge target
    if a.seed is not None:
        body["seed"] = a.seed

    resp = _req("POST", "/generate/custom/%s" % a.model, body)
    job = resp.get("job", resp)
    job_id = job.get("jobId") or job.get("id")
    print("[%s] job %s submitted" % (a.name, job_id), flush=True)
    assets, jobinfo = poll(job_id, timeout_s=a.poll_timeout, interval=12)
    if not assets:
        raise RuntimeError("no assets returned")

    files = []
    for i, asset_id in enumerate(assets):
        info = _req("GET", "/assets/%s" % asset_id)["asset"]
        url = info.get("url")
        mime = (info.get("mimeType") or info.get("metadata", {}).get("type") or "")
        ext = "mp4" if ("video" in mime or "mp4" in (url or "")) else "bin"
        if info.get("type") == "video" or "video" in str(info.get("metadata", {})).lower():
            ext = "mp4"
        suffix = "" if i == 0 else ".%d" % i
        dest = os.path.join(a.outdir, "%s%s.%s" % (a.name, suffix, ext))
        blob = _req("GET", "", raw_url=url, timeout=600)
        open(dest, "wb").write(blob)
        entry = {"filename": os.path.basename(dest), "sha256": _sha256(dest),
                 "bytes": os.path.getsize(dest), "generator": "scenario-img2video",
                 "modelId": a.model, "prompt": a.prompt, "params": body,
                 "jobId": job_id, "assetId": asset_id,
                 "sourceImage": os.path.abspath(a.image), "sourceSha256": _sha256(a.image),
                 "sourceAssetId": aid,
                 "sourceLastImage": os.path.abspath(a.last_image) if a.last_image else None,
                 "sourceLastSha256": _sha256(a.last_image) if a.last_image else None,
                 "sourceLastAssetId": last_aid,
                 "assetMeta": {k: info.get(k) for k in ("mimeType", "type", "width", "height")}}
        json.dump(entry, open(os.path.join(a.outdir, "%s%s.frag.json" % (a.name, suffix)), "w"), indent=1)
        files.append(dest)
        print("[%s] -> %s (%d bytes)" % (a.name, dest, os.path.getsize(dest)), flush=True)
    print("[%s] DONE %s" % (a.name, files), flush=True)

if __name__ == "__main__":
    main()
