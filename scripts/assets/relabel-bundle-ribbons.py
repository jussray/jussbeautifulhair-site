"""Replace the printed ribbon lettering on JBH bundle photos with LAWLESS.

Founder-authorised 2026-09-23. Only pixels inside each measured ribbon text band
(and the listed crown marks) are rewritten; hair, satin, and bow content outside
those bands is unchanged apart from JPEG re-encode noise (measured: mean 0.05/255,
p99 <= 2 levels), because the output reuses the source quantisation tables.

Usage (Python 3 with opencv-python-headless, numpy, pillow; font from
`npm pack @fontsource/playfair-display`, the site's display face):

    python3 scripts/assets/relabel-bundle-ribbons.py \
        <playfair-display-latin-500-normal.woff> \
        client/public/products/bundle-bodywave.jpg <out.jpg>

Run it against the pre-relabel originals only (git history), never on its own output.
"""
import math
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = sys.argv[1]
SRC = sys.argv[2]
OUT = sys.argv[3]

# (start_xy, end_xy) in full-resolution pixels, first letter -> last letter.
RUNS = {
    "bundle-bodywave": [
        ((342, 280), (453, 242)),  # upper-right loop
        ((175, 360), (248, 315)),  # left loop
        ((365, 312), (478, 400)),  # right tail
        ((192, 490), (255, 377)),  # left tail
    ],
    "bundle-loosewave": [
        ((387, 352), (473, 435)),  # right tail
        ((219, 462), (272, 350)),  # left tail
        ((332, 278), (388, 249), "tuck"),  # upper-right loop, word tucks under the knot
    ],
}
# Crown marks to erase (no replacement text).
ICONS = {
    "bundle-bodywave": [],
    "bundle-loosewave": [((372, 333), 12), ((265, 283), 11), ((212, 487), 13)],
}
BAND = 11  # half-height of the text band in px
PAD = 6  # extra length past first/last letter


def band_mask(shape, start, end, half, pad):
    (x0, y0), (x1, y1) = start, end
    length = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / length, (y1 - y0) / length
    nx, ny = -uy, ux
    a = (x0 - ux * pad, y0 - uy * pad)
    b = (x1 + ux * pad, y1 + uy * pad)
    poly = np.array(
        [
            (a[0] + nx * half, a[1] + ny * half),
            (b[0] + nx * half, b[1] + ny * half),
            (b[0] - nx * half, b[1] - ny * half),
            (a[0] - nx * half, a[1] - ny * half),
        ],
        np.int32,
    )
    mask = np.zeros(shape[:2], np.uint8)
    cv2.fillPoly(mask, [poly], 255)
    return mask


def letter_mask(img, region):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.int16)
    background = cv2.medianBlur(gray.astype(np.uint8), 15).astype(np.int16)
    lighter = (gray - background) > 9
    b, g, r = [img[:, :, i].astype(np.int16) for i in range(3)]
    warm = (r - b) > -5  # gold/pink lettering is warmer than the violet satin
    mask = (lighter & warm & (region > 0)).astype(np.uint8) * 255
    return cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=2)


def main():
    name = SRC.rsplit("/", 1)[-1].rsplit(".", 1)[0]
    img = cv2.imread(SRC)
    remove = np.zeros(img.shape[:2], np.uint8)
    for start, end, *_ in RUNS[name]:
        remove |= letter_mask(img, band_mask(img.shape, start, end, BAND, PAD))
    for (cx, cy), radius in ICONS[name]:
        region = np.zeros(img.shape[:2], np.uint8)
        cv2.circle(region, (cx, cy), radius + 4, 255, -1)
        remove |= letter_mask(img, region)

    # Ink = JBH brand gold (--gold: hsl(34 47% 65%) in client/src/index.css),
    # scaled to the luminance of the original glyph cores so the new lettering
    # sits at the same visual weight on the satin. A literal colour copy renders
    # pink because JPEG chroma blur tints thin gold strokes with the violet satin.
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.int16)
    background = cv2.medianBlur(gray.astype(np.uint8), 15).astype(np.int16)
    runs = np.zeros(gray.shape, np.uint8)
    for start, end, *_ in RUNS[name]:
        cv2.line(runs, start, end, 255, 16)
    cores = img[(runs > 0) & ((gray - background) > 40)].astype(np.float32)
    core_luma = float((cores @ np.array([0.114, 0.587, 0.299], np.float32)).mean())
    brand_gold = np.array([124, 171, 208], np.float32)  # BGR
    brand_luma = float(brand_gold @ np.array([0.114, 0.587, 0.299], np.float32))
    ink = brand_gold * min(1.0, (core_luma * 1.08) / brand_luma)
    clean = cv2.inpaint(img, remove, 6, cv2.INPAINT_TELEA)

    # Render LAWLESS along each run with 4x supersampling.
    base = Image.fromarray(cv2.cvtColor(clean, cv2.COLOR_BGR2RGB)).convert("RGBA")
    scale = 4
    font = ImageFont.truetype(FONT, 18 * scale)
    tracking = 0.28 * 18 * scale
    for run in RUNS[name]:
        start, end = run[0], run[1]
        tucked = len(run) > 2 and run[2] == "tuck"
        (x0, y0), (x1, y1) = start, end
        angle = math.degrees(math.atan2(y1 - y0, x1 - x0))
        length = math.hypot(x1 - x0, y1 - y0)
        ux, uy = (x1 - x0) / length, (y1 - y0) / length
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        text = "LAWLESS"
        widths = [font.getlength(ch) for ch in text]
        total = sum(widths) + tracking * (len(text) - 1)
        ascent, descent = font.getmetrics()
        tile = Image.new("L", (int(total) + 8 * scale, ascent + descent + 8 * scale), 0)
        draw = ImageDraw.Draw(tile)
        x = 4 * scale
        for ch, w in zip(text, widths):
            draw.text((x, 4 * scale), ch, font=font, fill=255)
            x += w + tracking
        tile = tile.crop(tile.getbbox())
        tile = tile.resize((max(1, tile.width // scale), max(1, tile.height // scale)), Image.LANCZOS)
        if tucked:
            # Word ends where the original ended and runs under the knot, like the
            # original partial lettering; nothing is drawn before the run start.
            cx, cy = x1 - ux * tile.width / 2, y1 - uy * tile.width / 2
        tile = tile.rotate(-angle, resample=Image.BICUBIC, expand=True)
        alpha = np.asarray(tile, np.float32) / 255 * 0.95
        h, w = alpha.shape
        left, top = int(round(cx - w / 2)), int(round(cy - h / 2))
        if tucked:
            ys, xs = np.mgrid[top : top + h, left : left + w]
            alpha = alpha * (((xs - x0) * ux + (ys - y0) * uy) >= 0)
        patch = np.asarray(base, np.float32)[top : top + h, left : left + w, :3]
        # Follow the satin sheen: scale ink by local brightness relative to band mean.
        lum = patch.mean(axis=2, keepdims=True)
        shade = np.clip((lum / max(lum.mean(), 1)) ** 0.6, 0.75, 1.25)
        color = ink[::-1].reshape(1, 1, 3) * shade  # BGR -> RGB
        blended = patch * (1 - alpha[..., None]) + color * alpha[..., None]
        arr = np.asarray(base).copy()
        arr[top : top + h, left : left + w, :3] = np.clip(blended, 0, 255).astype(np.uint8)
        base = Image.fromarray(arr)

    # Re-encode with the source's own quantisation tables and chroma subsampling
    # so file weight and compression character match the untouched catalog set.
    source = Image.open(SRC)
    base.convert("RGB").save(
        OUT, qtables=source.quantization, subsampling=2, progressive=True, optimize=True
    )
    print(name, "ink BGR", ink.round(1), "removed px", int((remove > 0).sum()))


main()
