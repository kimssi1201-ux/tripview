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


def dominant_color(image):
    sample = image.convert("RGB").resize((80, 80), RESAMPLE)
    try:
        palette = sample.quantize(colors=8, method=Image.Quantize.MEDIANCUT).convert("RGB")
    except AttributeError:
        palette = sample.quantize(colors=8).convert("RGB")
    colors = palette.getcolors(80 * 80) or []
    if not colors:
        return sample.resize((1, 1), RESAMPLE).getpixel((0, 0))
    return max(colors, key=lambda item: item[0])[1]


def poster_canvas(image, width, height):
    image = image.convert("RGB")
    canvas = Image.new("RGB", (width, height), dominant_color(image))
    ratio = min(width / image.width, height / image.height)
    resized = image.resize((max(1, round(image.width * ratio)), max(1, round(image.height * ratio))), RESAMPLE)
    left = (width - resized.width) // 2
    top = (height - resized.height) // 2
    canvas.paste(resized, (left, top))
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

    if kind in {"cover", "hub-banner"}:
        width = int(payload.get("width", 1200))
        height = int(payload.get("height", 675))
        image = poster_canvas(image, width, height) if image.height > image.width else crop_cover(image, width, height)
    else:
        image = resize_inside(image, int(payload.get("width", 1000)))

    Path(output).parent.mkdir(parents=True, exist_ok=True)
    image.save(output, "WEBP", quality=quality, method=0)


if __name__ == "__main__":
    main()
