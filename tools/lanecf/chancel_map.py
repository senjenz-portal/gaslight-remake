#!/usr/bin/env python3
"""chancel_map.py — print the chancel as the three things a sole can land on.

  .  the plate paints FLOOR here (carpet or stone, church_geom.py's classes)
  #  the occluder `pews-front.png` paints here — a foot at this pixel is hidden
  :  both
  (space)  NEITHER: pew back, pew end, shadow, riser. A sole here floats.

Read with tools/lanecf/sole_span.py, which is the same question asked per column
of a specific cut's own footwear block.

    python3 tools/lanecf/chancel_map.py [x0 x1 y0 y1]
"""
import sys

from sole_span import ISFLOOR, PEWS, PEWS_BOX


def main():
    a = [int(v) for v in sys.argv[1:]] or [640, 790, 468, 545]
    x0, x1, y0, y1 = a
    step = max(1, (x1 - x0) // 150)
    print('x %d..%d  y %d..%d  (step %d)' % (x0, x1, y0, y1, step))
    print('      ' + ''.join(
        str((x // 10) % 10) if x % 10 == 0 else ' ' for x in range(x0, x1, step)))
    for y in range(y0, y1):
        row = []
        for x in range(x0, x1, step):
            lx, ly = x - PEWS_BOX[0], y - PEWS_BOX[1]
            pew = (0 <= lx < PEWS.shape[1] and 0 <= ly < PEWS.shape[0]
                   and PEWS[ly, lx] > 16)
            fl = bool(ISFLOOR[y, x])
            row.append(':' if (pew and fl) else '#' if pew else '.' if fl else ' ')
        print('%4d  %s' % (y, ''.join(row)))


if __name__ == '__main__':
    main()
