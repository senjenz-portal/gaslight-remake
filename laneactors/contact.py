#!/usr/bin/env python3
"""contact.py -- one sheet showing every actor at the size it actually ships at.

Every proof so far has been a magnified crop, and magnified crops flatter a
sprite: a rim that reads as a hairline at 3x is invisible at 1x, and a face
that looks crude at 3x is correct at 1x. The set has to be judged once at the
size the reader sees, on the plate it stands on, or the lane is judging
something the book never shows.

Top row: the cut-outs on navy at 1:1 (what the matte did).
Below:   each SET plate with its actors standing on their marks at the measured
         scale (what the reader sees).

    python3 contact.py OUT.png
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import actor_geom as G  # noqa: E402

ROOT = '/Users/samz/Documents/gaslight-remake'
A = os.path.join(ROOT, 'assets/plates/book/actors')
BOOK = os.path.join(ROOT, 'assets/plates/book')
NAVY = (20, 28, 50)

STREET_ROW = [('irene-street', 640), ('irene-board', 760), ('norton-street', 866)]
CHURCH_ROW = [('irene-bride', 700), ('norton-groom', 800), ('norton-beckon', 600)]


def font(sz):
    for f in ('/System/Library/Fonts/Helvetica.ttc',):
        if os.path.exists(f):
            try:
                return ImageFont.truetype(f, sz)
            except Exception:
                pass
    return ImageFont.load_default()


def scaled(aid, who, where, frame=0, frames=1):
    im = Image.open(os.path.join(A, aid + '.png')).convert('RGBA')
    if frames > 1:
        cw = im.width // frames
        im = im.crop((frame * cw, 0, (frame + 1) * cw, im.height))
    h = G.px_height(who, where)
    s = h / max(1, im.height - 6)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))),
                     Image.LANCZOS), h


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/actors/contact.png'
    W = 1408
    rows = []

    # 1 -- the cut-outs on navy, at ship scale, all in a line
    strip = Image.new('RGBA', (W, 200), NAVY)
    x = 20
    d = ImageDraw.Draw(strip)
    for aid, who, where, frames in [
            ('irene-street', 'irene', 'street', 1),
            ('irene-board', 'irene', 'street', 1),
            ('irene-walk', 'irene', 'street', 4),
            ('irene-bride', 'irene', 'church', 1),
            ('norton-street', 'norton', 'street', 1),
            ('norton-run', 'norton', 'street', 4),
            ('norton-beckon', 'norton', 'church', 1),
            ('norton-groom', 'norton', 'church', 1)]:
        for f in range(frames):
            im, h = scaled(aid, who, where, f, frames)
            strip.alpha_composite(im, (x, 150 - im.height))
            x += im.width + 8
        d.text((x - 40, 158), aid.split('-')[1][:6], fill=(150, 160, 190),
               font=font(11))
        x += 22
    rows.append(strip.convert('RGB'))

    # 2 -- the street, peopled
    st = Image.open(os.path.join(BOOK, G.STREET['plate'])).convert('RGBA')
    for aid, mx in STREET_ROW:
        who = 'irene' if aid.startswith('irene') else 'norton'
        im, h = scaled(aid, who, 'street')
        st.alpha_composite(im, (round(mx - im.width / 2),
                                round(G.street_floor_y(mx) - h)))
    for i in range(4):
        im, h = scaled('irene-walk', 'irene', 'street', i, 4)
        mx = 470 + i * 34
        st.alpha_composite(im, (round(mx - im.width / 2),
                                round(G.street_floor_y(mx) - h)))
    rows.append(st.convert('RGB'))

    # 3 -- St Monica's, with the sprites on the painted figures' own marks
    ch = Image.open(os.path.join(BOOK, G.CHURCH['plate'])).convert('RGBA')
    kp = G.CHURCH['knotPatch']
    ch.alpha_composite(Image.open(os.path.join(BOOK, kp['file'])).convert('RGBA'),
                       (kp['x'], kp['y']))
    for aid, mx in CHURCH_ROW:
        who = 'irene' if aid.startswith('irene') else 'norton'
        im, h = scaled(aid, who, 'church')
        feet = G.CHURCH['marks']['bride' if who == 'irene' else 'groom'][1]
        if aid == 'norton-beckon':
            feet = 505
        ch.alpha_composite(im, (round(mx - im.width / 2), round(feet - h)))
    rows.append(ch.convert('RGB'))

    H = sum(r.height + 6 for r in rows)
    sheet = Image.new('RGB', (W, H), (8, 8, 10))
    y = 0
    for r in rows:
        sheet.paste(r, (0, y))
        y += r.height + 6
    sheet.save(out)
    print(out, sheet.size)


if __name__ == '__main__':
    main()
