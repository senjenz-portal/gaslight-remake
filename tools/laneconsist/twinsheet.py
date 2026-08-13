#!/usr/bin/env python3
"""twinsheet.py -- THE CANONICAL SHEET, in the only shape an edit model respects.

The lane's law is: one canonical image per character, and every other pose keeps
its accepted BODY and receives the canonical HEAD. That is a local edit, and a
local edit has one failure mode above all others -- the model reframes, and the
head that comes back no longer fits the hole it was cut from.

So the sheet is deliberately TWO PANELS SIDE BY SIDE at a known geometry, and
the instruction asks for the SAME SHEET back with only the left panel repainted.
Asking for "just the head, alone" invites a new framing; asking for the sheet
back preserves layout, and the left panel can then be cropped out by proportion
no matter what size the model returns.

  LEFT   the head to repaint, IN ITS OWN CROP, at exact aspect. This panel is
         the geometry contract: whatever comes back is scaled to this box.
  RIGHT  the canonical head. This panel is WHO. It is never cropped out and is
         only ever used as identity.

    python3 twinsheet.py TARGET_HEAD.png CANON_HEAD.png OUT.png [--scale 2]
"""
import argparse, json, os
from PIL import Image, ImageDraw, ImageFont

FONTS = ['/System/Library/Fonts/Helvetica.ttc',
         '/System/Library/Fonts/Supplemental/Arial Bold.ttf']
BG = (24, 28, 46)

def font(sz):
    for f in FONTS:
        if os.path.exists(f):
            try: return ImageFont.truetype(f, sz)
            except Exception: pass
    return ImageFont.load_default()

def build(target, canon, out, scale=2, cb=54,
          left_cap='LEFT PANEL — REPAINT THIS HEAD. Same crop, same size, same background.',
          right_cap='RIGHT PANEL — WHO HE/SHE IS. Identity only. Return this panel unchanged.'):
    t = Image.open(target).convert('RGB')
    c = Image.open(canon).convert('RGB')
    PW, PH = t.width * scale, t.height * scale
    t = t.resize((PW, PH), Image.LANCZOS)
    sheet = Image.new('RGB', (PW * 2, PH + cb), BG)
    sheet.paste(t, (0, 0))
    cc = c.copy(); cc.thumbnail((PW - 8, PH - 8), Image.LANCZOS)
    sheet.paste(cc, (PW + (PW - cc.width) // 2, (PH - cc.height) // 2))
    d = ImageDraw.Draw(sheet)
    d.rectangle([0, PH, PW * 2, PH + cb], fill=(255, 255, 255))
    d.line([(PW, 0), (PW, PH)], fill=(255, 255, 255), width=4)
    f = font(max(14, min(26, PW // 34)))
    d.text((10, PH + 12), left_cap, fill=(0, 0, 0), font=f)
    d.text((PW + 10, PH + 12), right_cap, fill=(0, 0, 0), font=f)
    sheet.save(out)
    rec = {'out': out, 'sheet': [sheet.width, sheet.height],
           'left_box_frac': [0.0, 0.0, 0.5, PH / (PH + cb)],
           'left_px': [0, 0, PW, PH], 'target': target, 'canon': canon}
    json.dump(rec, open(out.replace('.png', '.json'), 'w'), indent=1)
    print(json.dumps(rec))

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('target'); ap.add_argument('canon'); ap.add_argument('out')
    ap.add_argument('--scale', type=int, default=2)
    a = ap.parse_args()
    build(a.target, a.canon, a.out, a.scale)
