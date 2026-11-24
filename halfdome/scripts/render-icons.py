#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import io
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


C1 = (28, 58, 168)
C2 = (55, 110, 230)
C3 = (255, 120, 130)
C4 = (255, 170, 175)
COLORS = (C1, C2, C3, C4)

SEEDS = (
    (0.18, 0.72),
    (0.42, 0.38),
    (0.78, 0.55),
    (0.48, 0.88),
)

PAD_RATIO = 0.035
BORDER_RATIO = 0.055
CORNER_RATIO = 0.223


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


def rounded_mask(size: int, radius: int) -> Image.Image:
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return m


def metallic_fill(size: int) -> Image.Image:
    grad = Image.new("RGBA", (size, size))
    gp = grad.load()
    for y in range(size):
        t = y / max(1, size - 1)
        r = int(210 + (190 - 210) * t)
        g = int(214 + (194 - 214) * t)
        b = int(220 + (200 - 220) * t)
        for x in range(size):
            s = (x / max(1, size - 1) - 0.5) * 8
            gp[x, y] = (
                min(255, max(0, int(r + s))),
                min(255, max(0, int(g + s))),
                min(255, max(0, int(b + s))),
                255,
            )
    return grad


def white_border(size: int, radius: int, stroke: int) -> Image.Image:
    border = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bd = ImageDraw.Draw(border)
    inset = stroke // 2
    bd.rounded_rectangle(
        (inset, inset, size - 1 - inset, size - 1 - inset),
        radius=max(1, radius - inset // 2),
        outline=(255, 255, 255, 255),
        width=stroke,
    )
    return border


def section_labels(mark: Image.Image) -> Image.Image:
    w, h = mark.size
    mp = mark.load()
    dark = Image.new("L", (w, h), 0)
    crack = Image.new("L", (w, h), 0)
    dp, cp = dark.load(), crack.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = mp[x, y]
            if a < 8:
                continue
            if (r + g + b) / 3.0 > 170:
                cp[x, y] = 255
            else:
                dp[x, y] = 255
    barrier = crack.filter(ImageFilter.MaxFilter(3))
    bp = barrier.load()
    for y in range(h):
        for x in range(w):
            if bp[x, y]:
                dp[x, y] = 0

    seeds = []
    for u, v in SEEDS:
        sx = min(w - 1, max(0, int(u * (w - 1))))
        sy = min(h - 1, max(0, int(v * (h - 1))))
        if dp[sx, sy]:
            seeds.append((sx, sy))
            continue
        best = None
        best_d = 10**18
        for y in range(h):
            for x in range(w):
                if not dp[x, y]:
                    continue
                d = (x - sx) * (x - sx) + (y - sy) * (y - sy)
                if d < best_d:
                    best_d = d
                    best = (x, y)
        if best:
            seeds.append(best)

    labels = Image.new("L", (w, h), 0)
    lp = labels.load()
    if not seeds:
        return labels

    q: deque[tuple[int, int, int]] = deque()
    for i, (sx, sy) in enumerate(seeds, start=1):
        lp[sx, sy] = i
        q.append((sx, sy, i))
    while q:
        x, y, lab = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and dp[nx, ny] and lp[nx, ny] == 0:
                lp[nx, ny] = lab
                q.append((nx, ny, lab))

    for y in range(h):
        for x in range(w):
            if not dp[x, y] or lp[x, y]:
                continue
            best_i = 1
            best_d = 10**18
            for i, (sx, sy) in enumerate(seeds, start=1):
                d = (x - sx) * (x - sx) + (y - sy) * (y - sy)
                if d < best_d:
                    best_d = d
                    best_i = i
            lp[x, y] = best_i
    return labels


def fit_mark(mark: Image.Image, target_w: int, target_h: int, mode: str = "contain") -> Image.Image:
    m = mark.copy()
    if mode == "cover":
        scale = max(target_w / m.width, target_h / m.height)
        nw = max(1, int(round(m.width * scale)))
        nh = max(1, int(round(m.height * scale)))
        m = m.resize((nw, nh), Image.Resampling.LANCZOS)
        left = max(0, (nw - target_w) // 2)
        top = max(0, (nh - target_h) // 2)
        return m.crop((left, top, left + target_w, top + target_h))
    m.thumbnail((target_w, target_h), Image.Resampling.LANCZOS)
    return m


def colored_mark(mark: Image.Image, target_w: int, target_h: int, mode: str = "contain") -> Image.Image:
    m = fit_mark(mark, target_w, target_h, mode=mode)
    mw, mh = m.size
    labels = section_labels(m)
    lp = labels.load()
    mp = m.load()
    fill = Image.new("RGBA", (mw, mh), (0, 0, 0, 0))
    fp = fill.load()
    for y in range(mh):
        for x in range(mw):
            r, g, b, a = mp[x, y]
            if a < 8:
                continue
            lum = (r + g + b) / 3.0
            if lum > 170:
                continue
            lab = lp[x, y]
            if lab == 0:
                best_i = 1
                best_d = 10**18
                for i, (u, v) in enumerate(SEEDS, start=1):
                    sx = int(u * (mw - 1))
                    sy = int(v * (mh - 1))
                    d = (x - sx) * (x - sx) + (y - sy) * (y - sy)
                    if d < best_d:
                        best_d = d
                        best_i = i
                lab = best_i
            col = COLORS[min(lab, len(COLORS)) - 1]
            strength = max(0, min(255, int(a * (1.0 - lum / 255.0))))
            fp[x, y] = (*col, strength)

    sil = Image.new("L", (mw, mh), 0)
    sp = sil.load()
    for y in range(mh):
        for x in range(mw):
            r, g, b, a = mp[x, y]
            if a > 8 and (r + g + b) / 3 < 170:
                sp[x, y] = 255
    glow = sil.filter(ImageFilter.MaxFilter(max(3, mw // 70 | 1)))
    halo = Image.new("RGBA", (mw, mh), (0, 0, 0, 0))
    hp, gp = halo.load(), glow.load()
    for y in range(mh):
        for x in range(mw):
            if gp[x, y] and not sp[x, y]:
                hp[x, y] = (255, 255, 255, 230)
    out = Image.new("RGBA", (mw, mh), (0, 0, 0, 0))
    out = Image.alpha_composite(out, halo)
    out = Image.alpha_composite(out, fill)
    return out


def make_icon(mark: Image.Image, size: int = 1024, pad_ratio: float = PAD_RATIO) -> Image.Image:
    radius = int(size * CORNER_RATIO)
    mask = rounded_mask(size, radius)
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    icon.paste(metallic_fill(size), (0, 0))
    icon.putalpha(mask)

    stroke = max(2, int(size * BORDER_RATIO))
    border = white_border(size, radius, stroke)
    ba = ImageChops.multiply(border.split()[-1], mask)
    border.putalpha(ba)

    pad = int(size * pad_ratio)
    inner = max(8, size - 2 * pad - stroke)
    glyph = colored_mark(mark, inner, inner, mode="cover")
    ox = (size - glyph.width) // 2
    oy = (size - glyph.height) // 2
    icon.alpha_composite(glyph, (ox, oy))
    icon.alpha_composite(border, (0, 0))
    r, g, b, a = icon.split()
    return Image.merge("RGBA", (r, g, b, ImageChops.multiply(a, mask)))


def front_only(mark: Image.Image, size: int = 1024, pad_ratio: float = PAD_RATIO) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pad = int(size * pad_ratio)
    glyph = colored_mark(mark, size - 2 * pad, size - 2 * pad, mode="cover")
    canvas.alpha_composite(glyph, ((size - glyph.width) // 2, (size - glyph.height) // 2))
    return canvas


def write_svg(mark: Image.Image, path: Path) -> None:
    buf = io.BytesIO()
    mark.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    mw, mh = mark.size
    path.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'viewBox="0 0 {mw} {mh}" width="{mw}" height="{mh}">\n'
        f'  <image width="{mw}" height="{mh}" xlink:href="data:image/png;base64,{b64}"/>\n'
        f"</svg>\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Render Half Dome macOS AppIcon sizes from halfdome/branding/icon-source.png"
    )
    parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    branding = root / "halfdome" / "branding"
    source = branding / "icon-source.png"
    if not source.exists():
        raise SystemExit(f"missing {source}")

    mark = trim_near_white(Image.open(source))
    icon = make_icon(mark)
    icon.save(branding / "icon-1024.png")
    icon.save(branding / "app-icon.png")

    preview = Image.new("RGBA", (1200, 1200), (12, 12, 14, 255))
    preview.alpha_composite(icon.resize((780, 780), Image.Resampling.LANCZOS), (210, 210))
    preview.save(branding / "icon-preview.png")

    glyph = colored_mark(mark, 512, 266, mode="contain")
    glyph.save(branding / "mark-colored.png")
    ntp = root / "apps" / "browser" / "assets"
    ntp_mark = colored_mark(mark, 200, 104, mode="contain")
    ntp_mark.save(ntp / "ntp-halfdome-mark@2x.png")
    ntp_mark.resize((100, 52), Image.Resampling.LANCZOS).save(ntp / "ntp-halfdome-mark.png")

    white = Image.new("RGBA", mark.size, (0, 0, 0, 0))
    mp, wp = mark.load(), white.load()
    mw, mh = mark.size
    for y in range(mh):
        for x in range(mw):
            r, g, b, a = mp[x, y]
            if a < 8:
                continue
            lum = (r + g + b) / 3
            v = 255 - int(lum)
            wp[x, y] = (v, v, v, a)
    mark.save(branding / "logo-black.png")
    white.save(branding / "logo-white.png")
    write_svg(mark, branding / "logo.svg")

    (branding / "colors.txt").write_text(
        "order bottom-left → peak → right\n"
        f"C1 deep royal blue {C1}\n"
        f"C2 cobalt {C2}\n"
        f"C3 warm coral {C3}\n"
        f"C4 light coral {C4}\n"
        "style: Arc-like thick white border, soft grey metallic squircle\n"
        "mark: hard section fills (no smooth gradient)\n"
    )

    appicon = (
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
        icon.resize((px, px), Image.Resampling.LANCZOS).save(appicon / name)

    front = front_only(mark)
    rel = root / "apps" / "browser" / "macos" / "Ardia-macOS" / "AppIcon.icon" / "Assets"
    Image.new("RGBA", (1024, 1024), (200, 205, 212, 255)).save(rel / "back-light.png")
    Image.new("RGBA", (1024, 1024), (40, 42, 48, 255)).save(rel / "back-dark.png")
    Image.new("RGBA", (1024, 1024), (70, 72, 80, 255)).save(rel / "back-tinted.png")
    front.save(rel / "front-light.png")
    front.save(rel / "front-dark.png")
    front.save(rel / "front-tinted.png")
    empty = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    for n in ("sun-light.png", "sun-dark.png", "sun-tinted.png"):
        empty.save(rel / n)

    dev = root / "apps" / "browser" / "macos" / "Ardia-macOS" / "AppIcon-Dev.icon" / "Assets"
    Image.new("RGBA", (1024, 1024), (200, 205, 212, 255)).save(dev / "back.png")
    front.save(dev / "front.png")
    empty.save(dev / "sun.png")
    empty.save(dev / "board.png")

    print(f"wrote icon + {len(specs)} appicon sizes, pad_ratio={PAD_RATIO}")


if __name__ == "__main__":
    main()
