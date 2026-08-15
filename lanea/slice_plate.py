#!/usr/bin/env python3
"""Lane A layer slicer -- cut the 221B plate into parallax depth layers.

  1. fit the void: the backdrop is an isotropic radial gradient about (700,390);
     a quadratic-in-r model recovers it to ~1.2 RGB RMS.
  2. lift the gas-lamp bloom: measure its additive radial profile in the clean
     void sector, subtract it everywhere -> an "unlit" plate. The halo ships as
     its own screen-blended, pulsing layer, so it can never tear at a layer seam.
  3. silhouette = |unlit - void| threshold, closed + hole-filled.
  4. hand-authored polygons cut the silhouette into depth bands.
  5. each band's occluded neighbourhood is harmonically inpainted, so parallax
     reveals show plausible pixels instead of holes.

stdlib + numpy + PIL. Deterministic, no network.
"""
import hashlib, json, os, sys, time
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = "/Users/samz/Documents/gaslight-remake/assets/plates/backdrop.png"
CENTER = (700.0, 390.0)            # fitted vignette centre
HULL = [(288, 6), (1148, 6), (1148, 752), (288, 752)]
LAMP = [(972, 8), (1146, 8), (1146, 462), (1052, 468), (1046, 505),
        (998, 510), (986, 468), (972, 462)]
ROCK_EDGE = [(280, 494), (352, 500), (400, 520), (470, 542), (540, 561),
             (620, 575), (700, 583), (780, 576), (860, 561), (930, 538),
             (990, 513), (1040, 500), (1160, 494)]
HALO_SECTOR_X, HALO_SECTOR_Y = 1050, 116
HALO_MAX_R = 150


def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


def blur(mask, r):
    return np.asarray(Image.fromarray(np.clip(mask * 255, 0, 255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255.0


def morph(m, op, k, n=1):
    im = Image.fromarray((m * 255).astype(np.uint8))
    f = ImageFilter.MaxFilter(k) if op == "d" else ImageFilter.MinFilter(k)
    for _ in range(n):
        im = im.filter(f)
    return np.asarray(im) > 127


def fill_holes(m):
    """flood the complement inward from the border; anything unreached is a hole"""
    inv = ~m
    reach = np.zeros_like(inv)
    reach[0, :] = inv[0, :]; reach[-1, :] = inv[-1, :]
    reach[:, 0] = inv[:, 0]; reach[:, -1] = inv[:, -1]
    for _ in range(600):
        nxt = morph(reach, "d", 3) & inv
        nxt[0, :] |= inv[0, :]; nxt[-1, :] |= inv[-1, :]
        nxt[:, 0] |= inv[:, 0]; nxt[:, -1] |= inv[:, -1]
        if nxt.sum() == reach.sum():
            break
        reach = nxt
    return m | (inv & ~reach)


def poly_mask(size, pts, feather=0.0):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    a = np.asarray(m, dtype=np.float32) / 255.0
    return blur(a, feather) if feather else a


def below_mask(size, edge, feather=3.0):
    W, H = size
    ys = np.interp(np.arange(W), [p[0] for p in edge], [p[1] for p in edge])
    m = (np.arange(H)[:, None] >= ys[None, :]).astype(np.float32)
    return blur(m, feather) if feather else m


def harmonic_fill(img, hole, iters=(220, 160, 110, 70), levels=4):
    H, W, C = img.shape
    pim, phl = [img], [hole]
    for _ in range(levels - 1):
        s = (max(1, pim[-1].shape[1] // 2), max(1, pim[-1].shape[0] // 2))
        pim.append(np.asarray(Image.fromarray(np.clip(pim[-1], 0, 255).astype(np.uint8))
                              .resize(s, Image.BOX), dtype=np.float32))
        phl.append(np.asarray(Image.fromarray((phl[-1] * 255).astype(np.uint8))
                              .resize(s, Image.BOX), dtype=np.float32) > 127)
    cur = None
    for lvl in range(levels - 1, -1, -1):
        im, hm = pim[lvl].astype(np.float32).copy(), phl[lvl]
        if not hm.any():
            cur = im; continue
        if cur is not None:
            up = np.asarray(Image.fromarray(np.clip(cur, 0, 255).astype(np.uint8))
                            .resize((im.shape[1], im.shape[0]), Image.BILINEAR), dtype=np.float32)
            im[hm] = up[hm]
        else:
            im[hm] = im[~hm].mean(axis=0) if (~hm).any() else 0
        for _ in range(iters[min(lvl, len(iters) - 1)]):
            p = np.pad(im, ((1, 1), (1, 1), (0, 0)), mode="edge")
            avg = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) * 0.25
            im[hm] = avg[hm]
        cur = im
    return cur


def rgba(rgb, alpha):
    o = np.zeros((rgb.shape[0], rgb.shape[1], 4), dtype=np.uint8)
    o[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    o[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(o)


def main():
    outdir = sys.argv[1]
    os.makedirs(outdir, exist_ok=True)
    im = Image.open(SRC).convert("RGB")
    W, H = im.size
    a = np.asarray(im, dtype=np.float64)
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy = CENTER
    r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    meta = {}

    # 1 ---- void model, refined against its own mask
    bgc = ~(np.asarray(poly_mask((W, H), HULL)) > 0.5)
    void = None
    for it in range(4):
        V = np.stack([r[bgc] ** k for k in range(3)], -1)
        void = np.zeros_like(a); coefs = []
        for c in range(3):
            coef, *_ = np.linalg.lstsq(V, a[bgc][:, c], rcond=None)
            coefs.append(coef.tolist())
            void[..., c] = sum(coef[k] * r ** k for k in range(3))
        d = np.sqrt(((a - void) ** 2).sum(axis=2))
        bgc = ~morph(morph(d > 7, "d", 3), "e", 5)
    rms = float(np.sqrt(((a[bgc] - void[bgc]) ** 2).sum(axis=1).mean()))
    meta["void"] = {"center": [cx, cy], "model": "quadratic in r, per channel",
                    "coeffs": coefs, "residualRmsOnVoid": round(rms, 3)}
    print("[1/6] void model fitted, residual RMS %.2f" % rms, flush=True)

    # 2 ---- lift the gas-lamp bloom into its own layer
    sub = (xx > 980) & (xx < 1060) & (yy > 120) & (yy < 230)
    w = np.where(sub, np.clip(a.sum(axis=2) - 400, 0, None), 0)
    lx, ly = float((w * xx).sum() / w.sum()), float((w * yy).sum() / w.sum())
    rho = np.sqrt((xx - lx) ** 2 + (yy - ly) ** 2)
    sector = (xx > HALO_SECTOR_X) | ((yy < HALO_SECTOR_Y) & (xx > 972))
    resid = a - void
    bins = np.arange(0, HALO_MAX_R + 1, 2.0)
    prof = np.zeros((len(bins), 3))
    for i, rr in enumerate(bins):
        sel = sector & (np.abs(rho - rr) < 4)
        prof[i] = resid[sel].mean(axis=0) if sel.sum() > 30 else np.nan
    for c in range(3):                       # fill gaps + clamp tail to 0
        col = prof[:, c]; ok = ~np.isnan(col)
        prof[:, c] = np.interp(bins, bins[ok], col[ok])
    prof = np.clip(prof, 0, None)
    prof[bins > HALO_MAX_R - 12] = 0
    halo = np.zeros_like(a)
    for c in range(3):
        halo[..., c] = np.interp(np.clip(rho, 0, HALO_MAX_R), bins, prof[:, c])
    halo *= blur((rho < HALO_MAX_R).astype(np.float32), 4)[..., None]
    unlit = a - halo
    meta["halo"] = {"center": [round(lx, 1), round(ly, 1)], "maxRadius": HALO_MAX_R,
                    "peakRgb": [round(v, 1) for v in prof[0]],
                    "note": "additive bloom, subtracted from the plate and re-added as a screen layer"}
    print("[2/6] lamp bloom lifted, centre (%.0f,%.0f) peak %s" %
          (lx, ly, np.round(prof[0], 1)), flush=True)

    # 3 ---- silhouette from the unlit plate
    d = np.sqrt(((unlit - void) ** 2).sum(axis=2))
    sil = morph(morph(d > 7.5, "d", 5), "e", 7)
    sil = morph(sil, "d", 3)
    sil = fill_holes(sil)
    silf = blur(sil.astype(np.float32), 1.0)
    print("[3/6] silhouette %.1f%% of frame" % (sil.mean() * 100), flush=True)

    # 4 ---- depth bands
    lamp_a = poly_mask((W, H), LAMP, feather=1.2) * silf
    rock_a = below_mask((W, H), ROCK_EDGE, feather=2.5) * silf * (1 - lamp_a)
    room_a = silf * (1 - lamp_a) * (1 - rock_a)
    cov = {k: round(float((m > .5).mean() * 100), 2)
           for k, m in (("lamp", lamp_a), ("rock", rock_a), ("room", room_a))}
    meta["coveragePct"] = cov
    print("[4/6] bands", cov, flush=True)

    # 5 ---- inpaint each band's occluded neighbourhood (26px of headroom)
    print("[5/6] inpainting neighbourhoods ...", flush=True)
    def grow(m, n=13):
        return morph(m > .5, "d", 3, n) & sil
    layers = {}
    for name, m in (("room", room_a), ("rock", rock_a)):
        ext = grow(m)
        rgbf = harmonic_fill(unlit.astype(np.float32), ext & ~(m > .3))
        rgbv = np.where((m > .3)[..., None], unlit, rgbf)
        alpha = np.maximum(m, blur(ext.astype(np.float32), 5) * (ext | (m > .3)))
        layers[name] = (rgbv, np.clip(alpha, 0, 1))
    layers["lamp"] = (unlit, lamp_a)

    # 6 ---- write
    files = {}
    def put(name, img):
        p = os.path.join(outdir, name)
        img.save(p, optimize=True)
        files[name] = {"bytes": os.path.getsize(p), "sha256": sha(p)}
        print("    %-22s %6d KB" % (name, os.path.getsize(p) // 1024), flush=True)

    put("layer0-void.png", Image.fromarray(np.clip(void, 0, 255).astype(np.uint8)))
    put("layer1-room.png", rgba(*layers["room"]))
    put("layer2-rock.png", rgba(*layers["rock"]))
    put("layer3-lamp.png", rgba(*layers["lamp"]))
    # halo: tight crop, screen-blended in the page
    pad = HALO_MAX_R + 4
    x0, y0 = int(lx - pad), int(ly - pad)
    hc = np.clip(halo[y0:y0 + 2 * pad, x0:x0 + 2 * pad], 0, 255).astype(np.uint8)
    put("layer4-halo.png", Image.fromarray(hc))
    meta["halo"]["cropOrigin"] = [x0, y0]
    meta["halo"]["cropSize"] = [2 * pad, 2 * pad]

    dbg = np.clip(unlit * 0.32, 0, 255)
    dbg[..., 0] += room_a * 150; dbg[..., 1] += rock_a * 150; dbg[..., 2] += lamp_a * 200
    put("debug-bands.png", Image.fromarray(np.clip(dbg, 0, 255).astype(np.uint8)))

    man = {"lane": "lanea-layers", "created": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
           "source": {"path": SRC, "sha256": sha(SRC), "size": [W, H]},
           "generator": "tools/lanea/slice_plate.py",
           "geometry": {"hull": HULL, "lampPoly": LAMP, "rockEdge": ROCK_EDGE},
           "analysis": meta, "files": files}
    json.dump(man, open(os.path.join(outdir, "manifest.json"), "w"), indent=1)
    print("[6/6] -> %s" % outdir, flush=True)


if __name__ == "__main__":
    main()
