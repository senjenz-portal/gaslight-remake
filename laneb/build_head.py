"""LANE B — build the stylized low-poly head (skull/jaw/nose/brow/ears/neck)
plus a separate faceted hair cap.  Pure data API, no ops, LaneB_Head only.
Run:  exec(open(lb_lib).read()); exec(open(this).read()); print(build_all())
"""
import math

P = {}
exec(open("/Users/samz/Documents/gaslight-remake/tools/laneb/head_params.py").read(), P)


def lerp_table(tbl, z):
    """piecewise-linear lookup, clamped to 0 outside the table range."""
    if z <= tbl[0][0] or z >= tbl[-1][0]:
        return 0.0
    for i in range(len(tbl) - 1):
        z0, v0 = tbl[i]
        z1, v1 = tbl[i + 1]
        if z0 <= z <= z1:
            t = (z - z0) / (z1 - z0)
            return v0 + (v1 - v0) * t
    return 0.0


def ring_at(z):
    """interpolate the (w, f, b) ring table at arbitrary z (clamped)."""
    R = P['RINGS']
    if z <= R[0][0]:
        return R[0][1:]
    if z >= R[-1][0]:
        return R[-1][1:]
    for i in range(len(R) - 1):
        if R[i][0] <= z <= R[i + 1][0]:
            t = (z - R[i][0]) / (R[i + 1][0] - R[i][0])
            return tuple(R[i][1 + k] + (R[i + 1][1 + k] - R[i][1 + k]) * t
                         for k in range(3))
    return R[-1][1:]


def col_weight(tblw, j):
    """per-column weight, mirrored about the front-centre column."""
    jj = j if j <= P['NC'] // 2 else P['NC'] - j
    return tblw.get(jj, 0.0)


def surface_point(j, z, w=None, f=None, b=None):
    """skull surface point for column j at height z, incl. feature deltas."""
    ang = math.radians(P['ANGLES'][j])
    if w is None:
        w, f, b = ring_at(z)
    c, s = math.cos(ang), math.sin(ang)
    ex, ey = (P['E_X_F'], P['E_Y_F']) if s >= 0 else (P['E_X_B'], P['E_Y_B'])
    x = w * math.copysign(abs(c) ** ex, c)
    y = (f if s >= 0 else b) * (abs(s) ** ey)
    # forward feature deltas (front hemisphere only)
    if s > 0.0:
        dy = (lerp_table(P['NOSE'], z) * col_weight(P['NOSE_W'], j)
              + lerp_table(P['BROW'], z) * col_weight(P['BROW_W'], j)
              + lerp_table(P['SOCKET'], z) * col_weight(P['SOCKET_W'], j)
              + lerp_table(P['CHEEK'], z) * col_weight(P['CHEEK_W'], j)
              + lerp_table(P['MOUTH'], z) * col_weight(P['MOUTH_W'], j)
              + lerp_table(P['CHINPT'], z) * col_weight(P['CHINPT_W'], j))
        dy *= max(0.0, min(1.0, s * 3.0))   # fade features toward the sides
        y += dy
    return (x, y, z)


def build_head_shell():
    NC = P['NC']
    verts, faces = [], []
    for (z, w, f, b) in P['RINGS']:
        for j in range(NC):
            verts.append(surface_point(j, z, w, f, b))
    nr = len(P['RINGS'])
    for i in range(nr - 1):
        for j in range(NC):
            j2 = (j + 1) % NC
            a = i * NC + j
            bb = i * NC + j2
            c = (i + 1) * NC + j2
            d = (i + 1) * NC + j
            faces.append((a, bb, c, d))
    # crown apex fan
    ai = len(verts)
    verts.append(P['APEX'])
    top = (nr - 1) * NC
    for j in range(NC):
        faces.append((top + j, top + (j + 1) % NC, ai))
    # neck bottom cap (n-gon)
    faces.append(tuple(range(NC - 1, -1, -1)))
    return verts, faces


def build_ears(vbase):
    E = P['EAR']
    verts, faces = [], []
    n = len(E['outline'])
    for sx in (1.0, -1.0):
        base = vbase + len(verts)
        for (x, sc_, yo) in ((E['x_in'], 1.0, 0.0),
                             (E['x_out'], E['out_scale'], E['y_out'])):
            for (dy, dz) in E['outline']:
                verts.append((sx * x, E['cy'] + dy * sc_ + yo,
                              E['cz'] + dz * sc_))
        for k in range(n):
            k2 = (k + 1) % n
            faces.append((base + k, base + k2, base + n + k2, base + n + k))
        faces.append(tuple(base + k for k in range(n)))
        faces.append(tuple(base + n + k for k in range(n - 1, -1, -1)))
    return verts, faces


def build_hair():
    """faceted cap mass over the skull, lofted from the hairline to the crown."""
    NC, ROWS = P['NC'], P['HAIR_ROWS']
    HL, SH = P['HAIRLINE'], P['HAIR_SHELL']

    def hz(j):
        """hairline height for column j; fold the angle into [-90,90] so the
        left/right columns mirror while front(+)/back(-) stays distinct."""
        a = P['ANGLES'][j]
        key = 180 - a if a > 90 else (-180 - a if a < -90 else a)
        ks = sorted(HL.keys())
        if key <= ks[0]:
            return HL[ks[0]]
        if key >= ks[-1]:
            return HL[ks[-1]]
        for i in range(len(ks) - 1):
            if ks[i] <= key <= ks[i + 1]:
                t = (key - ks[i]) / (ks[i + 1] - ks[i])
                return HL[ks[i]] + (HL[ks[i + 1]] - HL[ks[i]]) * t
        return HL[ks[-1]]

    def shell(u):
        for i in range(len(SH) - 1):
            if SH[i][0] <= u <= SH[i + 1][0]:
                t = (u - SH[i][0]) / (SH[i + 1][0] - SH[i][0])
                return (SH[i][1] + (SH[i + 1][1] - SH[i][1]) * t,
                        SH[i][2] + (SH[i + 1][2] - SH[i][2]) * t)
        return SH[-1][1], SH[-1][2]

    verts, faces = [], []
    for r in range(ROWS + 1):
        u = r / ROWS
        off, lift = shell(u)
        for j in range(NC):
            zig = P['HAIR_ZIG'] * (1 if j % 2 else -1) * max(0.0, 1.0 - u * 2.2)
            z0 = hz(j) + zig
            z = z0 + u * (0.985 - z0)
            x, y, zz = surface_point(j, z)
            w, f, b = ring_at(z)
            yc = (f + b) * 0.5
            nx, ny = x, y - yc
            L = math.hypot(nx, ny) or 1.0
            nx, ny = nx / L, ny / L
            # forward fringe mass over the forehead: peaks low, not on top
            ang = math.radians(P['ANGLES'][j])
            bump = lerp_table([(0.0, 0.45), (0.30, 1.0), (0.62, 0.5),
                               (1.0, 0.08)], u) if 0 < u < 1 else \
                (0.45 if u == 0 else 0.08)
            fr = max(0.0, math.sin(ang)) ** 2 * P['HAIR_FRINGE'] * bump
            # portrait: hair half-width .398 vs cheek .335, so the mass has to
            # overhang the skull at the sides or it reads as a swim cap
            side = P['HAIR_SIDE'] * (1.0 - abs(math.sin(ang))) * min(1.0, u * 3.0)
            o = off + side + P['HAIR_JIT'] * (1 if (j // 2) % 2 else -1) * (1 - u)
            verts.append((x + nx * o, y + ny * o + fr * 0.85,
                          zz + lift + fr * 0.35))
    for r in range(ROWS):
        for j in range(P['NC']):
            j2 = (j + 1) % P['NC']
            a = r * P['NC'] + j
            bb = r * P['NC'] + j2
            c = (r + 1) * P['NC'] + j2
            d = (r + 1) * P['NC'] + j
            faces.append((a, bb, c, d))
    # crown cap on the last row
    top = ROWS * P['NC']
    faces.append(tuple(top + j for j in range(P['NC'] - 1, -1, -1)))
    return verts, faces


def build_all():
    hv, hf = build_head_shell()
    head = fresh_mesh_obj("LB_Head", hv, hf)
    assign_mat(head, flat_mat("LB_Skin", hex2lin(P['SKIN_HEX'])))

    # ears live in their own object so they can take a darker flat tone: as
    # part of the head they picked up the front projection's pale skin patch
    # and read as bright tabs stuck on the side.
    ev, ef = build_ears(0)
    ears = fresh_mesh_obj("LB_Ears", ev, ef)
    assign_mat(ears, flat_mat("LB_Skin", hex2lin(P['SKIN_HEX'])))

    av, af = build_hair()
    hair = fresh_mesh_obj("LB_Hair", av, af)
    assign_mat(hair, flat_mat("LB_HairMat", hex2lin(P['HAIR_HEX']), rough=0.55))
    for m in list(hair.modifiers):
        hair.modifiers.remove(m)
    sol = hair.modifiers.new("Solid", 'SOLIDIFY')
    sol.thickness = P['HAIR_THICK']
    sol.offset = -1.0
    return report()
