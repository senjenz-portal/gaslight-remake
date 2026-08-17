#!/usr/bin/env python3
"""sam2video: run meta/sam-2-video on Replicate over a local mp4.

Point-prompt the character, get a per-frame binary mask sequence back.
Token: REPLICATE_API_TOKEN env, else parsed from story-orbit/.env (never printed).
NOTE: Replicate's edge 403s urllib's default User-Agent — always send one.
"""
import base64, json, os, sys, time, urllib.request, zipfile, io

API = "https://api.replicate.com/v1"

def _token():
    tok = os.environ.get("REPLICATE_API_TOKEN")
    if not tok:
        for line in open("/Users/samz/Documents/story-orbit/.env"):
            if line.startswith("REPLICATE_API_TOKEN="):
                tok = line.split("=", 1)[1].strip().strip('"').strip("'"); break
    if not tok:
        sys.exit("REPLICATE_API_TOKEN not found")
    return tok

def _req(method, url, body=None, tok=None, timeout=300):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("User-Agent", "gaslight-onplate-spike/1.0")
    if tok:
        req.add_header("Authorization", "Bearer " + tok)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def main():
    video, outdir, clicks, labels = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    tok = _token()
    os.makedirs(outdir, exist_ok=True)
    b64 = base64.b64encode(open(video, "rb").read()).decode()
    inp = {
        "input_video": "data:video/mp4;base64," + b64,
        "click_coordinates": clicks,           # "[x,y],[x,y]"
        "click_labels": labels,                # "1,0,..."
        "click_frames": "0",
        "click_object_ids": "ulysses",
        "mask_type": "binary",
        "output_video": False,
        "output_format": "png",
        "output_frame_interval": 1,
    }
    ver = json.loads(_req("GET", API + "/models/meta/sam-2-video", tok=tok))["latest_version"]["id"]
    pred = json.loads(_req("POST", API + "/predictions", {"version": ver, "input": inp}, tok=tok))
    pid = pred["id"]
    print("[sam2] prediction", pid, flush=True)
    t0 = time.time()
    while pred["status"] not in ("succeeded", "failed", "canceled"):
        time.sleep(5)
        pred = json.loads(_req("GET", API + "/predictions/" + pid, tok=tok))
        print("[sam2]", pred["status"], int(time.time() - t0), "s", flush=True)
    if pred["status"] != "succeeded":
        sys.exit("[sam2] FAILED: " + json.dumps(pred.get("error"))[:400])
    out = pred["output"]
    urls = out if isinstance(out, list) else [out]
    print("[sam2]", len(urls), "outputs; metrics:", json.dumps(pred.get("metrics")), flush=True)
    for i, u in enumerate(urls):
        blob = _req("GET", u)
        name = os.path.basename(u.split("?")[0])
        if name.endswith(".zip"):
            zipfile.ZipFile(io.BytesIO(blob)).extractall(outdir)
            print("[sam2] unzipped", name, "->", outdir, flush=True)
        else:
            open(os.path.join(outdir, "%04d-%s" % (i, name)), "wb").write(blob)
    json.dump({"id": pid, "metrics": pred.get("metrics"), "input_clicks": clicks,
               "labels": labels, "n_outputs": len(urls)},
              open(os.path.join(outdir, "sam2-pred.json"), "w"), indent=1)
    print("[sam2] DONE", flush=True)

if __name__ == "__main__":
    main()
