"""LANE B step 3a — turn the portrait into a projection-ready texture atlas.

Runs in SYSTEM python (needs PIL): Blender has no PIL, and doing the image
work outside keeps the blender side to pure UV maths.

  - roughly de-lights the photo: divides out the low-frequency luminance
    gradient (his left side is much hotter than his right) and compresses the
    value range, so the baked skin reads as flat stylized colour, not a photo
    with baked-in studio light.
  - kills the bokeh background: masks to a hand-measured head polygon and
    push-pull fills outward, so nothing green can bleed onto the silhouette.
  - packs it into a 1024 atlas with flat skin/hair patches for the faces the
    projection cannot see.

out: laneb/king2-head-atlas.png  +  laneb/atlas.json
"""
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = "/Users/samz/Downloads/junze.png"
OUT = "/Users/samz/Documents/gaslight-remake/assets/plates/king-v2/laneb"
ATLAS = 1024
REG_W, REG_H = 940, 960          # portrait region inside the atlas
PATCH = dict(skin=(984, 110), hair=(984, 330), lip=(984, 550), ear=(984, 760))
POSTER_COLORS = 18     # palette size for the flat-plane look
POSTER_MIX = 0.75      # how far to go toward pure flat planes
MEDIAN = 5             # kills pores/noise before quantising

# head+hair outline measured on the 436x446 portrait
HEAD_POLY = [(219, 42), (258, 47), (292, 66), (314, 96), (326, 140), (330, 186),
             (326, 228), (316, 262), (302, 292), (276, 314), (246, 329),
             (219, 334), (192, 330), (166, 316), (147, 293), (135, 262),
             (127, 228), (120, 186), (119, 148), (129, 108), (150, 74),
             (182, 51)]


def delight(rgb, mask):
    """flatten the studio light: remove the low-frequency luma gradient and
    squeeze the remaining contrast toward the mid value."""
    im = Image.fromarray(rgb)
    lum = np.asarray(im.convert('L'), dtype=np.float32) / 255.0
    blur = np.asarray(Image.fromarray((lum * 255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(radius=rgb.shape[1] / 7.0)),
                      dtype=np.float32) / 255.0
    m = mask > 0
    mean_l, mean_b = lum[m].mean(), blur[m].mean()
    # keep all detail (lum-blur), keep only 25% of the lighting ramp
    flat = mean_l + (lum - blur) + (blur - mean_b) * 0.25
    flat = mean_l + (flat - mean_l) * 0.80          # compress value range
    flat = np.clip(flat, 0.06, 0.97)
    gain = flat / np.maximum(lum, 1e-3)
    gain = np.clip(gain, 0.45, 2.4)[..., None]
    out = np.clip(rgb.astype(np.float32) * gain, 0, 255)
    # gentle desaturation so it sits with the flat cameo palette
    g = out @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    out = out * 0.88 + g[..., None] * 0.12
    return np.clip(out, 0, 255).astype(np.uint8)


def pushpull(rgb, mask):
    """pull-push pyramid fill: extend head colour outward over the whole frame
    so no bokeh green can ever be sampled near the silhouette."""
    img = rgb.astype(np.float32) * (mask > 0)[..., None]
    w = (mask > 0).astype(np.float32)
    stack = [(img, w)]
    while min(stack[-1][1].shape[:2]) > 1:
        i, ww = stack[-1]
        h, wd = ww.shape
        if h % 2 or wd % 2:
            i = np.pad(i, ((0, h % 2), (0, wd % 2), (0, 0)))
            ww = np.pad(ww, ((0, h % 2), (0, wd % 2)))
        stack.append((i[0::2, 0::2] + i[1::2, 0::2] + i[0::2, 1::2] + i[1::2, 1::2],
                      ww[0::2, 0::2] + ww[1::2, 0::2] + ww[0::2, 1::2] + ww[1::2, 1::2]))
    i, ww = stack[-1]
    cur = i / np.maximum(ww, 1e-6)[..., None]
    for lvl in range(len(stack) - 2, -1, -1):
        i, ww = stack[lvl]
        h, wd = ww.shape
        up = np.repeat(np.repeat(cur, 2, axis=0), 2, axis=1)[:h, :wd]
        cur = np.where((ww > 0)[..., None], i / np.maximum(ww, 1e-6)[..., None], up)
    out = np.clip(cur, 0, 255).astype(np.uint8)
    soft = np.asarray(Image.fromarray(out).filter(ImageFilter.GaussianBlur(5)))
    return np.where((mask > 0)[..., None], out, soft)


def kmeans_palette(px, k, iters=14, seed=3):
    """tiny k-means over the head pixels -> stylized flat palette."""
    rng = np.random.default_rng(seed)
    c = px[rng.choice(len(px), k, replace=False)].astype(np.float32)
    for _ in range(iters):
        d = ((px[:, None, :] - c[None, :, :]) ** 2).sum(-1)
        lab = d.argmin(1)
        for i in range(k):
            m = lab == i
            if m.any():
                c[i] = px[m].mean(0)
    return c


def snap(img, pal):
    flat = img.reshape(-1, 3)
    out = np.empty_like(flat)
    step = 40000
    for i in range(0, len(flat), step):
        chunk = flat[i:i + step]
        idx = ((chunk[:, None, :] - pal[None, :, :]) ** 2).sum(-1).argmin(1)
        out[i:i + step] = pal[idx]
    return out.reshape(img.shape)


def main():
    src = Image.open(SRC).convert('RGB')
    W, H = src.size
    mask_im = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask_im).polygon(HEAD_POLY, fill=255)
    # erode: the hand-drawn polygon clips a little bokeh at the top corners and
    # that green would be what the silhouette faces sample
    mask_im = mask_im.filter(ImageFilter.MinFilter(9))
    mask = np.asarray(mask_im)
    rgb = np.asarray(src)

    lit = delight(rgb, mask)
    filled = pushpull(lit, mask)

    # sample flat colours from the de-lit image
    def med(box):
        x0, y0, x1, y1 = box
        return np.median(lit[y0:y1, x0:x1].reshape(-1, 3), axis=0).astype(int)

    skin = med((150, 300, 290, 322))     # jaw/chin skin, out of the hot light
    hair = med((150, 70, 290, 105))      # top hair mass
    lip = med((196, 292, 244, 302))      # under-lip
    hair = (np.array(hair) * 0.72).astype(int)   # photo hair is lifted by rim light

    # faces the projection can't see are turned away from the key light, so
    # the flat fallback reads better a little darker than the median skin
    patch_skin = (np.array(skin) * 0.86).astype(int)
    patch_ear = (np.array(skin) * 0.72).astype(int)   # ears sit in shadow

    def pack(region_img, path):
        atlas = Image.new('RGB', (ATLAS, ATLAS), tuple(int(v) for v in patch_skin))
        atlas.paste(region_img.resize((REG_W, REG_H), Image.LANCZOS), (0, 0))
        d = ImageDraw.Draw(atlas)
        for name, (cx, cy) in PATCH.items():
            col = dict(skin=patch_skin, hair=hair, lip=lip, ear=patch_ear)[name]
            d.rectangle([cx - 36, cy - 90, cx + 36, cy + 90],
                        fill=tuple(int(v) for v in col))
        atlas.save(path)
        return atlas

    photo = Image.fromarray(filled)
    pack(photo, OUT + "/king2-head-atlas-photo.png")
    # posterised variant: median away the pores, then snap to a palette that is
    # k-means'd from the HEAD pixels only.  Quantising the whole frame spends
    # most of the palette on the filled background and muddies the face.
    med_im = np.asarray(photo.filter(ImageFilter.MedianFilter(size=MEDIAN)),
                        dtype=np.float32)
    pal = kmeans_palette(med_im[mask > 0], POSTER_COLORS)
    flat = snap(med_im, pal)
    flat = np.clip((flat - 128) * 1.06 + 128, 0, 255)      # hold the contrast
    blend = np.clip(flat * POSTER_MIX + med_im * (1 - POSTER_MIX), 0, 255)
    pack(Image.fromarray(blend.astype(np.uint8)), OUT + "/king2-head-atlas.png")

    meta = dict(
        atlas=ATLAS, region=[REG_W, REG_H], portrait=[W, H],
        patch={k: [v[0] / ATLAS, 1.0 - v[1] / ATLAS] for k, v in PATCH.items()},
        colors=dict(skin=[int(v) for v in skin], hair=[int(v) for v in hair],
                    lip=[int(v) for v in lip]),
    )
    json.dump(meta, open(OUT + "/atlas.json", 'w'), indent=1)
    print("atlas ->", OUT + "/king2-head-atlas.png", meta['colors'])


main()
