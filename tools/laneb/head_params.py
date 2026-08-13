"""LANE B head parameters — measured off /Users/samz/Downloads/junze.png.

Portrait measurements (px, 436x446 image), chin y=332, skull top under hair
y=66  ->  H = 266 px = 1.0 blender unit.  z = (332 - y_px) / 266.
  mouth 268 -> .241 | nose base 248 -> .316 | nose tip 240 -> .346
  eye line 190 -> .534 | brow 170 -> .609 | hairline 132 -> .752
  cheek skin width 178px -> half .335 | jaw width 150px -> half .282
  head+hair width 212px -> half .398 | ear span y195..255 -> z .29...51
"""

# 20 columns, CCW from front-centre; symmetric so col j mirrors col (20-j)
ANGLES = [90, 78, 60, 40, 20, 0, -20, -40, -60, -78,
          -90, -102, -120, -140, -160, 180, 160, 140, 120, 102]
NC = len(ANGLES)

# superellipse exponents, x and y decoupled: a boxy-wide x keeps the full
# cheeks, a >1 y makes the surface recede properly toward the temples
# instead of leaving the whole face front as one flat slab.
E_X_F, E_Y_F = 0.74, 1.40     # front hemisphere
E_X_B, E_Y_B = 0.86, 0.95     # occiput, rounder

# z, half-width, front y, back y
RINGS = [
    (-0.310, 0.238, -0.020, -0.312),   # neck bottom (short thick stub)
    (-0.190, 0.240, -0.028, -0.320),
    (-0.090, 0.238, -0.040, -0.328),   # neck top, recedes under the jaw
    (0.000,  0.170,  0.122, -0.368),   # chin/jaw bottom rim, tucked + narrow
    (0.040,  0.215,  0.176, -0.382),   # chin
    (0.115,  0.252,  0.188, -0.396),   # jaw corner
    (0.200,  0.272,  0.196, -0.406),   # lower lip
    (0.280,  0.296,  0.196, -0.415),   # upper lip
    (0.330,  0.310,  0.200, -0.420),   # nose base
    (0.365,  0.317,  0.202, -0.422),   # nose tip level
    (0.420,  0.326,  0.205, -0.424),   # cheek
    (0.475,  0.333,  0.205, -0.425),
    (0.530,  0.335,  0.203, -0.425),   # eye line, widest
    (0.610,  0.328,  0.206, -0.423),   # brow
    (0.700,  0.320,  0.200, -0.414),   # forehead
    (0.780,  0.306,  0.182, -0.398),   # hairline
    (0.870,  0.288,  0.142, -0.352),
    (0.940,  0.236,  0.098, -0.274),
    (0.985,  0.144,  0.048, -0.162),
]
APEX = (0.0, -0.058, 1.000)

# nose ridge: z -> forward delta at col 0.  Peak at the tip, shallow nasion
# (low bridge) so the profile dips behind the brow instead of forming a beak.
NOSE = [(0.270, 0.000), (0.300, 0.022), (0.330, 0.072), (0.365, 0.090),
        (0.420, 0.056), (0.475, 0.030), (0.530, 0.010), (0.575, 0.002),
        (0.610, 0.000)]
NOSE_W = {0: 1.0, 1: 0.42, 2: 0.12}          # per-column falloff (mirrored)

# brow shelf: z -> delta, applied to cols 0..3
BROW = [(0.560, 0.000), (0.610, 0.014), (0.665, 0.004), (0.700, 0.000)]
BROW_W = {0: 0.5, 1: 0.8, 2: 1.0, 3: 0.85}

# eye socket recess — shallow; the projected texture carries the eyes
SOCKET = [(0.460, 0.000), (0.510, -0.006), (0.540, -0.009), (0.585, -0.004),
          (0.615, 0.000)]
SOCKET_W = {1: 0.20, 2: 1.0, 3: 0.55, 4: 0.12}

# full round cheeks
CHEEK = [(0.230, 0.000), (0.330, 0.014), (0.420, 0.018), (0.500, 0.007),
         (0.545, 0.000)]
CHEEK_W = {2: 0.6, 3: 1.0, 4: 0.7}

# mouth block: lips forward, mento-labial crease under, chin point
MOUTH = [(0.140, 0.000), (0.175, -0.004), (0.225, 0.005), (0.265, 0.007),
         (0.300, 0.000)]
MOUTH_W = {0: 1.0, 1: 0.75, 2: 0.25}
CHINPT = [(0.015, 0.000), (0.055, 0.016), (0.110, 0.011), (0.155, 0.000)]
CHINPT_W = {0: 1.0, 1: 0.7, 2: 0.2}

EAR = dict(
    cz=0.400, cy=-0.052, x_in=0.286, x_out=0.392, y_out=-0.014,
    # (y, z) outline offsets from centre, CCW; top tips back
    outline=[(0.064, 0.086), (0.015, 0.123), (-0.053, 0.110), (-0.086, 0.029),
             (-0.073, -0.057), (-0.018, -0.117), (0.046, -0.068)],
    out_scale=1.12,
)

# hair: bottom boundary z per column angle (interpolated by angle)
HAIRLINE = {90: 0.736, 78: 0.726, 60: 0.690, 40: 0.622, 20: 0.585, 0: 0.545,
            -20: 0.505, -40: 0.470, -60: 0.450, -78: 0.440, -90: 0.436}
# u -> (outward offset, extra z lift)
HAIR_SHELL = [(0.00, 0.010, 0.000), (0.28, 0.030, 0.004), (0.55, 0.042, 0.012),
              (0.80, 0.046, 0.022), (1.00, 0.038, 0.034)]
HAIR_ROWS = 4
HAIR_FRINGE = 0.034   # forward mass over the forehead (peaks low, not on top)
HAIR_SIDE = 0.030     # extra overhang at the temples (measured .398 vs .368)
HAIR_ZIG = 0.016      # angular clumping on the boundary, not a clean brim
HAIR_JIT = 0.007      # radial clumping, decays toward the crown
HAIR_THICK = 0.016

SKIN_HEX = "d8a883"
HAIR_HEX = "15141a"
