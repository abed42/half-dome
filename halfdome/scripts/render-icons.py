#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def trim_near_white(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    pixels = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 10 and (r < 245 or g < 245 or b < 245):
                found = True
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if not found:
        return im
    return im.crop((minx, miny, maxx + 1, maxy + 1))


def make_master(src: Image.Image, size: int = 1024) -> Image.Image:
    bg = (245, 241, 232, 255)
    canvas = Image.new("RGBA", (size, size), bg)
    mountain = src.copy()
    pad = int(size * 0.14)
    mountain.thumbnail((size - 2 * pad, size - 2 * pad), Image.Resampling.LANCZOS)
    x = (size - mountain.width) // 2
    y = (size - mountain.height) // 2 + int(size * 0.03)
    canvas.alpha_composite(mountain, (x, y))
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Render Half Dome macOS AppIcon sizes from halfdome/branding/icon-source.png"
    )
    parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    source = root / "halfdome" / "branding" / "icon-source.png"
    if not source.exists():
        raise SystemExit(f"missing {source}")
    master = make_master(trim_near_white(Image.open(source)))
    branding = root / "halfdome" / "branding"
    branding.mkdir(parents=True, exist_ok=True)
    master.save(branding / "icon-1024.png")
    out = (
        root
        / "apps"
        / "browser"
        / "macos"
        / "Ardia-macOS"
        / "Assets.xcassets"
        / "AppIcon.appiconset"
    )
    specs = [
        ("icon_16x16_1x.png", 16),
        ("icon_16x16_2x.png", 32),
        ("icon_32x32_1x.png", 32),
        ("icon_32x32_2x.png", 64),
        ("icon_128x128_1x.png", 128),
        ("icon_128x128_2x.png", 256),
        ("icon_256x256_1x.png", 256),
        ("icon_256x256_2x.png", 512),
        ("icon_512x512_1x.png", 512),
        ("icon_512x512_2x.png", 1024),
    ]
    for name, px in specs:
        master.resize((px, px), Image.Resampling.LANCZOS).save(out / name)
    print(f"wrote {len(specs)} icons into {out}")


if __name__ == "__main__":
    main()
