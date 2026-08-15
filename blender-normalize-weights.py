#!/usr/bin/env python3
"""blender-normalize-weights.py — WEIGHT NORMALIZER pipeline stage.

Fixes the Make-It-Animatable cloak defect on the auto-rigged King: cloak
panels near the arms carry Shoulder/Arm/ForeArm/Hand (and some stray
Leg/Spine2) weights, and the rigger's reset-to-rest dragged those panels into
a spread bat-wing shape that is BAKED INTO THE BIND GEOMETRY. Wide-arm poses
then tear the cloak into bat-wings.

Method (fully deterministic, no RNG):
  1. VERTEX CORRESPONDENCE — the rigged GLB (FBX roundtrip of the rigger's
     output) has the same 22,798 verts as the original Tripo model, permuted.
     Verts are matched 1:1 by their UV coordinates (rounded to 1e-5).
  2. FRAME FIT — a similarity transform (uniform scale + rotation +
     translation, closed-form Kabsch) maps the original model into the rigged
     bind frame. Fit on stable verts (no arm influence, below chest, hugging
     a bone), refined once on the best 60% inliers. The original king faces
     ~37 deg off-axis and is rescaled by the rigger's canonicalization; the
     fit lands body verts within ~2 cm median.
  3. CLOAK CLASSIFICATION — a vert is cloak iff
       (fabric paint AND arm-chain weight > --arm-w-min)  OR
       (farther than --far-dist from EVERY bone segment, below --z-cap,
        and not painted tan/white — protects the cane and the cuffs).
     Fabric paint is sampled from the base-color texture at the vert's UV:
     navy (b > r*1.05 & lum < 0.45) or orange lining (r > b*1.5 &
     g < r*0.62 & r > 0.12). The resulting 0/1 field is relaxed
     --smooth-iters times over the edge graph (f' = f/2 + neighbor-mean/2)
     so class boundaries can never leave spike triangles.
  4. DRAPE RESTORE — cloak verts' bind positions are lerped (by the relaxed
     fraction g) onto the similarity-transformed ORIGINAL positions: the
     cloak gets back its authored drape exactly, including the flared floor
     hem. Corner normals of fully-restored verts are replaced by the fitted
     rotation applied to the original vertex normals.
  5. REWEIGHT — per cloak vert, arm-chain influence * g moves onto
     Spine2 (upper) / Spine1 (mid) / Hips (lower), blended piecewise-linearly
     by draped height between bone-derived anchors; free-hanging verts
     (farther than --far-dist from every bone, g > 0.5) additionally move
     their leg/neck/head influence the same way. Weights renormalize to 1.
  6. EXPORT — GLB with skinning and the baked run action intact.

usage (headless):
  blender --background --python tools/blender-normalize-weights.py -- \
      --glb-in   assets/raw/makeitanimatable/<stamp>/animatable-model-preview.glb \
      --glb-orig assets/plates/king-v2/king2-tripo.glb \
      --glb-out  assets/plates/king-v2/king2-rigged-fixed.glb \
      [--arm-w-min 0.05] [--far-dist 0.12] [--z-cap 0.5] [--smooth-iters 3] \
      [--report /tmp/normalizer-report.json]

Also runnable inside a live Blender via runpy with the same argv convention.
Prints a JSON stats report between REPORT-BEGIN/REPORT-END lines.
"""
import argparse
import json
import sys

import bpy
import numpy as np
from mathutils import Matrix

ARM_KEYS = ("Shoulder", "Arm", "ForeArm", "Hand")
TORSO = ("Hips", "Spine", "Spine1", "Spine2")


def parse_args(argv=None):
    if argv is None:
        argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--glb-in", required=True, help="auto-rigged GLB")
    ap.add_argument("--glb-orig", required=True,
                    help="original (pre-rig) model, the rigger's input")
    ap.add_argument("--glb-out", required=True)
    ap.add_argument("--arm-w-min", type=float, default=0.05)
    ap.add_argument("--far-dist", type=float, default=0.12)
    ap.add_argument("--z-cap", type=float, default=0.5)
    ap.add_argument("--smooth-iters", type=int, default=3)
    ap.add_argument("--report", default=None)
    return ap.parse_args(argv)


def wipe_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials,
                 bpy.data.images, bpy.data.actions):
        for block in list(coll):
            if block.users == 0:
                coll.remove(block)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def mesh_arrays(mesh_ob):
    """world-space vert positions, per-vertex UV, per-vertex normal."""
    m = mesh_ob.data
    n = len(m.vertices)
    co = np.empty(n * 3)
    m.vertices.foreach_get("co", co)
    co = co.reshape(n, 3)
    mw = np.array(mesh_ob.matrix_world)
    co = (np.concatenate([co, np.ones((n, 1))], 1) @ mw.T)[:, :3]

    nloops = len(m.loops)
    loops_v = np.empty(nloops, dtype=np.int64)
    m.loops.foreach_get("vertex_index", loops_v)
    uvs = np.empty(nloops * 2)
    m.uv_layers.active.data.foreach_get("uv", uvs)
    uvs = uvs.reshape(-1, 2)
    vuv = np.zeros((n, 2))
    vuv[loops_v] = uvs  # any loop of the vert; glTF verts have one UV each

    nrm = np.empty(n * 3)
    m.vertices.foreach_get("normal", nrm)
    nrm = nrm.reshape(n, 3)
    nrm = nrm @ np.linalg.inv(mw[:3, :3]).T  # world-space (ignore scale sign)
    return co, vuv, nrm


def uv_match(uv_from, uv_to):
    """index into `uv_to`'s mesh for each vert of `uv_from`'s; -1 if no match."""
    key = {}
    for i, (u, v) in enumerate(np.round(uv_to, 5)):
        key.setdefault((u, v), []).append(i)
    match = np.full(len(uv_from), -1, dtype=np.int64)
    for j, (u, v) in enumerate(np.round(uv_from, 5)):
        c = key.get((u, v))
        if c and len(c) == 1:
            match[j] = c[0]
    return match


def kabsch_similarity(src, dst):
    """closed-form uniform-scale + rotation + translation, src -> dst."""
    sm, dm = src.mean(0), dst.mean(0)
    sc, dc = src - sm, dst - dm
    h = sc.T @ dc
    u, sv, vt = np.linalg.svd(h)
    d = np.sign(np.linalg.det(vt.T @ u.T))
    dd = np.diag([1.0, 1.0, d])
    rot = vt.T @ dd @ u.T
    s = (sv * np.diag(dd)).sum() / (sc ** 2).sum()
    t = dm - s * (rot @ sm)
    return s, rot, t


def group_weights(mesh_ob, keys):
    """summed weight per vert over vertex groups whose name contains any key."""
    m = mesh_ob.data
    idx = {i for i, vg in enumerate(mesh_ob.vertex_groups)
           if any(k in vg.name for k in keys)}
    w = np.zeros(len(m.vertices))
    for v in m.vertices:
        for g in v.groups:
            if g.group in idx:
                w[v.index] += g.weight
    return w, idx


def bone_distances(arm_ob, co, keys=None):
    """distance from each vert to the nearest matching bone segment."""
    aw = np.array(arm_ob.matrix_world)
    dist = np.full(len(co), 1e9)
    for b in arm_ob.data.bones:
        if keys is not None and not any(k in b.name for k in keys):
            continue
        head = (aw @ np.append(np.array(b.head_local), 1.0))[:3]
        tail = (aw @ np.append(np.array(b.tail_local), 1.0))[:3]
        d = tail - head
        tpar = np.clip(((co - head) @ d) / max(d.dot(d), 1e-12), 0.0, 1.0)
        dist = np.minimum(dist, np.linalg.norm(co - (head + tpar[:, None] * d), axis=1))
    return dist


def paint_classes(mesh_ob, vuv):
    mat = mesh_ob.data.materials[0]
    img = next(nd.image for nd in mat.node_tree.nodes
               if nd.type == "TEX_IMAGE" and nd.image)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    xi = np.clip(np.round(np.mod(vuv[:, 0], 1) * (w - 1)).astype(int), 0, w - 1)
    yi = np.clip(np.round(np.mod(vuv[:, 1], 1) * (h - 1)).astype(int), 0, h - 1)
    rgb = px[yi, xi, :3].astype(np.float64)
    r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    lum = (r + g + b) / 3.0
    navy = (b > r * 1.05) & (lum < 0.45)
    orange = (r > b * 1.5) & (g < r * 0.62) & (r > 0.12)
    tan = (r > b * 1.2) & (g >= r * 0.62) & (lum > 0.3)
    white = lum > 0.62
    return navy | orange, tan, white


def relax(mesh_ob, field, iters):
    m = mesh_ob.data
    ne = len(m.edges)
    ev = np.empty(ne * 2, dtype=np.int64)
    m.edges.foreach_get("vertices", ev)
    ev = ev.reshape(-1, 2)
    deg = np.zeros(len(field))
    np.add.at(deg, ev[:, 0], 1.0)
    np.add.at(deg, ev[:, 1], 1.0)
    deg[deg == 0] = 1.0
    for _ in range(iters):
        acc = np.zeros(len(field))
        np.add.at(acc, ev[:, 0], field[ev[:, 1]])
        np.add.at(acc, ev[:, 1], field[ev[:, 0]])
        field = 0.5 * field + 0.5 * acc / deg
    return field


def bake_positions(mesh_ob, target_world, g, rot, orig_normals, match):
    """lerp bind verts toward target (world space) by g; refresh normals."""
    m = mesh_ob.data
    n = len(m.vertices)
    co = np.empty(n * 3)
    m.vertices.foreach_get("co", co)
    co = co.reshape(n, 3)
    mw = np.array(mesh_ob.matrix_world)
    co_w = (np.concatenate([co, np.ones((n, 1))], 1) @ mw.T)[:, :3]
    baked_w = co_w * (1 - g[:, None]) + target_world * g[:, None]
    inv = np.linalg.inv(mw)
    baked_l = (np.concatenate([baked_w, np.ones((n, 1))], 1) @ inv.T)[:, :3]

    normals_ok = True
    try:
        nloops = len(m.loops)
        loops_v = np.empty(nloops, dtype=np.int64)
        m.loops.foreach_get("vertex_index", loops_v)
        cur = np.empty(nloops * 3, dtype=np.float32)
        m.corner_normals.foreach_get("vector", cur)
        cur = cur.reshape(-1, 3)
        restored = (orig_normals[np.maximum(match, 0)] @ rot.T)
        restored /= np.maximum(np.linalg.norm(restored, axis=1, keepdims=True), 1e-9)
        use = (g[loops_v] > 0.5) & (match[loops_v] >= 0)
        blended = np.where(use[:, None], restored[loops_v], cur)
    except Exception as exc:  # API drift guard: stale normals over a crash
        normals_ok = False
        print("WARN: corner-normal refresh skipped:", exc)

    m.vertices.foreach_set("co", baked_l.reshape(-1))
    m.update()
    if normals_ok:
        m.normals_split_custom_set(blended.tolist())
    return normals_ok


def spine_alloc(z, anchors):
    z_hips, z_s1, z_s2 = anchors
    if z >= z_s2:
        return {"Spine2": 1.0}
    if z >= z_s1:
        t = (z - z_s1) / (z_s2 - z_s1)
        return {"Spine2": t, "Spine1": 1.0 - t}
    if z >= z_hips:
        t = (z - z_hips) / (z_s1 - z_hips)
        return {"Spine1": t, "Hips": 1.0 - t}
    return {"Hips": 1.0}


def reweight(arm_ob, mesh_ob, g, farcore, arm_idx, baked_z):
    m = mesh_ob.data
    vgs = mesh_ob.vertex_groups
    torso_idx = {i for i, vg in enumerate(vgs)
                 if any(vg.name.endswith(t) for t in TORSO)}

    def bone(suffix):
        return next(b for b in arm_ob.data.bones if b.name.endswith(suffix))

    anchors = (bone("Hips").head_local.z,
               bone("Spine1").head_local.z,
               (bone("Spine2").head_local.z + bone("Spine2").tail_local.z) / 2)
    targets = {t: next(vg for vg in vgs if vg.name.endswith(t))
               for t in ("Hips", "Spine1", "Spine2")}

    moved_from, moved_to = {}, {"Hips": 0.0, "Spine1": 0.0, "Spine2": 0.0}
    touched = 0
    for v in m.vertices:
        gi_f = g[v.index]
        if gi_f < 0.01:
            continue
        # groups whose mass leaves this vert: arm chain always; every
        # non-torso group when the vert hangs free of the whole skeleton
        source = arm_idx if not farcore[v.index] else \
            {e.group for e in v.groups} - torso_idx
        entries = [(e.group, e.weight) for e in v.groups]
        mass = sum(w for gidx, w in entries if gidx in source)
        if mass <= 1e-8:
            continue
        touched += 1
        move = gi_f * mass
        new_w = {}
        for gidx, w in entries:
            if gidx in source:
                new_w[gidx] = w * (1.0 - gi_f)
                name = vgs[gidx].name
                moved_from[name] = moved_from.get(name, 0.0) + w * gi_f
            else:
                new_w[gidx] = w
        for tname, frac in spine_alloc(baked_z[v.index], anchors).items():
            gidx = targets[tname].index
            new_w[gidx] = new_w.get(gidx, 0.0) + move * frac
            moved_to[tname] += move * frac
        total = sum(new_w.values())
        for gidx, w in new_w.items():
            vgs[gidx].add([v.index], w / total, "REPLACE")
    return touched, moved_from, moved_to, anchors


def export_glb(arm_ob, mesh_ob, path):
    for ob in bpy.data.objects:
        ob.select_set(False)
    keep = {arm_ob, mesh_ob}
    p = arm_ob.parent
    while p is not None:
        keep.add(p)
        p = p.parent
    for ob in keep:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = arm_ob
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_skins=True,
    )


def run(glb_in, glb_orig, glb_out, arm_w_min=0.05, far_dist=0.12,
        z_cap=0.5, smooth_iters=3, report_path=None):
    wipe_scene()
    import_glb(glb_in)
    arm_ob = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    mesh_ob = next(o for o in bpy.data.objects
                   if o.type == "MESH" and o.find_armature() == arm_ob)
    co, vuv, _ = mesh_arrays(mesh_ob)
    n = len(co)

    orig_objs = import_glb(glb_orig)
    orig_mesh = max((o for o in orig_objs if o.type == "MESH"),
                    key=lambda o: len(o.data.vertices))
    co0, vuv0, nrm0 = mesh_arrays(orig_mesh)
    for ob in orig_objs:
        bpy.data.objects.remove(ob, do_unlink=True)
    if len(co0) != n:
        print(f"WARN: vertex counts differ ({n} vs {len(co0)}); "
              "matching by UV only")

    match = uv_match(vuv, vuv0)
    match_rate = float((match >= 0).mean())

    armw, arm_idx = group_weights(mesh_ob, ARM_KEYS)
    dist_all = bone_distances(arm_ob, co)

    stable = (match >= 0) & (armw < 0.01) & (co[:, 2] < 0.2) & (dist_all < 0.1)
    s, rot, t = kabsch_similarity(co0[match[stable]], co[stable])
    res = np.linalg.norm((s * (rot @ co0[match[stable]].T).T + t) - co[stable], axis=1)
    inliers = res < np.percentile(res, 60)
    s, rot, t = kabsch_similarity(co0[match[stable]][inliers], co[stable][inliers])
    orig_in_rig = s * (rot @ co0[np.maximum(match, 0)].T).T + t
    fit_res = float(np.median(np.linalg.norm(
        (s * (rot @ co0[match[stable]][inliers].T).T + t) - co[stable][inliers], axis=1)))

    fabric, tan, white = paint_classes(mesh_ob, vuv)
    far = (dist_all > far_dist) & (co[:, 2] < z_cap) & ~tan & ~white & (match >= 0)
    g = np.maximum((fabric & (armw > arm_w_min)).astype(float), far.astype(float))
    g[match < 0] = 0.0
    g = relax(mesh_ob, g, smooth_iters)
    g[match < 0] = 0.0

    normals_ok = bake_positions(mesh_ob, orig_in_rig, g, rot, nrm0, match)
    baked_z = np.empty(n * 3)
    mesh_ob.data.vertices.foreach_get("co", baked_z)
    baked_z = baked_z.reshape(n, 3)[:, 2]

    farcore = far & (g > 0.5)
    touched, moved_from, moved_to, anchors = reweight(
        arm_ob, mesh_ob, g, farcore, arm_idx, baked_z)
    export_glb(arm_ob, mesh_ob, glb_out)

    report = {
        "stage": "weight-normalizer",
        "blender": bpy.app.version_string,
        "glb_in": glb_in,
        "glb_orig": glb_orig,
        "glb_out": glb_out,
        "params": {"arm_w_min": arm_w_min, "far_dist": far_dist,
                   "z_cap": z_cap, "smooth_iters": smooth_iters},
        "verts_total": n,
        "uv_match_rate": round(match_rate, 4),
        "frame_fit": {"scale": round(float(s), 5),
                      "inlier_res_median": round(fit_res, 4)},
        "cloak_verts": int((g > 0.5).sum()),
        "cloak_verts_touched_weights": touched,
        "cloak_verts_free_hanging": int(farcore.sum()),
        "spine_anchors_z": [round(float(a), 4) for a in anchors],
        "weight_mass_moved_from": {k: round(v, 3) for k, v in sorted(moved_from.items())},
        "weight_mass_moved_to": {k: round(v, 3) for k, v in moved_to.items()},
        "normals_refreshed": normals_ok,
        "animation_actions": [a.name for a in bpy.data.actions],
    }
    print("REPORT-BEGIN")
    print(json.dumps(report, indent=2))
    print("REPORT-END")
    if report_path:
        with open(report_path, "w") as fh:
            json.dump(report, fh, indent=2)
    return report


if __name__ == "__main__":
    a = parse_args()
    run(a.glb_in, a.glb_orig, a.glb_out, a.arm_w_min, a.far_dist,
        a.z_cap, a.smooth_iters, a.report)
