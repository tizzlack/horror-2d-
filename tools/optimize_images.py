"""Shrink the figure PNGs (palette quantisation, keeps alpha and file names).

Run after tools/extract_figures.py:  python3 tools/optimize_images.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "assets" / "figures"


def optimize(path: Path) -> tuple[int, int]:
    before = path.stat().st_size
    im = Image.open(path)
    if im.mode == "P":
        return before, before  # already quantised
    q = im.convert("RGBA").quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    q.save(path, optimize=True)
    return before, path.stat().st_size


if __name__ == "__main__":
    total_before = total_after = 0
    for png in sorted(ROOT.rglob("*.png")):
        b, a = optimize(png)
        total_before += b
        total_after += a
    print(f"{total_before / 1e6:.1f} MB -> {total_after / 1e6:.1f} MB")
