#!/usr/bin/env python3
"""holmes_geom.py -- the hand-authored geometry of the standing figure.

One place for the numbers so the cut, the inpaint and the puppet all agree.
All coordinates are PLATE pixels (backdrop.png, 1408 x 768).

The room depth layer that actually ships is cropped out of the plate at
ROOM_ORIGIN, so plate->room is a plain translation.
"""

PLATE = (1408, 768)
ROOM_ORIGIN = (306, 36)          # layers.json: room.png x,y
ROOM_SIZE = (798, 712)

# generous hand polygon around Holmes -- the OUTER bound of the cut. The
# precise alpha comes later, from |plate - inpaint| inside this polygon.
HOLMES_POLY = [
    (588, 284), (604, 283), (615, 289), (620, 302), (623, 316), (630, 328),
    (641, 338), (650, 357), (652, 379), (646, 393), (639, 404),
    (638, 432), (635, 460), (632, 480),
    (630, 492), (633, 505), (634, 516), (626, 523), (612, 523),
    (601, 520), (588, 523), (572, 522), (571, 508), (577, 496),
    (581, 484), (576, 476),
    (565, 468), (556, 450), (554, 418), (556, 394),
    (558, 370), (560, 348), (561, 332),
    (566, 322), (572, 312), (578, 300), (582, 289),
]

# padded context box handed to the image model for the inpaint
CROP = (486, 232, 742, 584)       # x0, y0, x1, y1  -> 256 x 352

# The puppet's five parts. These are CLAIMS, resolved in this order into a
# strict partition of the matte -- a pixel belongs to exactly one part, so
# nothing is drawn twice and nothing tears open when two parts rotate apart.
# 'poly' claims a region outright; 'band' claims whatever is left in a y range.
PARTS = [
    # head + hair + face + collar; hinges at the base of the neck
    ('head',  dict(poly=[(574, 282), (600, 279), (618, 285), (627, 303),
                         (625, 321), (617, 337), (600, 344), (587, 337),
                         (579, 322), (571, 301)],
                   pivot=(601, 338), z=40)),
    # the near arm with the pipe hand; hinges at the shoulder, and because the
    # hand is almost level with that hinge, a small rotation is mostly LIFT
    ('pipe',  dict(poly=[(554, 331), (572, 320), (587, 331), (595, 345),
                         (597, 363), (593, 381), (595, 401), (571, 405),
                         (557, 385), (551, 357)],
                   pivot=(590, 345), z=50)),
    # gown from the shoulders to the belt, carrying the far arm; hinges at belt
    ('torso', dict(band=(0, 404), pivot=(601, 402), z=30)),
    # gown skirt, belt to hem; hinges at the belt too, so it sways like cloth
    ('skirt', dict(band=(404, 478), pivot=(601, 400), z=20)),
    # trousers and shoes: the anchor. Never rotates -- the feet are the one
    # thing in this figure that has to stay exactly where the plate put them.
    ('legs',  dict(band=(478, 10000), pivot=(602, 519), z=10)),
]

# The two marks he walks between, read off the plate: his own shoe base at the
# hearth, and a spot at the desk by the window. The room's floor is planar, so
# the line between them IS the floor line -- feet are checked against it.
HEARTH_MARK = (602, 519)
DESK_MARK = (766, 468)
DESK_SCALE = 0.885          # he is further from the camera at the desk

# Watson and his armchair: a genuine foreground object. Cut from the plate as
# its own alpha and re-laid ON TOP of the actor, so the walk crosses behind it.
# Opaque pixels are the plate's own, so with no actor present the composite is
# bit-identical to the plate -- the layer costs nothing until someone walks.
CHAIR_POLY = [(736, 352), (766, 338), (806, 332), (840, 338), (852, 362),
              (874, 400), (908, 418), (916, 468), (902, 502), (872, 522),
              (830, 540), (780, 544), (740, 536), (720, 508), (716, 458),
              (724, 414), (728, 382)]
CHAIR_CROP = (690, 306, 950, 574)


def floor_y(x):
    """the floor line through the two marks, extended both ways"""
    (x0, y0), (x1, y1) = HEARTH_MARK, DESK_MARK
    return y0 + (x - x0) * (y1 - y0) / (x1 - x0)


def walk_scale(x):
    (x0, _), (x1, _) = HEARTH_MARK, DESK_MARK
    t = (x - x0) / (x1 - x0)
    return 1.0 + t * (DESK_SCALE - 1.0)


if __name__ == '__main__':
    import json
    print(json.dumps({'poly': HOLMES_POLY, 'crop': CROP, 'parts': PARTS,
                      'floorAt': {x: round(floor_y(x), 1)
                                  for x in (480, 560, 640, 720, 800)}}, indent=1))
