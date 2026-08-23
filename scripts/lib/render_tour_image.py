import json
import math
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


RESAMPLE = getattr(getattr(Image, "Resampling", Image), "LANCZOS")


def font_candidates(bold=False):
    names = [
        r"C:\Windows\Fonts\malgunbd.ttf" if bold else r"C:\Windows\Fonts\malgun.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansKR-Bold.ttf" if bold else "/usr/share/fonts/truetype/noto/NotoSansKR-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    return [name for name in names if name and Path(name).exists()]


def load_font(size, bold=False):
    for candidate in font_candidates(bold):
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def text_size(draw, text, font):
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1]


def fitted_font(draw, text, target_width, start_size, min_size=24, bold=False):
    size = start_size
    while size >= min_size:
        font = load_font(size, bold=bold)
        width, _ = text_size(draw, text, font)
        if width <= target_width:
            return font
        size -= 2
    return load_font(min_size, bold=bold)


def crop_cover(image, width, height):
    image = image.convert("RGB")
    ratio = max(width / image.width, height / image.height)
    resized = image.resize((math.ceil(image.width * ratio), math.ceil(image.height * ratio)), RESAMPLE)
    left = max(0, (resized.width - width) // 2)
    top = max(0, (resized.height - height) // 2)
    return resized.crop((left, top, left + width, top + height))


def resize_inside(image, max_width):
    image = image.convert("RGB")
    if image.width <= max_width:
        return image
    ratio = max_width / image.width
    return image.resize((max_width, max(1, round(image.height * ratio))), RESAMPLE)


def rounded_rectangle(draw, box, radius, fill):
    try:
        draw.rounded_rectangle(box, radius=radius, fill=fill)
    except AttributeError:
        draw.rectangle(box, fill=fill)


def draw_cover_overlay(image, region, topic, title):
    canvas = image.convert("RGBA")
    width, height = canvas.size
    gradient = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    gradient_draw = ImageDraw.Draw(gradient)
    start = int(height * 0.34)
    for y in range(start, height):
        progress = (y - start) / max(1, height - start)
        alpha = int(178 * (progress ** 1.35))
        gradient_draw.line([(0, y), (width, y)], fill=(0, 0, 0, alpha))
    canvas = Image.alpha_composite(canvas, gradient)
    draw = ImageDraw.Draw(canvas)

    pad = max(34, width // 18)
    bottom = height - pad
    safe_width = width - (pad * 2)
    region_text = region or "TRIPVIEW"
    topic_text = topic or title or "여행 포인트"

    badge_font = fitted_font(draw, region_text, safe_width * 0.48, 34, 20, bold=True)
    topic_font = fitted_font(draw, topic_text, safe_width, 76, 32, bold=True)
    brand_font = load_font(20, bold=True)

    topic_width, topic_height = text_size(draw, topic_text, topic_font)
    badge_width, badge_height = text_size(draw, region_text, badge_font)
    brand = "TRIPVIEW"
    brand_width, brand_height = text_size(draw, brand, brand_font)

    badge_pad_x = 18
    badge_pad_y = 10
    badge_bottom = bottom - topic_height - 26
    badge_box = (
        pad,
        badge_bottom - badge_height - (badge_pad_y * 2),
        pad + badge_width + (badge_pad_x * 2),
        badge_bottom,
    )
    rounded_rectangle(draw, badge_box, 12, (255, 255, 255, 232))
    draw.text((badge_box[0] + badge_pad_x, badge_box[1] + badge_pad_y - 1), region_text, font=badge_font, fill=(17, 17, 17, 255))
    draw.text((pad, bottom - topic_height), topic_text, font=topic_font, fill=(255, 255, 255, 255))
    draw.text((width - pad - brand_width, bottom - brand_height - 2), brand, font=brand_font, fill=(255, 255, 255, 210))
    return canvas.convert("RGB")


def main():
    if len(sys.argv) > 1:
        with open(sys.argv[1], "r", encoding="utf-8") as handle:
            payload = json.load(handle)
    else:
        payload = json.load(sys.stdin)
    source = payload["source"]
    output = payload["output"]
    kind = payload.get("kind", "inline")
    quality = int(payload.get("quality", 84))
    image = ImageOps.exif_transpose(Image.open(source))

    if kind == "cover":
        width = int(payload.get("width", 1200))
        height = int(payload.get("height", 675))
        image = crop_cover(image, width, height)
        image = draw_cover_overlay(
            image,
            str(payload.get("region", "")),
            str(payload.get("topic", "")),
            str(payload.get("title", "")),
        )
    else:
        image = resize_inside(image, int(payload.get("width", 1000)))

    Path(output).parent.mkdir(parents=True, exist_ok=True)
    image.save(output, "WEBP", quality=quality, method=6)


if __name__ == "__main__":
    main()
