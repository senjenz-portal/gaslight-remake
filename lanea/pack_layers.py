#!/usr/bin/env python3
"""Crop each parallax layer to its alpha bbox, zero the RGB under alpha=0
(so PNG deflate has nothing to chew on), and emit a placement manifest."""
import hashlib, json, os, sys
import numpy as np
from PIL import Image

def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()

raw, dest = sys.argv[1], sys.argv[2]
os.makedirs(dest, exist_ok=True)
src = json.load(open(os.path.join(raw, "manifest.json")))
W, H = src["source"]["size"]
out = {"plate": [W, H], "layers": [], "halo": src["analysis"]["halo"],
       "sourceManifest": os.path.join(raw, "manifest.json")}

for name, key in (("layer1-room.png", "room"), ("layer2-rock.png", "rock"), ("layer3-lamp.png", "lamp")):
    im = Image.open(os.path.join(raw, name)).convert("RGBA")
    a = np.asarray(im).copy()
    alpha = a[..., 3]
    ys, xs = np.where(alpha > 0)
    pad = 2
    x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + 1 + pad)
    y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + 1 + pad)
    a[alpha == 0] = 0
    crop = Image.fromarray(a[y0:y1, x0:x1])
    fn = "%s.png" % key
    crop.save(os.path.join(dest, fn), optimize=True)
    out["layers"].append({"id": key, "file": fn, "x": int(x0), "y": int(y0),
                          "w": int(x1 - x0), "h": int(y1 - y0),
                          "bytes": os.path.getsize(os.path.join(dest, fn)),
                          "sha256": sha(os.path.join(dest, fn))})
    print("%-5s %4d,%4d %4dx%-4d %6d KB" % (key, x0, y0, x1 - x0, y1 - y0,
                                            os.path.getsize(os.path.join(dest, fn)) // 1024))

for name, fn in (("layer0-void.png", "void.png"), ("layer4-halo.png", "halo.png")):
    im = Image.open(os.path.join(raw, name))
    im.save(os.path.join(dest, fn), optimize=True)
    print("%-5s %6d KB" % (fn, os.path.getsize(os.path.join(dest, fn)) // 1024))
    out.setdefault("static", {})[fn] = {"bytes": os.path.getsize(os.path.join(dest, fn)),
                                        "sha256": sha(os.path.join(dest, fn))}
json.dump(out, open(os.path.join(dest, "layers.json"), "w"), indent=1)
print("->", dest)
