"""LANE B step 3b — likeness by camera projection.

Every face gets UVs from the matched front camera, mapped through the exact
scale/offset that was verified by the portrait overlay, so the photo lands on
the model where it landed in the overlay check.  Faces the camera cannot see
(and anything below the chin, which would otherwise sample his shirt collar)
get a flat colour patch from the atlas instead.  Per-FACE decision on purpose:
the hard boundary falls on a facet edge, which is on-style.
"""
import json
from bpy_extras.object_utils import world_to_camera_view

META = json.load(open(OUT + "/atlas.json"))
PORT_CHIN = (219.0, 332.0)     # portrait px landmarks used for the fit
PORT_CROWN = (219.0, 66.0)
MDL_CHIN = (0.0, 0.122, 0.000)
MDL_CROWN = (0.0, -0.058, 1.000)
PROJ_RES = (700, 860)
FACE_MIN_DOT = -0.12           # below this the projection is too grazing
Z_MIN = -0.02                 # below the chin the photo is collar/shirt


def _fit():
    sc = scn()
    # world_to_camera_view normalises through scene.render aspect, so the
    # projection is only valid if the resolution matches the fit resolution
    sc.render.resolution_x, sc.render.resolution_y = PROJ_RES
    cam = place_cam(*VIEWS['front'])

    def pj(co):
        v = world_to_camera_view(sc, cam, Vector(co))
        return (v.x * PROJ_RES[0], (1.0 - v.y) * PROJ_RES[1])

    chin, crown = pj(MDL_CHIN), pj(MDL_CROWN)
    s = (PORT_CHIN[1] - PORT_CROWN[1]) / (chin[1] - crown[1])
    dx = PORT_CHIN[0] - chin[0] * s
    dy = PORT_CHIN[1] - chin[1] * s
    return cam, pj, s, dx, dy


def _atlas_uv(px, py):
    """portrait px -> atlas uv"""
    PW, PH = META['portrait']
    RW, RH = META['region']
    A = META['atlas']
    return (px * (RW / PW) / A, 1.0 - py * (RH / PH) / A)


def atlas_material():
    m = bpy.data.materials.get("LB_Atlas") or bpy.data.materials.new("LB_Atlas")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    tex = nt.nodes.new('ShaderNodeTexImage')
    path = OUT + "/king2-head-atlas.png"
    img = bpy.data.images.get("king2-head-atlas.png")
    if img is None:
        img = bpy.data.images.load(path)
    tex.image = img
    tex.interpolation = 'Smart'
    bsdf.inputs['Roughness'].default_value = 0.78
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.10
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    tex.location = (-380, 0)
    bsdf.location = (-60, 0)
    out.location = (240, 0)
    return m


def project_object(ob, fallback='skin', project=True):
    cam, pj, s, dx, dy = _fit()
    cam_loc = cam.matrix_world.translation
    me = ob.data
    uvl = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    fb = META['patch'][fallback]
    hit = 0
    for poly in me.polygons:
        c = poly.center
        facing = poly.normal.normalized().dot((cam_loc - c).normalized())
        use = project and facing > FACE_MIN_DOT and c.z > Z_MIN
        if use:
            hit += 1
        for li in poly.loop_indices:
            if use:
                co = me.vertices[me.loops[li].vertex_index].co
                px, py = pj(co)
                uvl.data[li].uv = _atlas_uv(px * s + dx, py * s + dy)
            else:
                uvl.data[li].uv = fb
    assign_mat(ob, atlas_material())
    return hit, len(me.polygons)


def apply_projection():
    lines = []
    # the hair is NOT projected: its front strip dips below the photo hairline
    # and would sample forehead skin as a pale band across the fringe.  A flat
    # mass shaded only by the lights is also closer to the cameo target.
    for name, fb, proj in (("LB_Head", 'skin', True), ("LB_Hair", 'hair', False),
                           ("LB_Ears", 'ear', False)):
        ob = bpy.data.objects.get(name)
        if ob is None:
            continue
        hit, tot = project_object(ob, fb, proj)
        lines.append("  %-8s projected %d/%d faces (fallback=%s)"
                     % (name, hit, tot, fb))
    return "\n".join(lines)
