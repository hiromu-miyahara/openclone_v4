#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageOps


DEFAULT_PROMPT = (
    "pixel art portrait, 2d game sprite, retro 16-bit style, "
    "clean silhouette, limited color palette, frontal face"
)
DEFAULT_NEGATIVE = (
    "blurry, noisy, realistic photo style, extra face, extra eyes, low quality, text, watermark"
)


def parse_float_list(text: str) -> list[float]:
    values = [v.strip() for v in text.split(",") if v.strip()]
    if not values:
        raise ValueError("空のリストは指定できません")
    return [float(v) for v in values]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="IP-Adapter + SDXL で顔寄せドット絵を生成する実験スクリプト"
    )
    parser.add_argument("--input", type=Path, required=True, help="入力画像")
    parser.add_argument(
        "--run-name",
        default=f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        help="出力ディレクトリ名",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path(__file__).resolve().parent / "output",
        help="出力ルート",
    )
    parser.add_argument(
        "--base-model-id",
        default="stabilityai/stable-diffusion-xl-base-1.0",
        help="SDXLベースモデルID",
    )
    parser.add_argument(
        "--controlnet-model-id",
        default="diffusers/controlnet-canny-sdxl-1.0",
        help="ControlNet(Canny)モデルID",
    )
    parser.add_argument(
        "--ip-adapter-repo",
        default="h94/IP-Adapter",
        help="IP-Adapterリポジトリ",
    )
    parser.add_argument(
        "--ip-adapter-weight",
        default="ip-adapter_sdxl.bin",
        help="IP-Adapter重みファイル名",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=None,
        help="Hugging Faceモデルキャッシュディレクトリ",
    )
    parser.add_argument(
        "--local-files-only",
        action="store_true",
        help="ローカルキャッシュのみを使う（ネットワーク未使用）",
    )
    parser.add_argument(
        "--prompt",
        default=DEFAULT_PROMPT,
        help="生成プロンプト",
    )
    parser.add_argument(
        "--negative-prompt",
        default=DEFAULT_NEGATIVE,
        help="ネガティブプロンプト",
    )
    parser.add_argument("--num-steps", type=int, default=40, help="推論ステップ")
    parser.add_argument("--guidance-scale", type=float, default=7.5, help="CFG")
    parser.add_argument("--strength", type=float, default=0.55, help="img2img強度")
    parser.add_argument(
        "--ip-scales",
        type=str,
        default="0.45,0.6,0.75",
        help="IP-Adapterスケール（カンマ区切り）",
    )
    parser.add_argument(
        "--control-scales",
        type=str,
        default="0.2,0.35",
        help="ControlNet強度（カンマ区切り）",
    )
    parser.add_argument(
        "--use-canny-controlnet",
        action="store_true",
        help="ControlNet(Canny)を有効にする",
    )
    parser.add_argument("--seed", type=int, default=42, help="乱数シード")
    parser.add_argument(
        "--work-size",
        type=int,
        default=1024,
        help="入力を整形する作業解像度（正方形）",
    )
    parser.add_argument(
        "--preview-size",
        type=int,
        default=512,
        help="出力プレビューサイズ",
    )
    return parser.parse_args()


def make_square(image: Image.Image, size: int) -> Image.Image:
    image = image.convert("RGB")
    image = ImageOps.fit(image, (size, size), method=Image.Resampling.LANCZOS)
    return image


def make_canny_map(image: Image.Image) -> Image.Image:
    import cv2
    import numpy as np

    arr = np.array(image.convert("RGB"))
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, threshold1=90, threshold2=180)
    edges_rgb = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
    return Image.fromarray(edges_rgb)


def build_pipeline(args: argparse.Namespace):
    import torch
    from diffusers import (
        ControlNetModel,
        StableDiffusionXLControlNetImg2ImgPipeline,
        StableDiffusionXLImg2ImgPipeline,
    )

    is_cuda = torch.cuda.is_available()
    dtype = torch.float16 if is_cuda else torch.float32
    device = "cuda" if is_cuda else "cpu"

    controlnet = None
    if args.use_canny_controlnet:
        controlnet = ControlNetModel.from_pretrained(
            args.controlnet_model_id,
            torch_dtype=dtype,
            cache_dir=str(args.cache_dir) if args.cache_dir else None,
            local_files_only=args.local_files_only,
        )
        pipe = StableDiffusionXLControlNetImg2ImgPipeline.from_pretrained(
            args.base_model_id,
            controlnet=controlnet,
            torch_dtype=dtype,
            use_safetensors=True,
            cache_dir=str(args.cache_dir) if args.cache_dir else None,
            local_files_only=args.local_files_only,
        )
    else:
        pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
            args.base_model_id,
            torch_dtype=dtype,
            use_safetensors=True,
            cache_dir=str(args.cache_dir) if args.cache_dir else None,
            local_files_only=args.local_files_only,
        )

    pipe = pipe.to(device)
    pipe.load_ip_adapter(
        args.ip_adapter_repo,
        subfolder="sdxl_models",
        weight_name=args.ip_adapter_weight,
        cache_dir=str(args.cache_dir) if args.cache_dir else None,
        local_files_only=args.local_files_only,
    )

    return pipe, device


def to_preview(image: Image.Image, preview_size: int) -> Image.Image:
    return image.resize((preview_size, preview_size), Image.Resampling.NEAREST)


def make_contact_sheet(items: list[tuple[str, Image.Image]], output_path: Path) -> None:
    tile = 512
    cols = 3
    margin = 24
    label_h = 36
    rows = (len(items) + cols - 1) // cols
    w = cols * (tile + margin) + margin
    h = rows * (tile + label_h + margin) + margin
    sheet = Image.new("RGB", (w, h), (245, 245, 245))

    for idx, (label, img) in enumerate(items):
        c = idx % cols
        r = idx // cols
        x = margin + c * (tile + margin)
        y = margin + r * (tile + label_h + margin)
        sheet.paste(img.resize((tile, tile), Image.Resampling.NEAREST), (x, y))
        label_img = Image.new("RGB", (tile, label_h), (245, 245, 245))
        ImageDraw.Draw(label_img).text((4, 8), label, fill=(25, 25, 25))
        sheet.paste(label_img, (x, y + tile))

    sheet.save(output_path)


def main() -> None:
    args = parse_args()
    if not args.input.exists():
        raise FileNotFoundError(f"入力画像がありません: {args.input}")

    ip_scales = parse_float_list(args.ip_scales)
    control_scales = parse_float_list(args.control_scales)

    out_dir = args.output_root / args.run_name
    out_dir.mkdir(parents=True, exist_ok=True)

    input_sq = make_square(Image.open(args.input), args.work_size)
    input_sq.save(out_dir / "input_square.png")

    try:
        import torch
    except Exception as e:
        raise RuntimeError("torch が見つかりません。requirements.txt をインストールしてください。") from e

    try:
        pipe, device = build_pipeline(args)
    except Exception as e:
        raise RuntimeError(
            "Diffusers パイプライン構築に失敗しました。モデルID、依存、ネットワークまたはローカルキャッシュを確認してください。"
        ) from e

    canny_map = None
    if args.use_canny_controlnet:
        canny_map = make_canny_map(input_sq)
        canny_map.save(out_dir / "canny_map.png")

    generator = torch.Generator(device=device).manual_seed(args.seed)
    generated: list[tuple[str, Image.Image]] = [("input_square", to_preview(input_sq, args.preview_size))]

    for ip_scale in ip_scales:
        pipe.set_ip_adapter_scale(ip_scale)

        if args.use_canny_controlnet:
            for c_scale in control_scales:
                result = pipe(
                    prompt=args.prompt,
                    negative_prompt=args.negative_prompt,
                    image=input_sq,
                    control_image=canny_map,
                    ip_adapter_image=input_sq,
                    strength=args.strength,
                    num_inference_steps=args.num_steps,
                    guidance_scale=args.guidance_scale,
                    controlnet_conditioning_scale=c_scale,
                    generator=generator,
                ).images[0]
                name = f"variant_ip{ip_scale:.2f}_c{c_scale:.2f}"
                result.save(out_dir / f"{name}.png")
                generated.append((name, to_preview(result, args.preview_size)))
        else:
            result = pipe(
                prompt=args.prompt,
                negative_prompt=args.negative_prompt,
                image=input_sq,
                ip_adapter_image=input_sq,
                strength=args.strength,
                num_inference_steps=args.num_steps,
                guidance_scale=args.guidance_scale,
                generator=generator,
            ).images[0]
            name = f"variant_ip{ip_scale:.2f}"
            result.save(out_dir / f"{name}.png")
            generated.append((name, to_preview(result, args.preview_size)))

    make_contact_sheet(generated, out_dir / "contact_sheet.png")

    meta = {
        "input": str(args.input),
        "run_name": args.run_name,
        "output_dir": str(out_dir),
        "base_model_id": args.base_model_id,
        "controlnet_model_id": args.controlnet_model_id if args.use_canny_controlnet else None,
        "ip_adapter_repo": args.ip_adapter_repo,
        "ip_adapter_weight": args.ip_adapter_weight,
        "cache_dir": str(args.cache_dir) if args.cache_dir else None,
        "local_files_only": args.local_files_only,
        "prompt": args.prompt,
        "negative_prompt": args.negative_prompt,
        "num_steps": args.num_steps,
        "guidance_scale": args.guidance_scale,
        "strength": args.strength,
        "ip_scales": ip_scales,
        "control_scales": control_scales if args.use_canny_controlnet else [],
        "use_canny_controlnet": args.use_canny_controlnet,
        "seed": args.seed,
        "work_size": args.work_size,
        "preview_size": args.preview_size,
        "generated_at": datetime.now().isoformat(),
    }
    (out_dir / "run_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"generated: {out_dir}")


if __name__ == "__main__":
    main()
