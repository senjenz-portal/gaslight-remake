"""LANE B headless driver.

  Blender --background --factory-startup --python lb_headless.py -- <stage> [args]

Rendering inside the SHARED gui Blender segfaults it (a sibling lane's timer
callback mutates data mid-depsgraph-eval during the render), so every
build/render/export iteration happens in a throwaway background process.
Stages: build | shot <prefix> <views..> | tex | export
"""
import bpy, sys, os, time, math
from mathutils import Vector, Matrix

L = "/Users/samz/Documents/gaslight-remake/tools/laneb/"
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
stage = argv[0] if argv else "build"
rest = argv[1:]

# rename the factory scene so lane-B code paths find it, and empty it
sc0 = bpy.data.scenes[0]
sc0.name = "LaneB_Head"
for ob in list(sc0.objects):
    bpy.data.objects.remove(ob, do_unlink=True)

exec(open(L + "lb_lib.py").read())
exec(open(L + "build_head.py").read())
t0 = time.time()
print("[laneb]", build_all())

if stage in ("texshot", "export"):
    exec(open(L + "texture_head.py").read())
    print("[laneb]", apply_projection())

if stage in ("shot", "texshot"):
    prefix = rest[0] if rest else "shot"
    views = rest[1:] or ['front', '3q', 'profile']
    res = (700, 860)
    for p in render_set(prefix, views=views, res=res):
        print("[laneb] WROTE", p)
    print("[laneb] WROTE", dump_landmarks(OUT + "/%s-marks.json" % prefix, res=res))

if stage in ("tripo", "glbshot"):
    # honest comparison: same camera, same lights, same framing, normalised to
    # the same bbox height as the lane-B head.
    def bbox(obs):
        lo = [1e9] * 3
        hi = [-1e9] * 3
        for ob in obs:
            for c in ob.bound_box:
                w = ob.matrix_world @ Vector(c)
                for i in range(3):
                    lo[i] = min(lo[i], w[i])
                    hi[i] = max(hi[i], w[i])
        return Vector(lo), Vector(hi)

    mine = [o for o in scn().objects if o.type == 'MESH']
    mlo, mhi = bbox(mine)
    for o in mine:
        bpy.data.objects.remove(o, do_unlink=True)
    src = rest[0] if rest else "/Users/samz/Documents/gaslight-remake/assets/plates/king-v2/king2-head.glb"
    ov = dict(scene=scn(), view_layer=scn().view_layers[0])
    with bpy.context.temp_override(**ov):
        bpy.ops.import_scene.gltf(filepath=src)
    imported = [o for o in scn().objects if o.type == 'MESH']
    print("[laneb] tripo objects:", [o.name for o in imported])
    tlo, thi = bbox(imported)
    print("[laneb] tripo bbox", list(tlo), list(thi))
    s = (mhi.z - mlo.z) / max(1e-6, (thi.z - tlo.z))
    roots = [o for o in imported if o.parent is None]
    for o in roots:
        o.matrix_world = (Matrix.Translation((mlo + mhi) / 2.0)
                          @ Matrix.Scale(s, 4)
                          @ Matrix.Translation(-(tlo + thi) / 2.0)
                          @ o.matrix_world)
    # the tripo head comes out of the body cut facing +x, so it needs a yaw to
    # sit in the same frame as the lane-B head
    yaw = float(rest[1]) if len(rest) > 1 else 0.0
    if yaw:
        c = (mlo + mhi) / 2.0
        for o in roots:
            o.matrix_world = (Matrix.Translation(c)
                              @ Matrix.Rotation(math.radians(yaw), 4, 'Z')
                              @ Matrix.Translation(-c) @ o.matrix_world)
    pre = rest[2] if len(rest) > 2 else "tripo"
    vws = tuple(rest[3:]) or ('front', '3q', 'profile')
    for p in render_set(pre, views=vws, res=(760, 940)):
        print("[laneb] WROTE", p)

if stage == "export":
    out = rest[0] if rest else (OUT + "/king2-head-blender.glb")
    for ob in scn().objects:
        if ob.type == 'MESH':
            ob.select_set(True)
    ov = dict(scene=scn(), view_layer=scn().view_layers[0])
    with bpy.context.temp_override(**ov):
        bpy.ops.export_scene.gltf(
            filepath=out, export_format='GLB', use_active_scene=True,
            use_selection=False, export_apply=True, export_yup=True,
            export_normals=True, export_texcoords=True,
            export_materials='EXPORT', export_cameras=False,
            export_lights=False, export_image_format='AUTO')
    print("[laneb] WROTE", out, os.path.getsize(out), "bytes")

print("[laneb] stage=%s done in %.1fs" % (stage, time.time() - t0))
