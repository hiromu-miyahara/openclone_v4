#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "torch>=2.2.0",
#   "diffusers==0.30.3",
#   "transformers==4.46.3",
#   "accelerate>=0.33.0",
#   "safetensors>=0.4.0",
#   "Pillow>=10.0.0,<12.0.0",
#   "numpy>=1.26.0",
#   "opencv-python>=4.10.0",
#   "requests>=2.32.0",
#   "huggingface_hub>=0.34.0",
# ]
# ///

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from io import BytesIO
from pathlib import Path

import requests
import torch
from diffusers import (
    ControlNetModel,
    StableDiffusionXLControlNetImg2ImgPipeline,
    StableDiffusionXLImg2ImgPipeline,
)
from huggingface_hub import HfApi
from PIL import Image, ImageDraw, ImageOps


DEFAULT_PROMPT = (
    "portrait of the same person, preserve facial identity, preserve eye shape, "
    "preserve nose and mouth proportion, clean face lighting, bust shot"
)
DEFAULT_PIXEL_PROMPT = (
    "pixel art portrait of the same person, preserve facial identity, preserve eye shape, "
    "preserve nose and mouth proportion, 16-bit retro sprite style, clean edges, "
    "limited color palette, high-contrast clusters, readable face"
)
DEFAULT_NEGATIVE = (
    "blurry, noisy, low quality, extra face, extra eyes, deformed face, "
    "asymmetric eyes, text, watermark, jpeg artifacts"
)


def parse_float_list(text: str) -> list[float]:
    values = [v.strip() for v in text.split(",") if v.strip()]
    if not values:
        raise ValueError("空のリストは指定できません")
    return [float(v) for v in values]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="HF Jobs上で IP-Adapter + SDXL 顔ドット絵を生成する"
    )
    parser.add_argument("--input-url", required=True, help="入力画像URL（公開URL推奨）")
    parser.add_argument(
        "--run-name",
        default=f"hf_run_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        help="出力ディレクトリ名",
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
        help="IP-Adapter重み",
    )
    parser.add_argument("--prompt", default=DEFAULT_PROMPT, help="生成プロンプト")
    parser.add_argument(
        "--pixel-prompt",
        default=DEFAULT_PIXEL_PROMPT,
        help="Pixel LoRA適用時のプロンプト",
    )
    parser.add_argument("--negative-prompt", default=DEFAULT_NEGATIVE, help="ネガティブ")
    parser.add_argument("--num-steps", type=int, default=20)
    parser.add_argument("--guidance-scale", type=float, default=7.5)
    parser.add_argument("--strength", type=float, default=0.55)
    parser.add_argument("--ip-scales", type=str, default="0.6")
    parser.add_argument("--lora-scales", type=str, default="0.8")
    parser.add_argument("--control-scales", type=str, default="0.3")
    parser.add_argument("--use-canny-controlnet", action="store_true")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--work-size", type=int, default=1024)
    parser.add_argument("--preview-size", type=int, default=512)
    parser.add_argument(
        "--output-repo",
        default="",
        help="生成物アップロード先 Dataset repo（例: username/pixel-face-lab-results）",
    )
    parser.add_argument(
        "--output-path",
        default="jobs/pixel_face_lab_ai",
        help="Dataset repo 内の保存先パス",
    )
    parser.add_argument(
        "--pixel-lora-repo",
        default="",
        help="Pixel LoRAのrepo_id（例: owner/pixel-lora）",
    )
    parser.add_argument(
        "--pixel-lora-weight",
        default="",
        help="Pixel LoRAのweight名（例: xxx.safetensors、未指定なら自動探索）",
    )
    return parser.parse_args()


def download_image(url: str) -> Image.Image:
    res = requests.get(url, timeout=60)
    res.raise_for_status()
    return Image.open(BytesIO(res.content)).convert("RGB")


def make_square(image: Image.Image, size: int) -> Image.Image:
    return ImageOps.fit(image.convert("RGB"), (size, size), method=Image.Resampling.LANCZOS)


def make_canny_map(image: Image.Image) -> Image.Image:
    import cv2
    import numpy as np

    arr = np.array(image)
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, threshold1=90, threshold2=180)
    edges_rgb = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
    return Image.fromarray(edges_rgb)


def to_preview(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.NEAREST)


def make_contact_sheet(items: list[tuple[str, Image.Image]], dst: Path) -> None:
    tile = 512
    cols = 3
    margin = 24
    label_h = 36
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new(
        "RGB",
        (cols * (tile + margin) + margin, rows * (tile + label_h + margin) + margin),
        (245, 245, 245),
    )
    for i, (label, img) in enumerate(items):
        c = i % cols
        r = i // cols
        x = margin + c * (tile + margin)
        y = margin + r * (tile + label_h + margin)
        sheet.paste(img.resize((tile, tile), Image.Resampling.NEAREST), (x, y))
        label_img = Image.new("RGB", (tile, label_h), (245, 245, 245))
        ImageDraw.Draw(label_img).text((4, 8), label, fill=(25, 25, 25))
        sheet.paste(label_img, (x, y + tile))
    sheet.save(dst)


def build_pipeline(args: argparse.Namespace):
    is_cuda = torch.cuda.is_available()
    dtype = torch.float16 if is_cuda else torch.float32
    device = "cuda" if is_cuda else "cpu"

    if args.use_canny_controlnet:
        controlnet = ControlNetModel.from_pretrained(
            args.controlnet_model_id, torch_dtype=dtype
        )
        pipe = StableDiffusionXLControlNetImg2ImgPipeline.from_pretrained(
            args.base_model_id,
            controlnet=controlnet,
            torch_dtype=dtype,
            use_safetensors=True,
        )
    else:
        pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
            args.base_model_id, torch_dtype=dtype, use_safetensors=True
        )

    pipe = pipe.to(device)
    pipe.load_ip_adapter(
        args.ip_adapter_repo,
        subfolder="sdxl_models",
        weight_name=args.ip_adapter_weight,
    )
    return pipe, device


def load_pixel_lora(pipe, repo_id: str, weight_name: str) -> None:
    kwargs = {"adapter_name": "pixel"}
    if weight_name:
        kwargs["weight_name"] = weight_name
    pipe.load_lora_weights(repo_id, **kwargs)


def set_pixel_lora_scale(pipe, scale: float) -> None:
    try:
        pipe.set_adapters(["pixel"], adapter_weights=[scale])
    except Exception:
        # diffusersの微妙なAPI差異に備える
        pipe.set_adapters("pixel", scale)


def upload_results(out_dir: Path, repo_id: str, out_path: str) -> str:
    token = os.getenv("HF_TOKEN")
    if not token:
        raise RuntimeError("HF_TOKEN が未設定です。hf jobs 実行時に -s HF_TOKEN を指定してください。")
    api = HfApi(token=token)
    api.create_repo(repo_id=repo_id, repo_type="dataset", exist_ok=True)
    commit_info = api.upload_folder(
        repo_id=repo_id,
        repo_type="dataset",
        folder_path=str(out_dir),
        path_in_repo=f"{out_path.rstrip('/')}/{out_dir.name}",
        commit_message=f"Add pixel face lab outputs: {out_dir.name}",
    )
    return commit_info.oid


def main() -> None:
    args = parse_args()
    ip_scales = parse_float_list(args.ip_scales)
    lora_scales = parse_float_list(args.lora_scales)
    control_scales = parse_float_list(args.control_scales)

    print(f"downloading input: {args.input_url}", flush=True)
    input_image = download_image(args.input_url)
    input_sq = make_square(input_image, args.work_size)

    out_dir = Path(args.run_name).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    input_sq.save(out_dir / "input_square.png")

    print("building pipeline...", flush=True)
    pipe, device = build_pipeline(args)
    print(f"pipeline ready (device={device})", flush=True)
    generator = torch.Generator(device=device).manual_seed(args.seed)

    canny_map = None
    if args.use_canny_controlnet:
        canny_map = make_canny_map(input_sq)
        canny_map.save(out_dir / "canny_map.png")
        print("canny map generated", flush=True)

    generated: list[tuple[str, Image.Image]] = [("input_square", to_preview(input_sq, args.preview_size))]

    # まずLoRAなしのベースラインを生成
    for ip_scale in ip_scales:
        print(f"start variant batch: ip_scale={ip_scale}", flush=True)
        pipe.set_ip_adapter_scale(ip_scale)
        if args.use_canny_controlnet:
            for c_scale in control_scales:
                image = pipe(
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
                image.save(out_dir / f"{name}.png")
                generated.append((name, to_preview(image, args.preview_size)))
                print(f"generated: {name}", flush=True)
        else:
            image = pipe(
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
            image.save(out_dir / f"{name}.png")
            generated.append((name, to_preview(image, args.preview_size)))
            print(f"generated: {name}", flush=True)

    # Pixel LoRA指定時は同条件で比較生成
    if args.pixel_lora_repo:
        print(
            f"loading pixel lora: repo={args.pixel_lora_repo} weight={args.pixel_lora_weight or '(auto)'}",
            flush=True,
        )
        load_pixel_lora(pipe, args.pixel_lora_repo, args.pixel_lora_weight)
        for lora_scale in lora_scales:
            set_pixel_lora_scale(pipe, lora_scale)
            for ip_scale in ip_scales:
                print(
                    f"start pixel-lora variant: ip_scale={ip_scale}, lora_scale={lora_scale}",
                    flush=True,
                )
                pipe.set_ip_adapter_scale(ip_scale)
                if args.use_canny_controlnet:
                    for c_scale in control_scales:
                        image = pipe(
                            prompt=args.pixel_prompt,
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
                        name = f"variant_lora{lora_scale:.2f}_ip{ip_scale:.2f}_c{c_scale:.2f}"
                        image.save(out_dir / f"{name}.png")
                        generated.append((name, to_preview(image, args.preview_size)))
                        print(f"generated: {name}", flush=True)
                else:
                    image = pipe(
                        prompt=args.pixel_prompt,
                        negative_prompt=args.negative_prompt,
                        image=input_sq,
                        ip_adapter_image=input_sq,
                        strength=args.strength,
                        num_inference_steps=args.num_steps,
                        guidance_scale=args.guidance_scale,
                        generator=generator,
                    ).images[0]
                    name = f"variant_lora{lora_scale:.2f}_ip{ip_scale:.2f}"
                    image.save(out_dir / f"{name}.png")
                    generated.append((name, to_preview(image, args.preview_size)))
                    print(f"generated: {name}", flush=True)

    make_contact_sheet(generated, out_dir / "contact_sheet.png")

    meta = {
        "input_url": args.input_url,
        "run_name": args.run_name,
        "base_model_id": args.base_model_id,
        "controlnet_model_id": args.controlnet_model_id if args.use_canny_controlnet else None,
        "ip_adapter_repo": args.ip_adapter_repo,
        "ip_adapter_weight": args.ip_adapter_weight,
        "prompt": args.prompt,
        "pixel_prompt": args.pixel_prompt,
        "negative_prompt": args.negative_prompt,
        "num_steps": args.num_steps,
        "guidance_scale": args.guidance_scale,
        "strength": args.strength,
        "ip_scales": ip_scales,
        "lora_scales": lora_scales if args.pixel_lora_repo else [],
        "control_scales": control_scales if args.use_canny_controlnet else [],
        "pixel_lora_repo": args.pixel_lora_repo or None,
        "pixel_lora_weight": args.pixel_lora_weight or None,
        "use_canny_controlnet": args.use_canny_controlnet,
        "seed": args.seed,
        "work_size": args.work_size,
        "preview_size": args.preview_size,
        "generated_at": datetime.now().isoformat(),
        "job_id": os.getenv("JOB_ID", ""),
        "accelerator": os.getenv("ACCELERATOR", ""),
    }
    (out_dir / "run_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    if args.output_repo:
        oid = upload_results(out_dir, args.output_repo, args.output_path)
        print(f"uploaded to dataset repo: {args.output_repo} (commit={oid})", flush=True)
        print(
            f"results path: https://huggingface.co/datasets/{args.output_repo}/tree/main/"
            f"{args.output_path.rstrip('/')}/{args.run_name}",
            flush=True,
        )
    else:
        print("output_repo 未指定のためアップロードはスキップ", flush=True)

    print(f"local output: {out_dir}", flush=True)


if __name__ == "__main__":
    main()
