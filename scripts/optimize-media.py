#!/usr/bin/env python3
"""Regenerate every derived media asset under site/assets from assets-src/.

Usage:  python scripts/optimize-media.py [portraits|panorama|cover|videos ...]
Needs:  Pillow (AVIF + WebP encoders) and, for videos, `pip install imageio-ffmpeg`.
Originals live in assets-src/ (not deployed); outputs are committed under site/assets/.
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src"
OUT = ROOT / "site" / "assets"

PORTRAITS = ["elara", "cassian", "maren", "rowan"]
PORTRAIT_SIZES = [160, 320]
PANORAMA_WIDTHS = [1200, 2016]
VIDEOS = ["toga", "quran", "coming"]


def resize(im, width):
    if im.width == width:
        return im.copy()
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


def save(im, path, **kw):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, **kw)
    print(f"  {path.relative_to(ROOT)}  {path.stat().st_size:,} B")


def portraits():
    for name in PORTRAITS:
        src = Image.open(SRC / "portraits" / f"{name}.png").convert("RGB")
        for w in PORTRAIT_SIZES:
            im = resize(src, w)
            base = OUT / "portraits" / f"{name}-{w}"
            save(im, base.with_suffix(".avif"), quality=55, speed=2)
            save(im, base.with_suffix(".webp"), quality=78, method=6)
        # 320 px PNG fallback keeps the historical name; palette-quantised to stay small.
        im = resize(src, 320).quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        save(im, OUT / "portraits" / f"{name}.png", optimize=True)


def panorama():
    src = Image.open(SRC / "kingdom-panorama.png").convert("RGB")
    for w in PANORAMA_WIDTHS:
        im = resize(src, w)
        base = OUT / f"kingdom-panorama-{w}"
        save(im, base.with_suffix(".avif"), quality=50, speed=2)
        save(im, base.with_suffix(".webp"), quality=72, method=6)
    save(resize(src, 1200), OUT / "kingdom-panorama.jpg", quality=72, optimize=True, progressive=True)


def cover():
    # toga-cover.jpg (1200x629, q85, ~200 KB) is the Open Graph/Twitter/JSON-LD image.
    # The interim 64-colour site/assets/toga-cover.png was deleted once nothing referenced it.
    src = Image.open(SRC / "toga-cover.png").convert("RGB")
    # 1200 px wide (same 1732:908 aspect). Quality steps down from 85 until the file fits
    # the 300,000 B budget.
    jpg = OUT / "toga-cover.jpg"
    for q in (85, 80, 78):
        save(resize(src, 1200), jpg, quality=q, optimize=True, progressive=True)
        if jpg.stat().st_size <= 300_000:
            break
    print(f"  toga-cover.jpg quality used: {q}")


def videos():
    import imageio_ffmpeg

    ff = imageio_ffmpeg.get_ffmpeg_exe()
    for name in VIDEOS:
        src = SRC / "projects" / f"{name}.mp4"
        dst = OUT / "projects"
        dst.mkdir(parents=True, exist_ok=True)
        # Same resolution and fps; grayscale is safe because the dither reads luminance only.
        # CRF 34 (H.264) / 48 (VP9) keep the three clips near 1.2 MB each; the dither samples <=420 px.
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(src), "-an", "-vf", "format=gray",
                        "-c:v", "libx264", "-crf", "34", "-preset", "slow", "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart", str(dst / f"{name}.mp4")], check=True)
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(src), "-an", "-vf", "format=gray",
                        "-c:v", "libvpx-vp9", "-crf", "48", "-b:v", "0", "-row-mt", "1",
                        "-pix_fmt", "yuv420p", str(dst / f"{name}.webm")], check=True)
        for ext in ("mp4", "webm"):
            p = dst / f"{name}.{ext}"
            print(f"  {p.relative_to(ROOT)}  {p.stat().st_size:,} B")


if __name__ == "__main__":
    steps = {"portraits": portraits, "panorama": panorama, "cover": cover, "videos": videos}
    for step in (sys.argv[1:] or steps):
        print(step)
        steps[step]()
