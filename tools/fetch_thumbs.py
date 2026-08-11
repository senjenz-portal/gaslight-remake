#!/usr/bin/env python3
"""Download Scenario-rendered thumbnails for mesh assets listed in *.mesh*.frag.json."""
import glob, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from scenario3d import _asset_info, _req

outdir = sys.argv[1]
for p in sorted(glob.glob(os.path.join(outdir, "*.mesh*.frag.json"))):
    e = json.load(open(p))
    name = e["filename"].replace(".glb", "")
    dest = os.path.join(outdir, f"{name}.meshthumb.jpg")
    if os.path.exists(dest):
        continue
    info = _asset_info(e["assetId"])
    thumb = (info.get("thumbnail") or {}).get("url") or (info.get("preview") or {}).get("url")
    if not thumb:
        print(f"{name}: no thumbnail"); continue
    blob = _req("GET", "", raw_url=thumb)
    open(dest, "wb").write(blob)
    print(f"{name}: {dest} ({len(blob)} bytes)")
