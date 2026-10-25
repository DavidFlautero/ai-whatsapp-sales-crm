import sys
from pathlib import Path

from PIL import Image
from pillow_heif import register_heif_opener

# OWNER_HEIC_MODERN_DECODER_V1

Image.MAX_IMAGE_PIXELS = 60_000_000

register_heif_opener()

def convert(source: str, target: str):
    with Image.open(source) as image:
        pixels = image.width * image.height

        if pixels <= 0 or pixels > 60_000_000:
            raise ValueError("IMAGE_DIMENSIONS_NOT_ALLOWED")

        image.load()

        rgb = image.convert("RGB")

        rgb.save(
            target,
            format="JPEG",
            quality=88,
            optimize=True,
        )

    output = Path(target)

    if not output.is_file() or output.stat().st_size == 0:
        raise ValueError("JPEG_OUTPUT_EMPTY")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("INVALID_ARGUMENTS", file=sys.stderr)
        sys.exit(2)

    try:
        convert(sys.argv[1], sys.argv[2])
    except Exception as error:
        print(
            f"HEIC_DECODE_ERROR: {error}",
            file=sys.stderr,
        )
        sys.exit(1)
