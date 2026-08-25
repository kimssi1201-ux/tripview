import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageOps


RESAMPLE = getattr(getattr(Image, "Resampling", Image), "LANCZOS")


def crop_cover(image, width, height):
    image = image.convert("RGB")
    ratio = max(width / image.width, height / image.height)
    resized = image.resize((math.ceil(image.width * ratio), math.ceil(image.height * ratio)), RESAMPLE)
    left = max(0, (resized.width - width) // 2)
    top = max(0, (resized.height - height) // 2)
    return resized.crop((left, top, left + width, top + height))


def edge_color_sample(image):
    image = image.convert("RGB")
    edge = max(1, round(min(image.width, image.height) * 0.08))
    strips = [
        image.crop((0, 0, edge, image.height)),
        image.crop((image.width - edge, 0, image.width, image.height)),
        image.crop((0, 0, image.width, edge)),
        image.crop((0, image.height - edge, image.width, image.height)),
    ]
    normalized = [strip.resize((96, 96), RESAMPLE) for strip in strips]
    sample = Image.new("RGB", (96 * len(normalized), 96))
    x = 0
    for strip in normalized:
        sample.paste(strip, (x, 0))
        x += strip.width
    return sample


def color_score(item):
    count, color = item
    red, green, blue = color
    highest = max(color)
    lowest = min(color)
    saturation = 0 if highest == 0 else (highest - lowest) / highest
    lightness = (highest + lowest) / 510
    white_penalty = 0.2 if red > 235 and green > 235 and blue > 235 else 1
    return count * (0.45 + saturation) * (1.15 - abs(lightness - 0.45)) * white_penalty


def dominant_edge_color(image):
    sample = edge_color_sample(image).resize((96, 96), RESAMPLE)
    try:
        palette = sample.quantize(colors=8, method=Image.Quantize.MEDIANCUT).convert("RGB")
    except AttributeError:
        palette = sample.quantize(colors=8).convert("RGB")
    colors = palette.getcolors(96 * 96) or []
    if not colors:
        return sample.resize((1, 1), RESAMPLE).getpixel((0, 0))
    return max(colors, key=color_score)[1]


def poster_canvas(image, width, height):
    image = image.convert("RGB")
    canvas = Image.new("RGB", (width, height), dominant_edge_color(image))
    ratio = height / image.height
    resized = image.resize((max(1, round(image.width * ratio)), height), RESAMPLE)
    left = (width - resized.width) // 2
    if resized.width > width:
        left_crop = max(0, (resized.width - width) // 2)
        resized = resized.crop((left_crop, 0, left_crop + width, height))
        left = 0
    canvas.paste(resized, (left, 0))
    return canvas


def resize_inside(image, max_width):
    image = image.convert("RGB")
    if image.width <= max_width:
        return image
    ratio = max_width / image.width
    return image.resize((max_width, max(1, round(image.height * ratio))), RESAMPLE)


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

    if kind in {"cover", "hero-cover", "hub-banner"}:
        width = int(payload.get("width", 1200))
        height = int(payload.get("height", 675))
        image = poster_canvas(image, width, height) if image.height > image.width else crop_cover(image, width, height)
    else:
        image = resize_inside(image, int(payload.get("width", 1000)))

    Path(output).parent.mkdir(parents=True, exist_ok=True)
    image.save(output, "WEBP", quality=quality, method=0)


if __name__ == "__main__":
    main()
