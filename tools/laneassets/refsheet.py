#!/usr/bin/env python3
"""refsheet.py -- build labelled multi-panel reference sheets for i2i.

nbpro_edit.py sends exactly ONE input image, so when a generation needs both a
STYLE lock (the 221B plate) and an IDENTITY lock (the King cameo) we hand the
model a single labelled contact sheet and tell it which panel governs what.
Burned-in labels are load-bearing: without them the model averages the panels.

Deterministic, no network. stdlib + PIL.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = '/Users/samz/Documents/gaslight-remake'
P = os.path.join(ROOT, 'assets/plates')

FONTS = ['/System/Library/Fonts/Helvetica.ttc',
         '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
         '/Library/Fonts/Arial.ttf']


def font(size):
    for f in FONTS:
        if os.path.exists(f):
            try:
                return ImageFont.truetype(f, size)
            except Exception:
                pass
    return ImageFont.load_default()


def panel(img, box_w, box_h, label, sub=''):
    """Letterbox img into box_w x box_h on black, with a burned-in caption bar."""
    cap_h = 74
    out = Image.new('RGB', (box_w, box_h), (8, 8, 10))
    inner_h = box_h - cap_h
    im = img.copy()
    im.thumbnail((box_w - 16, inner_h - 16), Image.LANCZOS)
    out.paste(im, ((box_w - im.width) // 2, (inner_h - im.height) // 2 + 8))
    d = ImageDraw.Draw(out)
    d.rectangle([0, box_h - cap_h, box_w, box_h], fill=(255, 255, 255))
    d.text((14, box_h - cap_h + 6), label, fill=(0, 0, 0), font=font(30))
    if sub:
        d.text((14, box_h - cap_h + 42), sub, fill=(70, 70, 70), font=font(22))
    d.rectangle([0, 0, box_w - 1, box_h - 1], outline=(120, 120, 120))
    return out


def actor_sheet(out_path):
    """4 panels: style plate, figure-at-scale crop, WHO (masked cameo), POSE ref."""
    plate = Image.open(os.path.join(P, 'backdrop.png')).convert('RGB')
    # Holmes standing in the plate: the exact figure treatment + camera angle
    holmes = plate.crop((520, 260, 700, 545)).resize((180 * 3, 285 * 3), Image.LANCZOS)
    who = Image.open(os.path.join(P, 'cameo-king-masked.png')).convert('RGB')
    who = who.crop((250, 30, 1120, 768))
    pose = Image.open(os.path.join(P, 'king-v2/king2-look.png')).convert('RGB')

    cw, ch = 1024, 640
    sheet = Image.new('RGB', (cw * 2, ch * 2), (8, 8, 10))
    sheet.paste(panel(plate, cw, ch,
                      'A / STYLE + LIGHT + CAMERA (copy exactly)',
                      'low-poly faceted paint, warm hearth key + cool blue fill, high 3/4 down-angle'),
                (0, 0))
    sheet.paste(panel(holmes, cw, ch,
                      'B / FIGURE TREATMENT AT DIORAMA SCALE',
                      'this is how a standing person is painted in this world -- match facet size + edge'),
                (cw, 0))
    sheet.paste(panel(who, cw, ch,
                      'C / WHO IT IS (identity lock: face, mask, hair, beard, palette)',
                      'tawny beard, black domino mask, steel-blue cloak w/ ORANGE lining, cream waistcoat'),
                (0, ch))
    sheet.paste(panel(pose, cw, ch,
                      'D / POSE + FRAMING ONLY -- IGNORE THIS MAN\'S FACE AND BUILD',
                      'full body head-to-boots, standing, isolated on a plain flat background'),
                (cw, ch))
    sheet.save(out_path)
    return out_path


def plate_sheet(out_path, kind):
    """The plate alone, upscaled -- variants edit the plate itself."""
    plate = Image.open(os.path.join(P, 'backdrop.png')).convert('RGB')
    plate.save(out_path)
    return out_path


if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'actor'
    out = sys.argv[2]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if which == 'actor':
        print(actor_sheet(out))
    else:
        print(plate_sheet(out, which))


def actor_sheet_portrait(out_path):
    """Portrait-aspect sheet: the standing-pose plate IS the canvas, so the model
    returns a tall full-body figure instead of a landscape vignette."""
    from PIL import Image as I
    plate = I.open(os.path.join(P, 'backdrop.png')).convert('RGB')
    pose = I.open(os.path.join(P, 'king-v2/king2-look.png')).convert('RGB')
    pose = pose.crop((425, 20, 880, 768))               # 455 x 748 portrait
    who = I.open(os.path.join(P, 'cameo-king-masked.png')).convert('RGB')
    who = who.crop((300, 30, 1080, 768))
    holmes = plate.crop((520, 260, 700, 545))

    W, H = 1152, 1536
    main_w = 760
    sheet = I.new('RGB', (W, H), (8, 8, 10))
    sheet.paste(panel(pose, main_w, H, 'A / POSE + FRAMING + CANVAS',
                      'keep this full-body standing framing; REPLACE the man'), (0, 0))
    col = W - main_w
    sheet.paste(panel(who, col, 560, 'B / WHO (identity lock)',
                      'bearded, domino mask'), (main_w, 0))
    sheet.paste(panel(plate, col, 480, 'C / STYLE + LIGHT',
                      'copy this world exactly'), (main_w, 560))
    sheet.paste(panel(holmes, col, 496, 'D / FIGURE TREATMENT',
                      'facet size + edge at scale'), (main_w, 1040))
    sheet.save(out_path)
    return out_path
