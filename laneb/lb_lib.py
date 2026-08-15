"""LANE B shared helpers — exec'd at the top of every lane-B blender command.

Rules: only ever touch scene LaneB_Head; never change bpy.context.window.scene
(lane A owns the window). All ops go through temp_override.
"""
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

LB_SCENE = "LaneB_Head"
OUT = "/Users/samz/Documents/gaslight-remake/assets/plates/king-v2/laneb"
os.makedirs(OUT, exist_ok=True)


def scn():
    sc = bpy.data.scenes.get(LB_SCENE)
    if sc is None:
        sc = bpy.data.scenes.new(LB_SCENE)
    # Cycles/CPU on purpose: an EEVEE render fired from the addon's timer
    # callback segfaults Blender 5.2 on macOS/Metal (killed the session once).
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 4
    sc.cycles.samples = 24
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    return sc


def link(ob):
    sc = scn()
    if ob.name not in sc.collection.objects:
        sc.collection.objects.link(ob)
    # make sure it is not also in other lanes' scenes
    for s in bpy.data.scenes:
        if s is not sc and ob.name in s.collection.objects:
            s.collection.objects.unlink(ob)
    return ob


def fresh_mesh_obj(name, verts, faces):
    """Replace-or-create a mesh object in the lane B scene."""
    me = bpy.data.meshes.new(name + "_mesh")
    me.from_pydata(verts, [], faces)
    me.validate(verbose=False)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.shade_flat()
    ob = bpy.data.objects.get(name)
    if ob is not None and ob.type == 'MESH':
        old = ob.data
        ob.data = me
        if old.users == 0:
            bpy.data.meshes.remove(old)
    else:
        ob = bpy.data.objects.new(name, me)
    link(ob)
    return ob


def flat_mat(name, rgb, rough=0.62):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    if bsdf is None:
        for n in nt.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                bsdf = n
    bsdf.inputs['Base Color'].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.28
    return m


def assign_mat(ob, mat, slot=0):
    while len(ob.data.materials) <= slot:
        ob.data.materials.append(None)
    ob.data.materials[slot] = mat
    return mat


def srgb2lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex2lin(h):
    h = h.lstrip('#')
    return tuple(srgb2lin(int(h[i:i + 2], 16)) for i in (0, 2, 4))


def look_at(ob, target):
    """point -Z at target by writing matrix_world directly: assigning
    location/rotation_euler leaves matrix_world stale until a depsgraph
    update, which silently broke the landmark projection once."""
    loc = ob.location.copy()
    q = (Vector(target) - loc).to_track_quat('-Z', 'Y')
    ob.matrix_world = Matrix.Translation(loc) @ q.to_matrix().to_4x4()


BG_HEX = "1b2740"   # cameo plate navy


def ensure_stage(dist=3.05, lens=52.0, target=(0, 0, 0.52), key_energy=4.2):
    """Camera + 3-light rig + world, all inside LaneB_Head."""
    sc = scn()
    cam = bpy.data.objects.get("LB_Cam")
    if cam is None:
        cd = bpy.data.cameras.new("LB_CamData")
        cam = bpy.data.objects.new("LB_Cam", cd)
    cam.data.lens = lens
    cam.data.sensor_width = 36
    link(cam)
    sc.camera = cam

    w = bpy.data.worlds.get("LB_World") or bpy.data.worlds.new("LB_World")
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    r, g, b = hex2lin(BG_HEX)
    bg.inputs['Color'].default_value = (r, g, b, 1)
    bg.inputs['Strength'].default_value = 1.0
    sc.world = w

    def lamp(name, kind, loc, energy, size=3.0, color=(1, 1, 1)):
        ob = bpy.data.objects.get(name)
        if ob is None:
            ld = bpy.data.lights.new(name + "_d", type=kind)
            ob = bpy.data.objects.new(name, ld)
        ob.data.type = kind
        ob.data.energy = energy
        ob.data.color = color
        if kind == 'AREA':
            ob.data.size = size
        ob.location = loc
        link(ob)
        look_at(ob, target)
        return ob

    # soft frontal key from camera-left/high, cool fill right, warm rim behind
    lamp("LB_Key", 'AREA', (-2.1, 2.4, 2.4), 34 * key_energy, size=3.4, color=(1.0, 0.96, 0.9))
    lamp("LB_Fill", 'AREA', (2.6, 1.7, 0.7), 26, size=3.0, color=(0.78, 0.86, 1.0))
    lamp("LB_Rim", 'AREA', (1.3, -2.6, 2.2), 40, size=2.0, color=(1.0, 0.85, 0.72))
    return cam


VIEWS = {
    'front':   (0.0, 4.0),
    '3q':      (36.0, 6.0),
    'profile': (90.0, 2.0),
    'back3q':  (150.0, 8.0),
}


def place_cam(az_deg, el_deg, dist=3.05, target=(0, 0, 0.52)):
    cam = ensure_stage(dist=dist, target=target)
    az, el = math.radians(az_deg), math.radians(el_deg)
    t = Vector(target)
    cam.location = t + Vector((math.cos(el) * math.sin(az),
                               math.cos(el) * math.cos(az),
                               math.sin(el))) * dist
    look_at(cam, target)
    return cam


def render(path, res=(900, 1100), samples=24, az=0.0, el=4.0, dist=3.05,
           target=(0, 0, 0.52)):
    sc = scn()
    place_cam(az, el, dist=dist, target=target)
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = path
    sc.render.film_transparent = False
    sc.cycles.samples = samples
    ov = dict(scene=sc, view_layer=sc.view_layers[0])
    if bpy.context.window is not None:          # GUI session
        ov['window'] = bpy.context.window
    with bpy.context.temp_override(**ov):
        bpy.ops.render.render(write_still=True)
    return path


def dump_landmarks(path, res=(900, 1100)):
    """project key model points into front-view pixel coords -> json, so the
    render can be scaled onto the portrait for an objective proportion check."""
    import json
    from bpy_extras.object_utils import world_to_camera_view
    sc = scn()
    sc.render.resolution_x, sc.render.resolution_y = res   # aspect matters
    cam = place_cam(*VIEWS['front'])
    pts = {'chin': (0, 0.122, 0.0), 'crown': (0, -0.06, 1.0),
           'nose_tip': (0, 0.29, 0.365), 'brow': (0, 0.22, 0.61),
           'eye_l': (0.115, 0.20, 0.534), 'eye_r': (-0.115, 0.20, 0.534),
           'cheek_l': (0.335, 0.0, 0.53), 'cheek_r': (-0.335, 0.0, 0.53),
           'jaw_l': (0.258, 0.0, 0.12), 'jaw_r': (-0.258, 0.0, 0.12),
           'hairline': (0, 0.176, 0.78), 'nose_base': (0, 0.27, 0.33),
           'mouth': (0, 0.21, 0.241)}
    out = {}
    for k, co in pts.items():
        v = world_to_camera_view(sc, cam, Vector(co))
        out[k] = [v.x * res[0], (1.0 - v.y) * res[1]]
    json.dump(out, open(path, 'w'), indent=1)
    return path


def render_set(prefix, views=('front', '3q', 'profile'), **kw):
    out = []
    for v in views:
        az, el = VIEWS[v]
        p = os.path.join(OUT, "%s-%s.png" % (prefix, v))
        render(p, az=az, el=el, **kw)
        out.append(p)
    return out


def tris(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)


def report():
    sc = scn()
    tot = 0
    lines = []
    for ob in sc.objects:
        if ob.type == 'MESH':
            n = tris(ob)
            tot += n
            lines.append("  %-16s tris=%-6d verts=%d" % (ob.name, n, len(ob.data.vertices)))
    lines.append("  TOTAL tris=%d" % tot)
    return "\n".join(lines)
