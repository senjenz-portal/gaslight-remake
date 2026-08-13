#!/usr/bin/env python3
"""chase_geom.py -- the hand-authored geometry of the chase plate.

Same discipline as tools/lanea/holmes_geom.py: the numbers live in one file,
they are MEASURED off the plate (not chosen), and every consumer imports them
instead of re-eyeballing the picture.

PLATE: assets/plates/book/chase/chase-master.png, 1408 x 768.

HOW THE TWO ROAD POLYLINES WERE GOT. For each column a 7-tap vertical
derivative of the 5-column-averaged luma was taken and the strongest DOWN step
found -- the pavement is pale stone and the cobbles are darker, so the kerb is a
negative step; the roadway is lit and the hull below it is near-black, so the
outer edge is a second, larger negative step. KERB was scanned over the whole
strip; OUTER was scanned only BELOW the already-fitted kerb, so the two lines
cannot collide. Both were then smoothed by hand across the three reads that the
fog makes unreliable (x > 1200) and verified by overlay.

THE RECESSION IS PAINTED, NOT PROJECTED -- this is the single most important
fact about this plate and the grammar lane must not assume otherwise. The kerb
line falls a steady 21 px per 100 px of x from x=700 to x=1000 and then flattens
to 2 px per 100 px by x=1200: a true linear perspective would have continued
straight to y=320 at x=1250 where the plate paints y=348. So the rail is a
SAMPLED POLYLINE, never a straight line, and the scale ramp is measured from the
road's own width rather than derived from a camera.

LAMP 2 STANDS IN THE ROAD. Its plinth is at y=480 where the kerb at that column
is y=427 -- 53 px NEARER than the pavement it should be standing on. Lamps 1, 3
and 4 sit on the pavement as painted. That is a painting inconsistency and it is
turned into an asset: lamp 2 is cut as a FOREGROUND occluder so the pursuit
passes behind it, which is the only occlusion event on the strip and the cheapest
depth cue the beat has.
"""

PLATE = (1408, 768)
MASTER = '/Users/samz/Documents/gaslight-remake/assets/plates/book/chase/chase-master.png'

# ---- the two along-road lines, near end (left) to far tip (right) ----------
KERB = [(300, 527), (330, 520), (400, 503), (500, 481), (600, 459), (700, 436),
        (800, 415), (900, 394), (1000, 373), (1060, 362), (1100, 356),
        (1140, 353), (1200, 350), (1265, 348)]

OUTER = [(420, 588), (460, 580), (500, 568), (580, 555), (660, 532), (700, 522),
         (740, 505), (820, 484), (900, 465), (980, 443), (1060, 420),
         (1100, 410), (1140, 399), (1180, 388), (1220, 376), (1265, 366)]

# the near end of the strip is a CUT FACE across the road, not a road edge
NEAR_CUT = [(300, 527), (420, 588)]

# ---- emissive sources ------------------------------------------------------
# (x, y, radius) of each gas lamp's lantern, and of the lit doorway.
LAMPS = [(307, 327, 150), (749, 288, 132), (968, 271, 104), (1140, 241, 92)]
DOOR = (663, 356, 118)          # Briony Lodge: fanlight at y=305, threshold y=415
DOOR_BOX = (628, 288, 706, 440)  # x0,y0,x1,y1 of the doorway + its steps
# the door-out patch has to take the light SPILL with it, so it is wider than
# the doorway: it reaches the pavement flags the doorway throws light onto.
DOOR_OUT_BOX = (596, 278, 764, 472)
# three doors on this same terrace that the plate paints UNLIT -- the target
# tone for putting Briony Lodge's own light out is measured off them.
UNLIT_DOOR_SAMPLES = [(352, 296, 424, 436), (510, 292, 580, 432),
                      (196, 300, 250, 470)]

# lamp 2 as a foreground occluder: post, lantern and plinth
LAMP2_BOX = (727, 262, 776, 492)

# ---- the fog bank ----------------------------------------------------------
# a soft veil over the far end; it must stay INSIDE the diorama envelope, so it
# is clipped to the union of the terrace and road bands, never to the void.
FOG_X0, FOG_X1 = 880, 1310      # ramp-in and full
FOG_TOP, FOG_BOT = 60, 470


def interp(poly, x):
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    if x <= xs[0]:
        return float(ys[0])
    if x >= xs[-1]:
        return float(ys[-1])
    for i in range(1, len(xs)):
        if x <= xs[i]:
            t = (x - xs[i - 1]) / (xs[i] - xs[i - 1])
            return ys[i - 1] + t * (ys[i] - ys[i - 1])
    return float(ys[-1])


def kerb_y(x):
    return interp(KERB, x)


def outer_y(x):
    return interp(OUTER, x)


def band(x):
    """road width in px at column x -- the plate's own scale measure"""
    return outer_y(x) - kerb_y(x)


# ---- THE RAIL --------------------------------------------------------------
# The driving lane. LANE_T is where the rig's wheels sit across the road band:
# 0 = against the kerb, 1 = at the outer edge. 0.52 puts the lane just off the
# kerb, which is where the reference drives it (LANE_Z = 1.35 in a roadway
# spanning z -2.0..4.2, i.e. t = 0.54), and it keeps every rig's contact point
# BELOW lamps 1/3/4's plinths so only lamp 2 ever occludes.
LANE_T = 0.52
RAIL_X0, RAIL_X1 = 420, 1258     # the usable strip: past the near cut, short of
                                 # the far tip where the band is under 20 px


def rail(u):
    """u in 0..1 along the strip -> (x, y, scale) in plate pixels.
    y is the rig's GROUND CONTACT point. scale is 1.0 at the near end."""
    x = RAIL_X0 + (RAIL_X1 - RAIL_X0) * u
    y = kerb_y(x) + LANE_T * band(x)
    return x, y, band(x) / band(RAIL_X0)


def rail_at_x(x):
    return kerb_y(x) + LANE_T * band(x)
