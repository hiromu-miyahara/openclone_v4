#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from collections import deque
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Gemini出力画像をそのまま使って2等身体テンプレへ合成する実験"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("experiments/IMG_3274.jpg"),
        help="入力画像",
    )
    parser.add_argument(
        "--run-name",
        default=f"face_fit_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        help="出力ディレクトリ名",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path("experiments/pixel_face_lab/output"),
        help="出力ルート",
    )
    parser.add_argument(
        "--actions",
        default="idle,speaking,thinking",
        help="合成対象アクション（カンマ区切り、allで全アクション）",
    )
    parser.add_argument(
        "--frame",
        default="0001.png",
        help="各アクションで使うフレーム名",
    )
    parser.add_argument(
        "--all-frames",
        action="store_true",
        help="各アクション配下の全PNGフレームへ合成する",
    )
    parser.add_argument(
        "--template-res",
        type=int,
        default=128,
        help="合成先テンプレ解像度（64/128/256/...）",
    )
    parser.add_argument(
        "--white-threshold",
        type=int,
        default=245,
        help="白背景判定のしきい値（RGB各チャネル）",
    )
    parser.add_argument(
        "--no-fit-resize",
        action="store_true",
        help="顔をスロットサイズへ縮小せず、元解像度のまま貼り込む",
    )
    return parser.parse_args()


def make_transparent(face_rgb: Image.Image, white_threshold: int) -> Image.Image:
    # 外周から連結している白領域だけを透過する。
    # 目の白など内側の白は連結していないため保持される。
    w, h = face_rgb.size
    src = face_rgb.load()
    alpha = Image.new("L", (w, h), 255)
    a = alpha.load()

    def is_white(x: int, y: int) -> bool:
        r, g, b = src[x, y]
        return r >= white_threshold and g >= white_threshold and b >= white_threshold

    q: deque[tuple[int, int]] = deque()
    seen = set()

    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    while q:
        x, y = q.popleft()
        if (x, y) in seen:
            continue
        seen.add((x, y))
        if x < 0 or x >= w or y < 0 or y >= h:
            continue
        if not is_white(x, y):
            continue
        a[x, y] = 0
        q.append((x + 1, y))
        q.append((x - 1, y))
        q.append((x, y + 1))
        q.append((x, y - 1))

    out = face_rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def fit_face_to_slot(face_rgba: Image.Image, slot_w: int, slot_h: int, no_fit_resize: bool) -> Image.Image:
    # 外周白透過後の画像全体をそのまま使い、比率維持で縮小するだけ。
    alpha = face_rgba.split()[-1]
    bbox = alpha.getbbox()
    work = face_rgba.crop(bbox) if bbox else face_rgba

    if no_fit_resize:
        return work

    cw, ch = work.size
    if cw <= 0 or ch <= 0:
        return Image.new("RGBA", (slot_w, slot_h), (0, 0, 0, 0))

    scale = min(slot_w / cw, slot_h / ch)
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = work.resize((nw, nh), Image.Resampling.NEAREST)

    canvas = Image.new("RGBA", (slot_w, slot_h), (0, 0, 0, 0))
    ox = (slot_w - nw) // 2
    # 首に接続しやすくするため下端合わせ
    oy = slot_h - nh
    canvas.paste(resized, (ox, oy), resized)
    return canvas


def composite_on_template(
    template_path: Path,
    fitted_face: Image.Image,
    out_path: Path,
    slot_xywh_base64: tuple[int, int, int, int] = (22, 2, 20, 20),
    no_fit_resize: bool = False,
) -> None:
    base = Image.open(template_path).convert("RGBA")
    res = base.size[0]
    scale = res / 64.0
    x, y, w, h = slot_xywh_base64
    slot = (
        int(round(x * scale)),
        int(round(y * scale)),
        int(round(w * scale)),
        int(round(h * scale)),
    )
    if no_fit_resize:
        face = fitted_face
    else:
        face = fitted_face.resize((slot[2], slot[3]), Image.Resampling.NEAREST)

    canvas = base.copy()
    # no_fit_resize時も首に接続しやすいよう、スロット下端基準で配置
    px = slot[0] + (slot[2] - face.size[0]) // 2
    py = slot[1] + (slot[3] - face.size[1])
    canvas.paste(face, (px, py), face)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path)


def save_contact_sheet(items: list[tuple[str, Image.Image]], dst: Path, tile: int = 256) -> None:
    cols = 3
    rows = (len(items) + cols - 1) // cols
    margin = 20
    label_h = 30
    canvas = Image.new(
        "RGB",
        (cols * (tile + margin) + margin, rows * (tile + label_h + margin) + margin),
        (245, 245, 245),
    )

    for i, (label, img) in enumerate(items):
        c = i % cols
        r = i // cols
        x = margin + c * (tile + margin)
        y = margin + r * (tile + label_h + margin)
        canvas.paste(img.resize((tile, tile), Image.Resampling.NEAREST), (x, y))
        lbl = Image.new("RGB", (tile, label_h), (245, 245, 245))
        ImageDraw.Draw(lbl).text((4, 8), label, fill=(30, 30, 30))
        canvas.paste(lbl, (x, y + tile))

    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst)


def main() -> None:
    args = parse_args()
    if not args.input.exists():
        raise FileNotFoundError(f"入力画像が見つかりません: {args.input}")

    if args.actions.strip().lower() == "all":
        actions = []
    else:
        actions = [a.strip() for a in args.actions.split(",") if a.strip()]
    outfits = ["male_formal", "male_casual", "female_formal", "female_casual"]

    out_dir = args.output_root / args.run_name
    out_dir.mkdir(parents=True, exist_ok=True)

    src = Image.open(args.input).convert("RGB")
    face_rgba = make_transparent(src, args.white_threshold)
    face_preview = ImageOps.contain(face_rgba, (128, 128), method=Image.Resampling.NEAREST)

    face_raw_path = out_dir / "face_rgba.png"
    face_preview_path = out_dir / "face_128_preview.png"
    face_rgba.save(face_raw_path)
    face_preview.save(face_preview_path)

    # 64基準スロット 20x20 を倍率で拡張
    slot_w = int(round(20 * (args.template_res / 64.0)))
    slot_h = int(round(20 * (args.template_res / 64.0)))
    face_fitted = fit_face_to_slot(face_rgba, slot_w, slot_h, args.no_fit_resize)
    face_fitted.save(out_dir / f"face_slot_{slot_w}x{slot_h}.png")

    composites: list[tuple[str, Image.Image]] = [
        ("face_128_preview", face_preview.convert("RGB")),
    ]

    for outfit in outfits:
        outfit_root = Path("assets/body_templates") / outfit / str(args.template_res)
        if not outfit_root.exists():
            continue
        if actions:
            action_list = actions
        else:
            action_list = sorted([d.name for d in outfit_root.iterdir() if d.is_dir()])

        for action in action_list:
            action_dir = outfit_root / action
            if not action_dir.exists():
                continue

            if args.all_frames:
                frame_paths = sorted(action_dir.glob("*.png"))
            else:
                fp = action_dir / args.frame
                frame_paths = [fp] if fp.exists() else []

            for i, template in enumerate(frame_paths):
                dst = out_dir / f"composite_{args.template_res}" / outfit / action / template.name
                composite_on_template(template, face_fitted, dst, no_fit_resize=args.no_fit_resize)
                if i == 0:
                    composites.append((f"{outfit}_{action}", Image.open(dst).convert("RGB")))

    save_contact_sheet(composites, out_dir / f"contact_sheet_composite_{args.template_res}.png", tile=256)

    meta = {
        "input": str(args.input),
        "run_name": args.run_name,
        "output_dir": str(out_dir),
        "source_size": list(src.size),
        "white_threshold": args.white_threshold,
        "actions": actions,
        "frame": args.frame,
        "outfits": outfits,
        "template_res": args.template_res,
        "template_slot_base64_xywh": [22, 2, 20, 20],
        "effective_slot_wh": [slot_w, slot_h],
        "no_fit_resize": args.no_fit_resize,
        "note": "Nanobanana出力をそのまま使用（外周白のみ透過・下端合わせ配置）",
    }
    (out_dir / "run_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"generated: {out_dir}")


if __name__ == "__main__":
    main()
