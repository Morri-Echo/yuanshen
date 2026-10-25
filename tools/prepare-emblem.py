"""把新任务徽记统一到现有金色系，并生成 assets/preview 小图。

新导出的徽记底色可能不是金色（例如蓝灰）。本脚本从 assets 下现有金色徽记
提取「亮度 -> 颜色」映射表，按直方图匹配把新图标的明暗结构映射到同一套
金色色阶（主体 #C9B066 -> 高光 #DECC92），透明通道保持不变，然后原地写回，
并生成 512px 的 preview 小图。

用法：
    python tools/prepare-emblem.py assets/zhidong.png assets/chenyugu.png
    python tools/prepare-emblem.py --preview-only assets/zhidong.png

需要 Pillow：pip install pillow
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PREVIEW_DIR = ROOT / "assets" / "preview"
PREVIEW_SIZE = 512
ALPHA_THRESHOLD = 40

# 现有金色徽记，作为色阶基准
GOLD_EMBLEMS = [
    "mengdei",
    "liyue",
    "daoqi",
    "xuni",
    "fengdan",
    "nata",
    "nuodekalai",
]


def luminance(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def build_gold_palette():
    """汇总现有金色徽记的像素，得到亮度分布和逐亮度均色。"""
    pixels = []
    for name in GOLD_EMBLEMS:
        path = ROOT / "assets" / f"{name}.png"
        image = np.asarray(
            Image.open(path).convert("RGBA").resize((512, 512)), dtype=np.float64
        ).reshape(-1, 4)
        pixels.append(image[image[:, 3] > ALPHA_THRESHOLD])
    pixels = np.vstack(pixels)

    lum = luminance(pixels).astype(int).clip(0, 255)
    counts = np.bincount(lum, minlength=256).astype(np.float64)
    sums = np.stack(
        [np.bincount(lum, weights=pixels[:, c], minlength=256) for c in range(3)],
        axis=1,
    )

    known = counts > 0
    lut = np.zeros((256, 3), dtype=np.float64)
    lut[known] = sums[known] / counts[known, None]
    for c in range(3):
        lut[:, c] = np.interp(np.arange(256), np.flatnonzero(known), lut[known, c])
    return counts, lut


def recolor(path, gold_counts, gold_lut):
    """把新图标的明暗结构按旧徽记的亮度分布重排后查表上色。

    上色覆盖所有 alpha > 0 的像素（包括半透明底纹）；
    旧徽记的深浅主要靠 alpha 表现，因此透明通道原样保留。
    """
    image = np.asarray(Image.open(path).convert("RGBA"), dtype=np.float64)
    alpha = image[..., 3]
    colored = alpha > 0
    if not colored.any():
        print(f"SKIP {path}（没有可见像素）")
        return

    lum = luminance(image[..., :3])
    src_levels = lum[colored].astype(int).clip(0, 255)
    src_cdf = np.cumsum(np.bincount(src_levels, minlength=256) / src_levels.size)

    gold_cdf = np.cumsum(gold_counts / gold_counts.sum())
    gold_cdf /= gold_cdf[-1]
    # gold_cdf 含大段重复值，用 searchsorted 做逆映射：
    # 每个像素落到「累计质量覆盖它的第一个亮度档」，与旧徽记同分布
    matched = np.searchsorted(gold_cdf, src_cdf, side="left").clip(0, 255)

    out = image.copy()
    out[colored, :3] = gold_lut[matched[src_levels]]
    out[..., 3] = alpha
    Image.fromarray(out.astype(np.uint8), "RGBA").save(path)
    print(f"RECOLOR {path}")


def make_preview(path):
    image = Image.open(path).convert("RGBA")
    image.thumbnail((PREVIEW_SIZE, PREVIEW_SIZE), Image.LANCZOS)
    target = PREVIEW_DIR / path.name
    image.save(target)
    print(f"PREVIEW {target}")


def main():
    args = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
    preview_only = "--preview-only" in sys.argv
    if not args:
        print(__doc__)
        sys.exit(1)

    gold_counts, gold_lut = (None, None) if preview_only else build_gold_palette()
    for arg in args:
        path = Path(arg)
        if not path.is_file():
            print(f"NOT FOUND {path}")
            continue
        if not preview_only:
            recolor(path, gold_counts, gold_lut)
        make_preview(path)


if __name__ == "__main__":
    main()
