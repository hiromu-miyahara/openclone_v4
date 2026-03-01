#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import NamedTuple

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps


class Variant(NamedTuple):
    name: str
    pixel_size: int
    colors: int
    dither: int
    edge: bool
    contrast: float


DEFAULT_VARIANTS = [
    Variant("soft_32px_24c", 32, 24, Image.Dither.FLOYDSTEINBERG, False, 1.05),
    Variant("clean_32px_16c", 32, 16, Image.Dither.NONE, False, 1.10),
    Variant("retro_24px_12c", 24, 12, Image.Dither.NONE, False, 1.20),
    Variant("outline_24px_16c", 24, 16, Image.Dither.NONE, True, 1.10),
    Variant("chunky_20px_10c", 20, 10, Image.Dither.NONE, False, 1.25),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="入力画像から顔ドット絵の複数方式を生成する実験スクリプト"
    )
    parser.add_argument("--input", required=True, type=Path, help="入力画像パス")
    parser.add_argument(
        "--run-name",
        default=f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        help="出力先ディレクトリ名",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path(__file__).resolve().parent / "output",
        help="出力ルートディレクトリ",
    )
    parser.add_argument(
        "--face-box",
        type=str,
        default="",
        help="手動顔領域 x,y,w,h（例: 120,80,360,360）",
    )
    parser.add_argument(
        "--focus-y",
        type=float,
        default=0.42,
        help="自動切り出し時の顔中心Y比率（0.0-1.0）",
    )
    parser.add_argument(
        "--crop-ratio",
        type=float,
        default=0.78,
        help="自動切り出し時の正方形比率（短辺に対する割合）",
    )
    parser.add_argument(
        "--canvas-size",
        type=int,
        default=256,
        help="切り出し顔の正規化サイズ（最終ドット化前）",
    )
    parser.add_argument(
        "--preview-size",
        type=int,
        default=512,
        help="出力画像の見やすい拡大サイズ",
    )
    return parser.parse_args()


def parse_face_box(face_box: str) -> tuple[int, int, int, int] | None:
    if not face_box:
        return None
    parts = [p.strip() for p in face_box.split(",")]
    if len(parts) != 4:
        raise ValueError("--face-box は x,y,w,h 形式で指定してください")
    x, y, w, h = [int(p) for p in parts]
    if w <= 0 or h <= 0:
        raise ValueError("--face-box の w,h は正の値にしてください")
    return x, y, w, h


def clamp_box(
    x: int, y: int, w: int, h: int, image_w: int, image_h: int
) -> tuple[int, int, int, int]:
    x = max(0, min(x, image_w - 1))
    y = max(0, min(y, image_h - 1))
    w = max(1, min(w, image_w - x))
    h = max(1, min(h, image_h - y))
    return x, y, w, h


def auto_crop_square(
    image: Image.Image, focus_y: float, crop_ratio: float
) -> tuple[Image.Image, tuple[int, int, int, int]]:
    w, h = image.size
    side = int(min(w, h) * crop_ratio)
    side = max(32, min(side, min(w, h)))

    cx = w // 2
    cy = int(h * focus_y)

    x0 = cx - side // 2
    y0 = cy - side // 2
    x0 = max(0, min(x0, w - side))
    y0 = max(0, min(y0, h - side))

    crop = image.crop((x0, y0, x0 + side, y0 + side))
    return crop, (x0, y0, side, side)


def manual_crop(image: Image.Image, box: tuple[int, int, int, int]) -> tuple[Image.Image, tuple[int, int, int, int]]:
    x, y, w, h = clamp_box(*box, *image.size)
    side = min(w, h)
    crop = image.crop((x, y, x + side, y + side))
    return crop, (x, y, side, side)


def preprocess(face: Image.Image, canvas_size: int) -> Image.Image:
    face = face.convert("RGB")
    face = ImageOps.fit(face, (canvas_size, canvas_size), method=Image.Resampling.LANCZOS)
    face = ImageOps.autocontrast(face, cutoff=1)
    face = ImageEnhance.Sharpness(face).enhance(1.2)
    return face


def pixelize(face: Image.Image, variant: Variant, preview_size: int) -> Image.Image:
    small = face.resize((variant.pixel_size, variant.pixel_size), Image.Resampling.LANCZOS)
    small = ImageEnhance.Contrast(small).enhance(variant.contrast)
    small_q = small.quantize(colors=variant.colors, method=Image.Quantize.FASTOCTREE, dither=variant.dither)
    small_rgb = small_q.convert("RGB")

    if variant.edge:
        edges = small_rgb.filter(ImageFilter.FIND_EDGES).convert("L")
        edges = edges.point(lambda p: 255 if p > 40 else 0)
        edge_rgba = Image.new("RGBA", small_rgb.size, (0, 0, 0, 0))
        edge_rgba.putalpha(edges)
        base = small_rgb.convert("RGBA")
        small_rgb = Image.alpha_composite(base, edge_rgba).convert("RGB")

    return small_rgb.resize((preview_size, preview_size), Image.Resampling.NEAREST)


def save_contact_sheet(
    images: list[tuple[str, Image.Image]], dst: Path, tile_size: int = 512
) -> None:
    cols = 3
    rows = (len(images) + cols - 1) // cols
    margin = 24
    label_h = 36
    sheet_w = cols * (tile_size + margin) + margin
    sheet_h = rows * (tile_size + label_h + margin) + margin
    sheet = Image.new("RGB", (sheet_w, sheet_h), (245, 245, 245))

    for i, (label, img) in enumerate(images):
        c = i % cols
        r = i // cols
        x = margin + c * (tile_size + margin)
        y = margin + r * (tile_size + label_h + margin)
        sheet.paste(img.resize((tile_size, tile_size), Image.Resampling.NEAREST), (x, y))
        # Pillow標準フォントを使い、依存を増やさない
        text_img = Image.new("RGB", (tile_size, label_h), (245, 245, 245))
        draw = ImageDraw.Draw(text_img)
        draw.text((4, 8), label, fill=(30, 30, 30))
        sheet.paste(text_img, (x, y + tile_size))
    sheet.save(dst)


def main() -> None:
    args = parse_args()
    if not args.input.exists():
        raise FileNotFoundError(f"入力画像が見つかりません: {args.input}")
    if not (0.0 <= args.focus_y <= 1.0):
        raise ValueError("--focus-y は 0.0-1.0 の範囲で指定してください")
    if not (0.2 <= args.crop_ratio <= 1.0):
        raise ValueError("--crop-ratio は 0.2-1.0 の範囲で指定してください")

    out_dir = args.output_root / args.run_name
    out_dir.mkdir(parents=True, exist_ok=True)

    img = Image.open(args.input).convert("RGB")
    box = parse_face_box(args.face_box)
    if box is None:
        face_crop, crop_info = auto_crop_square(img, args.focus_y, args.crop_ratio)
        crop_mode = "auto"
    else:
        face_crop, crop_info = manual_crop(img, box)
        crop_mode = "manual"

    face_base = preprocess(face_crop, args.canvas_size)
    face_base_preview = face_base.resize(
        (args.preview_size, args.preview_size), Image.Resampling.NEAREST
    )
    face_base_preview.save(out_dir / "face_crop.png")

    contact_images: list[tuple[str, Image.Image]] = [("face_crop", face_base_preview)]
    for variant in DEFAULT_VARIANTS:
        result = pixelize(face_base, variant, args.preview_size)
        name = f"variant_{variant.name}"
        result.save(out_dir / f"{name}.png")
        contact_images.append((name, result))

    save_contact_sheet(contact_images, out_dir / "contact_sheet.png", tile_size=args.preview_size)

    meta = {
        "input": str(args.input),
        "run_name": args.run_name,
        "output_dir": str(out_dir),
        "crop_mode": crop_mode,
        "crop_box_xywh": crop_info,
        "focus_y": args.focus_y,
        "crop_ratio": args.crop_ratio,
        "canvas_size": args.canvas_size,
        "preview_size": args.preview_size,
        "variants": [v._asdict() for v in DEFAULT_VARIANTS],
    }
    (out_dir / "run_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"generated: {out_dir}")


if __name__ == "__main__":
    main()
