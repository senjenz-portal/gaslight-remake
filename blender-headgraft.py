"""blender-headgraft.py — LANE A: HEAD TRANSPLANT.

Puts the CLEAN Tripo face back on the rigged, Blender-normalized King body.

  body : assets/plates/king-v2/king2-rigged-fixed.glb   (animated; its head
         texture/geometry came out of the auto-rig pipeline DEGRADED)
  head : assets/plates/king-v2/king2-head.glb           (headcut.mjs's clean
         extraction off the raw Tripo mesh — the good face)
  out  : assets/plates/king-v2/king2-rigged-goodface.glb

WHY THIS IS EXACT, NOT EYEBALLED
Both files descend from the SAME Tripo asset (material/texture id
f86ceccf-…), so they carry the SAME UV atlas. Every one of the head's 4778
vertices has a byte-exact UV twin in the body mesh. That gives:

  1. ALIGNMENT by correspondence, not by hand: Umeyama similarity fit
     (uniform scale + rotation + translation) over the uniquely-matched UV
     pairs, refit on the inner 95% to shrug off the verts the rig pipeline
     moved. Measured fit: s=1.0533, yaw -32.5 deg, sub-mm RMS. This aligns
     the eye line and the crown by construction — no probing needed.
  2. THE CUT by correspondence: the body faces to delete are exactly the
     body's copies of the head's faces (matched on their UV-key triple), so
     body-minus-head plus head == the original surface. The resulting hole's
     boundary IS headcut's neck plane (its narrowest-cross-section cut),
     which is the same "neck-plane logic" headcut.mjs used, transported here
     through the UV correspondence instead of re-derived from scratch.
  3. THE SEAM: the head's rim vertices are welded onto the body vertices they
     correspond to, and the graft inherits the body's ORIGINAL skin weights at
     those same vertices — so rim and hole are the same points with the same
     weights and cannot separate in any pose. This is the collar-overlap/rim-
     tuck goal (an invisible join at the collar line) achieved by welding
     rather than by hiding an inset rim: an inset rim would open a real gap
     here, because the counterpart cut leaves no spare geometry to hide it in.
  4. RIDING THE HEAD BONE: every graft vertex whose inherited weight on
     mixamorig:Head is >= 0.9 (the whole skull/face/jaw — the head proper) is
     snapped to a rigid 1.0 on mixamorig:Head, all other groups cleared, so
     the good face is bolted to the Head bone. Only the neck band below the
     jaw keeps the body's Head/Neck blend — rigid-binding that band is what
     makes a transplant snap at the collar when the neck bends.

The head keeps its OWN material and its own clean JPEG bake, so shrinking the
body's 4096 PNG later (tools/rigshrink.mjs) cannot touch the face.

Runs inside the shared Blender (tools/bsend.py) in its own scene, or headless:
  blender --background --python tools/blender-headgraft.py
Writes review/graft/graft-blender-report.json (so the report survives a socket
read timeout) and prints it.
"""
import json
import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = "/Users/samz/Documents/gaslight-remake"
BODY_GLB = os.path.join(ROOT, "assets/plates/king-v2/king2-rigged-fixed.glb")
HEAD_GLB = os.path.join(ROOT, "assets/plates/king-v2/king2-head.glb")
OUT_GLB = os.path.join(ROOT, "assets/plates/king-v2/king2-rigged-goodface.glb")
REPORT = os.path.join(ROOT, "review/graft/graft-blender-report.json")
SCENE = "LaneA_Graft"
UVQ = 1e5          # UV quantisation for the correspondence keys
RIGID_T = 0.9      # inherited Head weight >= this -> rigid 1.0 on Head
HEAD_BONE = "mixamorig:Head"

R = {"inputs": {"body": BODY_GLB, "head": HEAD_GLB}, "out": OUT_GLB}


# ------------------------------------------------------------------ helpers
def own_scene():
    """My own scene. Never touches the other lane's scene or the file at large."""
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
    else:                                  # background: no window to point
        for o in list(bpy.context.scene.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        sc = bpy.context.scene
    return sc


def imported(fn):
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=fn)
    return [bpy.data.objects[n] for n in bpy.data.objects.keys() if n not in before]


def vert_uv(ob):
    """per-vertex UV (first loop wins) + per-vertex loop count."""
    m = ob.data
    nl = len(m.loops)
    lv = np.empty(nl, dtype=np.int32)
    m.loops.foreach_get("vertex_index", lv)
    uv = np.empty(nl * 2)
    m.uv_layers[0].data.foreach_get("uv", uv)
    uv = uv.reshape(nl, 2)
    vuv = np.zeros((len(m.vertices), 2))
    seen = np.zeros(len(m.vertices), dtype=bool)
    for i in range(nl):
        v = lv[i]
        if not seen[v]:
            vuv[v] = uv[i]
            seen[v] = True
    return vuv, seen


def verts_co(ob):
    n = len(ob.data.vertices)
    co = np.empty(n * 3)
    ob.data.vertices.foreach_get("co", co)
    return co.reshape(n, 3)


def uvkey(uv):
    return (round(uv[0] * UVQ), round(uv[1] * UVQ))


def face_uvkeys(ob):
    uvd = ob.data.uv_layers[0].data
    out = []
    for p in ob.data.polygons:
        out.append(tuple(sorted(uvkey(uvd[li].uv) for li in p.loop_indices)))
    return out


def umeyama(A, B):
    """least-squares uniform-scale + rotation + translation taking A onto B."""
    ma, mb = A.mean(0), B.mean(0)
    A0, B0 = A - ma, B - mb
    U, S, Vt = np.linalg.svd(A0.T @ B0 / len(A))
    d = np.sign(np.linalg.det(Vt.T @ U.T))
    Rot = Vt.T @ np.diag([1.0, 1.0, d]) @ U.T
    s = (S * np.array([1.0, 1.0, d])).sum() / ((A0 ** 2).sum() / len(A))
    return s, Rot, mb - s * Rot @ ma


# ------------------------------------------------------------------ 1. load
sc = own_scene()
body_objs = imported(BODY_GLB)
arm = next(o for o in body_objs if o.type == "ARMATURE")
# NB the importer also spawns a 42-vert "Icosphere" as the armature's bone
# custom shape (its glTF_not_exported scaffolding — there is no such node in
# the GLB). The body is the skinned mesh: armature modifier + vertex groups.
skinned = [o for o in body_objs if o.type == "MESH" and o.vertex_groups
           and any(m.type == "ARMATURE" for m in o.modifiers)]
body = max(skinned, key=lambda o: len(o.data.vertices))
scaffold = [o for o in body_objs if o.type == "MESH" and o is not body]
roots = [o for o in body_objs if o.type == "EMPTY" and o.parent is None]
head = max((o for o in imported(HEAD_GLB) if o.type == "MESH"),
           key=lambda o: len(o.data.vertices))
R["scene"] = sc.name
R["objects"] = {"armature": arm.name, "body": body.name, "head": head.name,
                "roots": [o.name for o in roots],
                "importScaffoldNotExported": [o.name for o in scaffold]}
act = arm.animation_data.action if arm.animation_data else None
R["animation"] = {"action": act.name if act else None,
                  "frame_range": [round(v, 3) for v in act.frame_range] if act else None,
                  "fps": sc.render.fps}
if act:                                    # frame the clip in my scene
    sc.frame_start, sc.frame_end = int(act.frame_range[0]), int(act.frame_range[1])
R["source"] = {
    "body": {"verts": len(body.data.vertices), "tris": len(body.data.polygons),
             "groups": len(body.vertex_groups), "bones": len(arm.data.bones),
             "customNormals": bool(body.data.attributes.get("custom_normal"))},
    "head": {"verts": len(head.data.vertices), "tris": len(head.data.polygons),
             "customNormals": bool(head.data.attributes.get("custom_normal"))},
    "materials": {"body": [s.material.name for s in body.material_slots if s.material],
                  "head": [s.material.name for s in head.material_slots if s.material]},
}

# ------------------------------------------------------- 2. correspondence
buv, bseen = vert_uv(body)
huv, hseen = vert_uv(head)
bco, hco = verts_co(body), verts_co(head)
bykey = {}
for i in range(len(bco)):
    if bseen[i]:
        bykey.setdefault(uvkey(buv[i]), []).append(i)
uniq_h, uniq_b = [], []
for i in range(len(hco)):
    cand = bykey.get(uvkey(huv[i]))
    if cand and len(cand) == 1:
        uniq_h.append(i)
        uniq_b.append(cand[0])
matched = sum(1 for i in range(len(hco)) if uvkey(huv[i]) in bykey)
R["correspondence"] = {"headVerts": len(hco), "uvMatched": matched,
                       "uniquePairs": len(uniq_h), "bodyKeys": len(bykey)}
print("[graft] correspondence", json.dumps(R["correspondence"]), flush=True)
if len(uniq_h) < 200:
    raise SystemExit("not enough unique UV pairs (%d of %d matched, %d body keys)"
                     " — atlases differ" % (len(uniq_h), matched, len(bykey)))

# --------------------------------------------------------------- 3. the fit
A, B = hco[uniq_h], bco[uniq_b]
s, Rot, t = umeyama(A, B)
res = np.linalg.norm((s * (Rot @ A.T)).T + t - B, axis=1)
keep = res < np.percentile(res, 95)
s, Rot, t = umeyama(A[keep], B[keep])
res = np.linalg.norm((s * (Rot @ A.T)).T + t - B, axis=1)
M = Matrix([[*(s * Rot[0]), t[0]], [*(s * Rot[1]), t[1]], [*(s * Rot[2]), t[2]],
            [0.0, 0.0, 0.0, 1.0]])
eul = M.to_euler()
R["fit"] = {"scale": round(float(s), 6),
            "eulerXYZdeg": [round(math.degrees(v), 3) for v in eul],
            "translation": [round(float(v), 5) for v in t],
            "residual_mm": {"rms": round(float(1000 * np.sqrt((res ** 2).mean())), 3),
                            "p50": round(float(1000 * np.median(res)), 3),
                            "p95": round(float(1000 * np.percentile(res, 95)), 3),
                            "max": round(float(1000 * res.max()), 3)},
            "refitPairs": int(keep.sum())}

head.matrix_world = M
bpy.context.view_layer.update()
try:                                        # bake it in (keeps custom normals)
    with bpy.context.temp_override(object=head, active_object=head,
                                   selected_objects=[head],
                                   selected_editable_objects=[head]):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    R["fit"]["applied"] = "transform_apply"
except Exception as e:                       # headless / no view layer: bake by hand
    head.data.transform(M)
    head.matrix_world = Matrix.Identity(4)
    R["fit"]["applied"] = "mesh.transform (%s)" % type(e).__name__
hco = verts_co(head)

# --------------------------------- 4. counterpart map + the body's weights
gname = [g.name for g in body.vertex_groups]
bweights = [{} for _ in range(len(bco))]
for v in body.data.vertices:
    for g in v.groups:
        if g.weight > 0.0:
            bweights[v.index][gname[g.group]] = g.weight
partner = np.full(len(hco), -1, dtype=np.int32)
for i in range(len(hco)):
    cand = bykey.get(uvkey(huv[i]))
    if not cand:
        continue
    if len(cand) == 1:
        partner[i] = cand[0]
    else:                                    # co-located duplicates: nearest wins
        p = hco[i]
        partner[i] = min(cand, key=lambda j: float(((bco[j] - p) ** 2).sum()))
R["correspondence"]["partnered"] = int((partner >= 0).sum())

# ------------------------------------------------ 5. cut the body's head off
bfk = face_uvkeys(body)
hfk = set(face_uvkeys(head))
del_faces = [i for i, k in enumerate(bfk) if k in hfk]
R["cut"] = {"headFaces": len(hfk), "bodyFacesMatched": len(del_faces),
            "matchRate": round(len(del_faces) / max(1, len(hfk)), 4)}
if len(del_faces) < 0.9 * len(hfk):
    raise SystemExit("face counterpart match only %.3f — topology differs, stop"
                     % R["cut"]["matchRate"])
bm = bmesh.new()
bm.from_mesh(body.data)
bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.faces[i] for i in del_faces], context="FACES")
bm.to_mesh(body.data)
bm.free()
body.data.update()
R["cut"]["bodyAfter"] = {"verts": len(body.data.vertices), "tris": len(body.data.polygons)}

# ------------------------------------------------------- 6. weld the rim
# The OPEN RIM is headcut's neck cut. Find it the way headcut.mjs did: on the
# POSITION-WELDED graph, so the glTF's UV-seam duplicates (4778 verts for 3994
# tris — bmesh calls nearly all of them "boundary") don't inflate it.
wid = np.unique(np.round(verts_co(head) * 1e5).astype(np.int64), axis=0,
                return_inverse=True)[1].reshape(-1)
edge_faces = {}
for p in head.data.polygons:
    vs = [wid[v] for v in p.vertices]
    for k in range(len(vs)):
        a, b = vs[k], vs[(k + 1) % len(vs)]
        edge_faces[(a, b) if a < b else (b, a)] = edge_faces.get(
            (a, b) if a < b else (b, a), 0) + 1
rim_wids = {w for e, n in edge_faces.items() if n == 1 for w in e}
rim = [i for i in range(len(wid)) if wid[i] in rim_wids]
moved, nweld, skipped = 0.0, 0, 0
for i in rim:
    j = partner[i]
    if j < 0:
        continue
    p = Vector(bco[j])
    d = (head.data.vertices[i].co - p).length
    if d > 0.004:                # >4 mm means a bad partner, not a seam gap
        skipped += 1
        continue
    moved = max(moved, d)
    head.data.vertices[i].co = p
    nweld += 1
head.data.update()
hco = verts_co(head)
rimz = hco[rim][:, 2] if len(rim) else np.zeros(1)
R["rim"] = {"weldedGraphVerts": int(wid.max() + 1), "boundaryEdges":
            int(sum(1 for n in edge_faces.values() if n == 1)),
            "rimVerts": len(rim), "welded": nweld, "skippedFarPartner": skipped,
            "maxWeld_mm": round(1000 * moved, 3),
            "rimWorldZ": [round(float(rimz.min()), 4), round(float(rimz.max()), 4)],
            "headWorldZ": [round(float(hco[:, 2].min()), 4),
                           round(float(hco[:, 2].max()), 4)]}

# --------------------------------------- 7. bind: rigid Head + inherited neck
for vg in list(head.vertex_groups):
    head.vertex_groups.remove(vg)
groups = {n: head.vertex_groups.new(name=n) for n in gname}
rigid = blended = orphan = 0
for i in range(len(hco)):
    j = partner[i]
    w = dict(bweights[j]) if j >= 0 else {}
    tot = sum(w.values())
    if tot > 0:
        w = {k: v / tot for k, v in w.items()}
    if w.get(HEAD_BONE, 0.0) >= RIGID_T or not w:
        groups[HEAD_BONE].add([i], 1.0, "REPLACE")
        rigid += 1
        if not w:
            orphan += 1
    else:
        for k, v in w.items():
            groups[k].add([i], v, "REPLACE")
        blended += 1
R["bind"] = {"rigidHead1_0": rigid, "inheritedBlend": blended,
             "noPartnerForcedRigid": orphan, "rigidThreshold": RIGID_T}

# ------------------------------------------- 7b. seam: rim vs the body's hole
# Every rim vertex must land on a surviving body vertex AND inherit that
# vertex's weights, else the join can open when the neck bends.
bcut = verts_co(body)
bw2 = {}
for v in body.data.vertices:
    bw2[v.index] = {gname[g.group]: g.weight for g in v.groups if g.weight > 0}
btree = {}
for i in range(len(bcut)):
    btree.setdefault(tuple(np.round(bcut[i] * 1e5).astype(np.int64)), []).append(i)
hnames = [g.name for g in head.vertex_groups]
onbody, wsame, gapmax, wdevmax = 0, 0, 0.0, 0.0
for i in rim:
    hit = btree.get(tuple(np.round(hco[i] * 1e5).astype(np.int64)))
    if not hit:
        gapmax = max(gapmax, float(np.linalg.norm(bcut - hco[i], axis=1).min()))
        continue
    onbody += 1
    mine = {hnames[g.group]: g.weight
            for g in head.data.vertices[i].groups if g.weight > 0}
    theirs = bw2.get(hit[0], {})
    dev = max([abs(mine.get(k, 0) - theirs.get(k, 0))
               for k in set(mine) | set(theirs)] or [0.0])
    wdevmax = max(wdevmax, dev)
    if dev < 1e-5:
        wsame += 1
R["seam"] = {"rimVerts": len(rim), "rimVertsCoincidentWithBody": onbody,
             "rimWeightsIdenticalToBody": wsame,
             "maxWeightDeviationAtRim": round(float(wdevmax), 6),
             "maxResidualGap_mm": round(1000 * gapmax, 3)}

head.name = "goodface_head"
head.data.name = "goodface_head"
head.parent = arm
head.matrix_parent_inverse = arm.matrix_world.inverted()
mod = head.modifiers.new(name="Armature", type="ARMATURE")
mod.object = arm
mod.use_vertex_groups = True

# ------------------------------------------------------------- 8. export GLB
os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
os.makedirs(os.path.dirname(REPORT), exist_ok=True)
# deselect EVERYTHING in every scene (view_layer= keeps this legal for objects
# outside the active view layer — a stray selected factory Cube in another
# scene otherwise rides along into the export)
for s in bpy.data.scenes:
    for o in s.objects:
        try:
            o.select_set(False, view_layer=s.view_layers[0])
        except (RuntimeError, TypeError):
            pass
export_objs = [arm, body, head] + roots
for o in export_objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = arm
props = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
kw = {"filepath": OUT_GLB}
want = {"export_format": "GLB", "use_selection": True, "export_animations": True,
        "export_skins": True, "export_apply": False, "export_yup": True,
        "export_animation_mode": "ACTIONS", "export_frame_range": False,
        "export_optimize_animation_size": False, "export_image_format": "AUTO",
        "export_normals": True, "export_all_influences": False,
        "export_def_bones": False, "export_morph": False,
        "export_bake_animation": False, "export_reset_pose_bones": False}
for k, v in want.items():
    if k in props:
        kw[k] = v
R["exportArgs"] = {k: v for k, v in kw.items() if k != "filepath"}
bpy.ops.export_scene.gltf(**kw)
R["export"] = {"path": OUT_GLB, "bytes": os.path.getsize(OUT_GLB)}

with open(REPORT, "w") as fh:
    json.dump(R, fh, indent=2)
print(json.dumps(R, indent=2))
