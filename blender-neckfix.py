#!/usr/bin/env python3
"""blender-neckfix.py — THROAT CLEANUP stage for the transplanted King.

After tools/blender-headgraft.py bolts the good face onto the animated rig,
the throat still reads badly (review/graft/graft-after-face3q-mid.png):

  * the coat's ORANGE/DARK-RED LINING is modelled as a second shell that runs
    down the inside of the standing collar at radius 0.065-0.10 m from the
    neck axis, while the graft's neck skin sits at 0.055 (front) - 0.086
    (back).  At the back and sides the two surfaces interpenetrate, so the
    lining emerges through the neck as thin dark-red slivers.
  * the front of the throat is a hole: the graft carries no geometry in the
    +Y sector between the chin and the shirt V, so the "patchy throat".

Two surgical operations, both driven by the same evidence the weight
normalizer used (base-colour texture sampled at the face's UV centroid, plus
face-normal direction), never by hand-picked indices:

  1. CUT — inside a neck cylinder (axis = mixamorig:Neck head ->
     mixamorig:Head head, radius <= --r-cap = the neck + 2 cm, clavicle to
     jaw) delete body triangles that are
         warm lining      r > b*1.5 & g < r*0.62 & r > 0.12   (the orange)
                       or r > b*1.3 & r > g*1.3 & lum < 0.25  (the dark red)
         or thin shards   longest^2 / 2*area normalised > --sliver-aspect
     AND that are BURIED IN OR EMERGING FROM the neck skin: centroid radius
     <= the graft neck-skin envelope R_ns(sector, height) + --bury-margin.
     Anything the neck skin does not cover is left alone, so the outer coat
     collar and the cream shirt V survive by construction.  Verified: white
     (shirt) faces are excluded outright.

  2. COVER — a faceted solid cravat band, a closed ring of 12 segments x 5
     height rings (240 tris), wrapped from the clavicle to just under the
     jaw at R_ns(sector) * profile + margin so it hugs the neck, capped at
     --r-cap so it can never punch through the coat collar.  It reuses the
     BODY'S OWN material and texture, with every UV pinned inside a uniform
     navy block found in that texture (the body's existing cravat navy), so
     the export gains no new material and no new image.  Flat-shaded,
     weighted 60% mixamorig:Neck / 40% mixamorig:Head so it follows both.

Prints a JSON report between REPORT-BEGIN/REPORT-END and writes it to
--report.  Runs headless or inside a live Blender (blender-mcp) — it works in
its own scene and never touches another lane's.

usage (headless):
  blender --background --python tools/blender-neckfix.py -- \
      --glb-in  assets/plates/king-v2/king2-rigged-goodface.glb \
      --glb-out assets/plates/king-v2/king2-rigged-goodface-v2.glb \
      --report  review/graft/neckfix-blender-report.json
"""
import json
import os
import sys

import bmesh
import bpy
import numpy as np

ROOT = "/Users/samz/Documents/gaslight-remake"
SCENE = "LaneA_NeckFix"
NECK_BONE = "mixamorig:Neck"
HEAD_BONE = "mixamorig:Head"

DEF = dict(
    glb_in=os.path.join(ROOT, "assets/plates/king-v2/king2-rigged-goodface.glb"),
    glb_out=os.path.join(ROOT, "assets/plates/king-v2/king2-rigged-goodface-v2.glb"),
    report=os.path.join(ROOT, "review/graft/neckfix-blender-report.json"),
    r_cap=0.112,           # the neck (measured max 0.092) + 2 cm: outside this nothing is touched
    cravat_cap=0.100,      # the band never grows past this, so it cannot punch the collar
    t_lo=-0.040,           # clavicle, in metres along the neck axis
    t_hi=0.115,            # jaw
    bury_margin=0.008,     # how far outside the neck skin still counts as poking through
    sliver_aspect=6.0,
    shard_area_mm2=300.0,  # a shard is thin AND small; big thin faces are real panels
    segments=12,
    thickness=0.006,
    w_neck=0.6,
    w_head=0.4,
    dry_run=0,
)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    a = dict(DEF)
    i = 0
    while i < len(argv):
        k = argv[i].lstrip("-").replace("-", "_")
        if k in a:
            v = argv[i + 1]
            a[k] = type(DEF[k])(v) if not isinstance(DEF[k], str) else v
            i += 2
        else:
            i += 1
    return a


# ------------------------------------------------------------------ helpers
def own_scene():
    """My own scene. Never touches another lane's scene or the file at large."""
    wm = bpy.data.window_managers[0] if len(bpy.data.window_managers) else None
    win = wm.windows[0] if wm and len(wm.windows) else None
    sc = bpy.data.scenes.get(SCENE)
    if sc is None:
        sc = bpy.data.scenes.new(SCENE)
    else:
        for o in list(sc.objects):
            bpy.data.objects.remove(o, do_unlink=True)
    if win is not None:
        win.scene = sc
    else:
        for o in list(bpy.context.scene.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        sc = bpy.context.scene
    # purge what the last run orphaned: a leftover action would otherwise come
    # back as "<clip>.001" and the exporter would write TWO clips into the GLB.
    for _ in range(4):
        bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True,
                                       do_recursive=True)
    return sc


def imported(fn):
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=fn)
    return [bpy.data.objects[n] for n in bpy.data.objects.keys() if n not in before]


def mesh_np(ob):
    m = ob.data
    nv, nl, npo = len(m.vertices), len(m.loops), len(m.polygons)
    co = np.empty(nv * 3); m.vertices.foreach_get("co", co)
    lv = np.empty(nl, dtype=np.int64); m.loops.foreach_get("vertex_index", lv)
    uv = np.empty(nl * 2); m.uv_layers.active.data.foreach_get("uv", uv)
    pc = np.empty(npo * 3); m.polygons.foreach_get("center", pc)
    pn = np.empty(npo * 3); m.polygons.foreach_get("normal", pn)
    pa = np.empty(npo); m.polygons.foreach_get("area", pa)
    ls = np.empty(npo, dtype=np.int64); m.polygons.foreach_get("loop_start", ls)
    lt = np.empty(npo, dtype=np.int64); m.polygons.foreach_get("loop_total", lt)
    return dict(co=co.reshape(nv, 3), lv=lv, uv=uv.reshape(nl, 2),
                pc=pc.reshape(npo, 3), pn=pn.reshape(npo, 3), pa=pa,
                ls=ls, lt=lt, n=npo)


def base_texture(ob):
    mat = ob.data.materials[0]
    return mat, next(nd.image for nd in mat.node_tree.nodes
                     if nd.type == "TEX_IMAGE" and nd.image)


def paint_classes(rgb):
    """the weight-normalizer's palette tests, on already-sampled texels."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = (r + g + b) / 3.0
    navy = (b > r * 1.05) & (lum < 0.45)
    orange = (r > b * 1.5) & (g < r * 0.62) & (r > 0.12)
    darkred = (r > b * 1.3) & (r > g * 1.3) & (lum < 0.25)
    white = lum > 0.62
    return dict(navy=navy, orange=orange, darkred=darkred, white=white, lum=lum)


def run(A):
    R = {"inputs": {"glb": A["glb_in"]}, "out": A["glb_out"], "params":
         {k: v for k, v in A.items() if k not in ("glb_in", "glb_out", "report")}}
    sc = own_scene()
    objs = imported(A["glb_in"])
    arm = next(o for o in objs if o.type == "ARMATURE")
    skinned = [o for o in objs if o.type == "MESH" and o.vertex_groups
               and any(m.type == "ARMATURE" for m in o.modifiers)]
    body = max(skinned, key=lambda o: len(o.data.vertices))
    head = next(o for o in skinned if o is not body)
    roots = [o for o in objs if o.type == "EMPTY" and o.parent is None]
    R["scene"] = sc.name
    R["objects"] = {"armature": arm.name, "body": body.name, "head": head.name,
                    "roots": [o.name for o in roots]}
    act = arm.animation_data.action if arm.animation_data else None
    R["animation"] = {"action": act.name if act else None,
                      "frame_range": [round(float(v), 3) for v in act.frame_range] if act else None}
    if act:
        sc.frame_start, sc.frame_end = int(act.frame_range[0]), int(act.frame_range[1])

    B, Hd = mesh_np(body), mesh_np(head)
    R["before"] = {"bodyVerts": B["co"].shape[0], "bodyTris": B["n"],
                   "headVerts": Hd["co"].shape[0], "headTris": Hd["n"]}

    # -------------------------------------------------- 1. the neck cylinder
    aw = np.array(arm.matrix_world)

    def bwp(name, which):
        b = arm.data.bones[name]
        return (aw @ np.append(np.array(getattr(b, which + "_local")), 1.0))[:3]

    P0, P1 = bwp(NECK_BONE, "head"), bwp(HEAD_BONE, "head")
    AX = P1 - P0
    AXn = AX / np.linalg.norm(AX)
    fwd = np.array([0.0, 1.0, 0.0])
    F = fwd - (fwd @ AXn) * AXn
    F /= np.linalg.norm(F)
    S = np.cross(AXn, F)

    def cylang(pts):
        d = pts - P0
        t = d @ AXn
        p = d - t[:, None] * AXn
        r = np.linalg.norm(p, axis=1)
        return t, r, np.degrees(np.arctan2(p @ S, p @ F))

    R["axis"] = {"P0": [round(float(x), 5) for x in P0],
                 "P1": [round(float(x), 5) for x in P1],
                 "len_m": round(float(np.linalg.norm(AX)), 5)}

    # ------------------------- 2. neck-skin envelope from the graft's neck band
    idx = {i: vg.name for i, vg in enumerate(head.vertex_groups)}
    wneck = np.zeros(len(head.data.vertices))
    for v in head.data.vertices:
        for g in v.groups:
            if idx.get(g.group) == NECK_BONE:
                wneck[v.index] += g.weight
    neckish = wneck > 0.25
    ht, hr, ha = cylang(Hd["co"])
    NSEC = 24
    SECW = 360.0 / NSEC

    def sector_of(a):
        return np.floor((a + 180.0) / SECW).astype(int) % NSEC

    hs = sector_of(ha)
    TL = np.arange(A["t_lo"], A["t_hi"] + 1e-9, 0.01)
    env = np.zeros((len(TL), NSEC))
    got = np.zeros((len(TL), NSEC), dtype=bool)
    for ti, t0 in enumerate(TL):
        band = neckish & (ht >= t0 - 0.02) & (ht <= t0 + 0.02)
        for k in range(NSEC):
            sel = band & (np.abs(((hs - k + NSEC // 2) % NSEC) - NSEC // 2) <= 1)
            if sel.sum() >= 3:
                env[ti, k] = np.percentile(hr[sel], 90)
                got[ti, k] = True
    # fill sector gaps circularly, then height gaps by nearest measured row
    for ti in range(len(TL)):
        if not got[ti].any():
            continue
        for k in range(NSEC):
            if got[ti, k]:
                continue
            for d in range(1, NSEC):
                a, b = (k - d) % NSEC, (k + d) % NSEC
                if got[ti, a] or got[ti, b]:
                    va = env[ti, a] if got[ti, a] else env[ti, b]
                    vb = env[ti, b] if got[ti, b] else env[ti, a]
                    env[ti, k] = 0.5 * (va + vb)
                    break
    rows = [ti for ti in range(len(TL)) if got[ti].any()]
    for ti in range(len(TL)):
        if ti not in rows:
            env[ti] = env[min(rows, key=lambda r: abs(r - ti))]
    R["neckEnvelope"] = {"tLevels": [round(float(t), 3) for t in TL],
                         "sectors": NSEC,
                         "measuredRows": len(rows),
                         "r_min": round(float(env.min()), 4),
                         "r_max": round(float(env.max()), 4),
                         "front_p50": round(float(np.median(env[:, NSEC // 2])), 4),
                         "back_p50": round(float(np.median(env[:, 0])), 4),
                         "neckishVerts": int(neckish.sum())}

    def env_at(t, a):
        ti = np.clip(np.round((t - TL[0]) / 0.01).astype(int), 0, len(TL) - 1)
        return env[ti, sector_of(a)]

    # ------------------------------------------- 3. classify the body's faces
    mat, img = base_texture(body)
    W, H = img.size
    px = np.empty(W * H * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(H, W, 4)

    uvf = np.zeros((B["n"], 2))
    for i in range(B["n"]):
        s, k = int(B["ls"][i]), int(B["lt"][i])
        uvf[i] = B["uv"][s:s + k].mean(0)
    xi = np.clip(np.round(np.mod(uvf[:, 0], 1) * (W - 1)).astype(int), 0, W - 1)
    yi = np.clip(np.round(np.mod(uvf[:, 1], 1) * (H - 1)).astype(int), 0, H - 1)
    rgb = px[yi, xi, :3].astype(np.float64)
    C = paint_classes(rgb)

    v0 = B["co"][B["lv"][B["ls"]]]
    v1 = B["co"][B["lv"][B["ls"] + 1]]
    v2 = B["co"][B["lv"][B["ls"] + 2]]
    e = np.stack([np.linalg.norm(v1 - v0, axis=1), np.linalg.norm(v2 - v1, axis=1),
                  np.linalg.norm(v0 - v2, axis=1)], 1)
    aspect = (e.max(1) ** 2) / (2 * np.maximum(B["pa"], 1e-12)) / 1.1547

    bt, br, ba = cylang(B["pc"])
    d = B["pc"] - P0
    radv = d - (d @ AXn)[:, None] * AXn
    ndot = (B["pn"] * (radv / np.maximum(np.linalg.norm(radv, axis=1), 1e-9)[:, None])).sum(1)

    zone = (bt >= A["t_lo"]) & (bt <= A["t_hi"]) & (br <= A["r_cap"])
    buried = br <= (env_at(bt, ba) + A["bury_margin"])
    warm = C["orange"] | C["darkred"]
    sliver = (aspect > A["sliver_aspect"]) & (B["pa"] * 1e6 < A["shard_area_mm2"])
    # the cream shirt V and the outer coat collar are broad, well-shaped panels:
    # they are protected unless they are themselves degenerate shards.
    protect = (C["white"] & ~sliver) | (C["navy"] & ~sliver & ~buried)
    kill = zone & ~protect & ((warm & buried) | (warm & sliver) | (sliver & buried))

    R["cut"] = {
        "zoneFaces": int(zone.sum()),
        "zoneBuried": int((zone & buried).sum()),
        "zoneSlivers": int((zone & sliver).sum()),
        "deleted": int(kill.sum()),
        "deletedWarmLining": int((kill & warm).sum()),
        "deletedOrange": int((kill & C["orange"]).sum()),
        "deletedDarkRed": int((kill & C["darkred"]).sum()),
        "deletedWarmBuried": int((kill & warm & buried).sum()),
        "deletedWarmSlivers": int((kill & warm & sliver).sum()),
        "deletedColdSlivers": int((kill & sliver & ~warm).sum()),
        "deletedNavyShards": int((kill & C["navy"]).sum()),
        "deletedWhiteShards": int((kill & C["white"]).sum()),
        "keptWarmInZone": int((zone & warm & ~kill).sum()),
        "keptWarmOutsideZone": int((warm & ~zone).sum()),
        "protectedWhiteInZone": int((zone & C["white"] & ~kill).sum()),
        "protectedNavyInZone": int((zone & C["navy"] & ~kill).sum()),
        "protectedByPanelRule": int((zone & protect).sum()),
        "deleted_meanRGB": [round(float(x), 3) for x in rgb[kill].mean(0)] if kill.any() else None,
        "deleted_meanNdot": round(float(ndot[kill].mean()), 3) if kill.any() else None,
        "deleted_area_mm2": round(float(B["pa"][kill].sum() * 1e6), 1),
        "deleted_tRange": [round(float(bt[kill].min()), 4), round(float(bt[kill].max()), 4)] if kill.any() else None,
        "deleted_rRange": [round(float(br[kill].min()), 4), round(float(br[kill].max()), 4)] if kill.any() else None,
    }

    if A["dry_run"]:
        R["dryRun"] = True
        return R

    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.faces.ensure_lookup_table()
    doomed = [bm.faces[int(i)] for i in np.where(kill)[0]]
    bmesh.ops.delete(bm, geom=doomed, context="FACES_ONLY")
    bm.to_mesh(body.data)
    bm.free()
    body.data.update()
    R["cut"]["bodyTrisAfter"] = len(body.data.polygons)
    R["cut"]["customNormalsKept"] = bool(body.data.attributes.get("custom_normal"))

    # ------------------------------------------- 4. the body's own cravat navy
    bvt, bvr, bva = cylang(B["co"])
    vuv = np.zeros((B["co"].shape[0], 2))
    vuv[B["lv"]] = B["uv"]
    near = (bvt > -0.05) & (bvt < 0.08) & (bvr < A["r_cap"] + 0.02)
    vx = np.clip(np.round(np.mod(vuv[:, 0], 1) * (W - 1)).astype(int), 0, W - 1)
    vy = np.clip(np.round(np.mod(vuv[:, 1], 1) * (H - 1)).astype(int), 0, H - 1)
    vrgb = px[vy, vx, :3].astype(np.float64)
    VC = paint_classes(vrgb)
    cand = np.where(near & VC["navy"])[0]
    BLK = 40                                   # look for a uniform navy block
    best = None
    for i in cand:
        x, y = int(vx[i]), int(vy[i])
        x0, y0 = np.clip(x - BLK // 2, 0, W - BLK), np.clip(y - BLK // 2, 0, H - BLK)
        tile = px[y0:y0 + BLK, x0:x0 + BLK, :3].astype(np.float64)
        tc = paint_classes(tile)
        if not tc["navy"].all():
            continue
        score = float(tile.reshape(-1, 3).std(0).sum())
        if best is None or score < best[0]:
            best = (score, x0, y0, tile.reshape(-1, 3).mean(0))
    if best is None:                            # fall back: darkest navy texel
        i = cand[np.argmin(VC["lum"][cand])] if len(cand) else 0
        x0, y0 = int(np.clip(vx[i] - BLK // 2, 0, W - BLK)), int(np.clip(vy[i] - BLK // 2, 0, H - BLK))
        best = (float("nan"), x0, y0, px[y0:y0 + BLK, x0:x0 + BLK, :3].reshape(-1, 3).mean(0))
    _, BX, BY, navy_rgb = best
    INS = 8                                     # inset: survives the JPEG shrink
    u0, u1 = (BX + INS) / (W - 1), (BX + BLK - INS) / (W - 1)
    vv0, vv1 = (BY + INS) / (H - 1), (BY + BLK - INS) / (H - 1)
    R["cravatNavy"] = {"candidateNavyVerts": int(len(cand)),
                       "texelBlock": [int(BX), int(BY), BLK],
                       "uniform": bool(best[0] == best[0]),
                       "linearRGB": [round(float(x), 4) for x in navy_rgb],
                       "srgb8": [int(round(255 * (1.055 * float(c) ** (1 / 2.4) - 0.055
                                                  if c > 0.0031308 else 12.92 * float(c))))
                                 for c in navy_rgb],
                       "uvBox": [round(u0, 6), round(vv0, 6), round(u1, 6), round(vv1, 6)]}

    # ------------------------------------------------------ 5. build the band
    NSEG = A["segments"]
    LEVELS = [(-0.025, 1.10, 0.016), (0.005, 1.08, 0.015), (0.035, 1.04, 0.013),
              (0.065, 0.99, 0.011), (0.092, 0.88, 0.010)]
    verts, faces, uvs = [], [], []
    NV = len(LEVELS) * NSEG

    def ring_r(t, a, k, margin):
        return float(min(env_at(np.array([t]), np.array([a]))[0] * k + margin,
                         A["cravat_cap"]))

    ang = [(-180.0 + j * 360.0 / NSEG) for j in range(NSEG)]
    radii = []
    for (t, k, margin) in LEVELS:
        rr = [ring_r(t, a, k, margin) for a in ang]
        # circular smoothing so the band is a band, not a wobble
        rr = [(rr[(j - 1) % NSEG] + 2 * rr[j] + rr[(j + 1) % NSEG]) / 4.0 for j in range(NSEG)]
        radii.append(rr)
        for j, a in enumerate(ang):
            rad = np.radians(a)
            dirv = np.cos(rad) * F + np.sin(rad) * S
            verts.append(tuple(P0 + t * AXn + rr[j] * dirv))
    for (t, k, margin), rr in zip(LEVELS, radii):
        for j, a in enumerate(ang):
            rad = np.radians(a)
            dirv = np.cos(rad) * F + np.sin(rad) * S
            verts.append(tuple(P0 + t * AXn + max(rr[j] - A["thickness"], 0.004) * dirv))

    def O(i, j):
        return i * NSEG + (j % NSEG)

    def I(i, j):
        return NV + i * NSEG + (j % NSEG)

    ML = len(LEVELS)
    for i in range(ML - 1):
        for j in range(NSEG):
            faces += [(O(i, j), O(i, j + 1), O(i + 1, j + 1)), (O(i, j), O(i + 1, j + 1), O(i + 1, j))]
            faces += [(I(i, j), I(i + 1, j + 1), I(i, j + 1)), (I(i, j), I(i + 1, j), I(i + 1, j + 1))]
    for j in range(NSEG):                       # top rim
        faces += [(O(ML - 1, j), I(ML - 1, j), I(ML - 1, j + 1)),
                  (O(ML - 1, j), I(ML - 1, j + 1), O(ML - 1, j + 1))]
    for j in range(NSEG):                       # bottom rim
        faces += [(O(0, j), I(0, j + 1), I(0, j)), (O(0, j), O(0, j + 1), I(0, j + 1))]

    me = bpy.data.meshes.new("neckCravatMesh")
    me.from_pydata(verts, [], faces)
    me.validate()
    # NB the name matters: tools/graftverify.mjs takes the graft as the first
    # skinned mesh matching /goodface|head/i and the BODY as the first one that
    # is not it, walking the glTF nodes in name order. "neckCravat" sorts after
    # "mesh", so the seam metrics keep pairing graft against body.
    cravat = bpy.data.objects.new("neckCravat", me)
    sc.collection.objects.link(cravat)
    cravat.parent = body.parent
    cravat.matrix_world = body.matrix_world.copy()
    me.materials.append(mat)                    # the BODY's material: no new image
    uvl = me.uv_layers.new(name="UVMap")
    for p in me.polygons:
        p.use_smooth = False
    for li, loop in enumerate(me.loops):
        vi = loop.vertex_index
        i, j = (vi % NV) // NSEG, vi % NSEG
        uvl.data[li].uv = (u0 + (u1 - u0) * (j / (NSEG - 1.0)),
                           vv0 + (vv1 - vv0) * (i / (ML - 1.0)))
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()

    vg_n = cravat.vertex_groups.new(name=NECK_BONE)
    vg_h = cravat.vertex_groups.new(name=HEAD_BONE)
    allv = list(range(len(me.vertices)))
    vg_n.add(allv, A["w_neck"], "REPLACE")
    vg_h.add(allv, A["w_head"], "REPLACE")
    mod = cravat.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm
    mod.use_vertex_groups = True

    zs = [v.co[2] for v in me.vertices]
    R["cravat"] = {"name": cravat.name, "verts": len(me.vertices),
                   "tris": len(me.polygons), "segments": NSEG, "rings": ML,
                   "thickness_m": A["thickness"], "flatShaded": not any(p.use_smooth for p in me.polygons),
                   "material": mat.name, "newMaterials": 0, "newImages": 0,
                   "weights": {NECK_BONE: A["w_neck"], HEAD_BONE: A["w_head"]},
                   "worldZ": [round(float(min(zs)), 4), round(float(max(zs)), 4)],
                   "radius_front_m": round(float(radii[2][NSEG // 2]), 4),
                   "radius_back_m": round(float(radii[2][0]), 4),
                   "radiusByRing": [[round(float(x), 4) for x in rr] for rr in radii],
                   "graftMinZ": round(float(Hd["co"][:, 2].min()), 4),
                   "coversJoin": bool(min(zs) < float(Hd["co"][:, 2].min()) < max(zs))}

    # --------------------------------------------------------- 6. export GLB
    os.makedirs(os.path.dirname(A["glb_out"]), exist_ok=True)
    for s in bpy.data.scenes:
        for o in s.objects:
            try:
                o.select_set(False, view_layer=s.view_layers[0])
            except (RuntimeError, TypeError):
                pass
    for o in [arm, body, head, cravat] + roots:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    props = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
    want = {"export_format": "GLB", "use_selection": True, "export_animations": True,
            "export_skins": True, "export_apply": False, "export_yup": True,
            "export_animation_mode": "ACTIONS", "export_frame_range": False,
            "export_optimize_animation_size": False, "export_image_format": "AUTO",
            "export_normals": True, "export_all_influences": False,
            "export_def_bones": False, "export_morph": False,
            "export_bake_animation": False, "export_reset_pose_bones": False}
    kw = {"filepath": A["glb_out"]}
    kw.update({k: v for k, v in want.items() if k in props})
    R["exportArgs"] = {k: v for k, v in kw.items() if k != "filepath"}
    bpy.ops.export_scene.gltf(**kw)
    R["export"] = {"path": A["glb_out"], "bytes": os.path.getsize(A["glb_out"])}
    return R


if __name__ == "__main__":
    _A = parse_args()
    _R = run(_A)
    if _A["report"]:
        os.makedirs(os.path.dirname(_A["report"]), exist_ok=True)
        with open(_A["report"], "w") as fh:
            json.dump(_R, fh, indent=2)
    print("REPORT-BEGIN")
    print(json.dumps(_R))
    print("REPORT-END")
