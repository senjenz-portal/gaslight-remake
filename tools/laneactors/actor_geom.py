#!/usr/bin/env python3
"""actor_geom.py -- the measured scale law for the new actors, one plate at a time.

Beat I could keep its numbers in holmes_geom.py because there was one plate and
one floor. Beats II-VII have three SETs, each its own diorama at its own zoom,
so a sprite that is right in the church is wrong in the street by a factor of
1.7. This module is the single place those numbers live, and every one of them
is MEASURED off the shipped plate against a real-world object of known size --
not chosen, and not inherited from Beat I.

Vertical px/m is the only scale that matters for an actor, because these plates
are orthographic-ish dioramas: a standing figure's HEIGHT does not change as it
moves across the floor, only its foot line does. (The one exception is the chase
strip, which is a receding rail and carries its own per-u scale from the plate
lane's own fit.)

Run it to print the table and re-derive the chase samples:
    python3 actor_geom.py
"""
import json
import os

ROOT = '/Users/samz/Documents/gaslight-remake'
BOOK = os.path.join(ROOT, 'assets/plates/book')

PLATE = (1408, 768)

# Real-world sizes used as the measuring sticks. A Victorian front door leaf is
# 6 ft 8 in; a London gas standard of this pattern is about 4 m to the finial;
# a surpliced man is taken at 1.75 m.
DOOR_M = 2.03
LAMP_M = 4.00
CLERGY_M = 1.75

# ---------------------------------------------------------------- STREET -----
# Serpentine Avenue, the bijou villa. Measured on street.png: the front door
# leaf runs y 362 -> 470 at x 855-905 (108 px), and the area railing beside it
# runs y 478 -> 545 (~1.3 m). Both land on the same scale.
STREET = {
    'plate': 'street/street.png',
    'pxPerMetre': 108 / DOOR_M,                       # 53.2
    'measure': 'front door leaf y362->470 (108 px) at x855-905, DOOR_M 2.03 m',
    'crossCheck': 'area railing y478->545 (67 px) at ~1.3 m -> 51.5 px/m',
    # the plate lane's own polyline, where the built street meets the pavement:
    # a sprite's foot baseline is pinned to this. Copied from street/life.json
    # so the actor lane cannot drift from the set lane.
    'floorLine': [[400, 498], [478, 458], [560, 470], [640, 486], [700, 496],
                  [760, 506], [830, 516], [900, 524]],
    # Beat VI's reveal lives INSIDE the bay glass, on the facade plane, which is
    # a different plane from the pavement and so a different scale. The set lane
    # measured it: 36.0 px/m across, 53.3 px/m up.
    'revealBox': [698, 318, 806, 430],
    'revealPxPerMetre': [36.0, 53.3],
    'revealCrossX': [721, 786],
}

# ---------------------------------------------------------------- CHURCH -----
# St Monica's. Measured on church.jpg: the surpliced clergyman is the only one
# of the three painted figures whose feet are NOT occluded by a pew, so he is
# the only honest measuring stick among them -- head y 340 -> cassock hem y 495.
CHURCH = {
    'plate': 'church/church.jpg',
    'pxPerMetre': 155 / CLERGY_M,                     # 88.6
    'measure': 'painted clergyman crown y340 -> hem y495 (155 px), CLERGY_M 1.75 m',
    'crossCheck': ('bride crown y372 and groom crown y380 imply feet at y521 / '
                   'y539 at this scale; both are occluded by the pew front at '
                   'y~505, which is consistent and is why they cannot be measured'),
    # where the three stand today, so a generated actor can replace one of them
    # on its own mark. Read off the plate; x is the figure centre, y the foot.
    'marks': {'bride': [740, 521], 'groom': [811, 539], 'clergyman': [877, 495],
              'witness': [520, 470]},
    'knotPatch': {'file': 'church/layers/knot-patch.png', 'x': 662, 'y': 316,
                  'note': 'the chancel with the three inpainted away. It is a '
                          'BLURRED fill, not a clean reconstruction, so it '
                          'cannot drive a |plate-inpaint| matte the way Beat '
                          "I's holmes-patch did -- it is only good as the "
                          'backing to composite generated actors over.'},
}

# ----------------------------------------------------------------- CHASE -----
# The strip. Its scale RECEDES, so px/m is a function of the rail parameter u.
# The plate lane fitted the rail and published a per-sample scale s normalised
# to 1.0 at the near end; the actor lane only has to anchor that s in metres.
# Measured at the near end: the first gas standard runs y 309 -> 514 (205 px).
CHASE = {
    'plate': 'chase/chase.jpg',
    'pxPerMetreAtRailStart': 205 / LAMP_M,            # 51.2
    'measure': 'near gas standard finial y309 -> base y514 (205 px), LAMP_M 4.0 m',
    'crossCheck': 'near terrace door leaf y365->468 (103 px) -> 50.7 px/m',
    'railFrom': 'chase/MANIFEST.json rail.samples (s normalised 1.0 at u=0)',
    'door': [663, 356],
}


def _rail():
    with open(os.path.join(BOOK, 'chase/MANIFEST.json')) as f:
        return json.load(f)['rail']


def street_floor_y(x):
    """the pavement line at plate-x, linearly between the set lane's points"""
    pts = STREET['floorLine']
    if x <= pts[0][0]:
        return float(pts[0][1])
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            return y0 + (x - x0) * (y1 - y0) / (x1 - x0)
    return float(pts[-1][1])


def chase_at(u):
    """(x, y, pxPerMetre) on the chase rail at rail parameter u in [0,1]"""
    s = _rail()['samples']
    if u <= s[0]['u']:
        a = b = s[0]
        t = 0.0
    else:
        a, b, t = s[-1], s[-1], 0.0
        for p, q in zip(s, s[1:]):
            if u <= q['u']:
                a, b = p, q
                t = (u - p['u']) / max(1e-9, q['u'] - p['u'])
                break
    lerp = lambda k: a[k] + t * (b[k] - a[k])          # noqa: E731
    return lerp('x'), lerp('y'), CHASE['pxPerMetreAtRailStart'] * lerp('s')


def chase_u_at_x(x):
    s = _rail()['samples']
    for p, q in zip(s, s[1:]):
        if p['x'] <= x <= q['x']:
            return p['u'] + (x - p['x']) / max(1e-9, q['x'] - p['x']) * (q['u'] - p['u'])
    return 0.0 if x < s[0]['x'] else 1.0


# The cast's heights, in metres. Doyle gives none of these; they are ordinary
# adult figures and are set here once so every plate scales them the same way.
HEIGHT_M = {'irene': 1.68, 'norton': 1.80, 'holmes': 1.85, 'clergyman': 1.75}


def px_height(who, where, u=None):
    """how tall this actor stands, in plate pixels, on this SET"""
    m = HEIGHT_M[who]
    if where == 'street':
        return m * STREET['pxPerMetre']
    if where == 'church':
        return m * CHURCH['pxPerMetre']
    if where == 'chase':
        return m * chase_at(u if u is not None else 0.0)[2]
    raise ValueError(where)


if __name__ == '__main__':
    door_u = chase_u_at_x(CHASE['door'][0])
    out = {
        'street_pxPerMetre': round(STREET['pxPerMetre'], 1),
        'church_pxPerMetre': round(CHURCH['pxPerMetre'], 1),
        'chase_pxPerMetre_at_rail_start': round(CHASE['pxPerMetreAtRailStart'], 1),
        'chase_door_u': round(door_u, 3),
        'chase_pxPerMetre_at_door': round(chase_at(door_u)[2], 1),
        'figure_px': {
            'irene_street': round(px_height('irene', 'street')),
            'norton_street': round(px_height('norton', 'street')),
            'irene_church': round(px_height('irene', 'church')),
            'norton_church': round(px_height('norton', 'church')),
            'irene_chase_at_door': round(px_height('irene', 'chase', door_u)),
            'norton_chase_at_door': round(px_height('norton', 'chase', door_u)),
        },
        'street_floor_y': {x: round(street_floor_y(x), 1)
                           for x in (480, 560, 640, 720, 800, 880)},
    }
    print(json.dumps(out, indent=1))
