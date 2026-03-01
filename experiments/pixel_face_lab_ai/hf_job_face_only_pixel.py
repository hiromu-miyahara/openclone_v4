#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "torch>=2.2.0",
#   "diffusers==0.30.3",
#   "transformers==4.46.3",
#   "peft>=0.12.0",
#   "accelerate>=0.33.0",
#   "safetensors>=0.4.0",
#   "Pillow>=10.0.0,<12.0.0",
#   "numpy>=1.26.0",
#   "opencv-python-headless>=4.10.0",
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

import numpy as np
import requests
import torch
from diffusers import StableDiffusionXLImg2ImgPipeline
from huggingface_hub import HfApi
from PIL import Image, ImageDraw, ImageOps


DEFAULT_BASE_PROMPT = (
    "game character face portrait of the same person, only head, centered face, no shoulders, no body, "
    "preserve facial identity, stylized facial proportions, clean silhouette, solid black background"
)
DEFAULT_PIXEL_PROMPT = (
    "pixel art game character face portrait of the same person, only head, centered face, no shoulders, no body, "
    "preserve facial identity, stylized facial proportions, chibi game portrait, "
    "16-bit retro sprite, clean pixel clusters, crisp outline, limited color palette, solid black background"
)
DEFAULT_NEGATIVE = (
    "realistic photo, full body, upper body, torso, shoulders, hands, detailed background, scenery, "
    "low quality, blurry, deformed face, extra eyes, extra face, text, watermark"
)
EXPRESSION_PROMPTS = {
    "neutral": "neutral expression, relaxed face",
    "smile": "gentle smile, cheerful expression",
    "sad": "sad expression, slightly downturned mouth, soft eyebrows",
    "angry": "angry expression, frowning eyebrows, tense mouth",
    "surprised": "surprised expression, widened eyes, open mouth",
}


def parse_float_list(text: str) -> list[float]:
    values = [v.strip() for v in text.split(",") if v.strip()]
    if not values:
        raise ValueError("空のリストは指定できません")
    return [float(v) for v in values]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="HF Jobs上で顔だけピクセルアートを生成する")
    parser.add_argument("--input-url", required=True)
    parser.add_argument("--run-name", default=f"face_only_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    parser.add_argument("--base-model-id", default="stabilityai/stable-diffusion-xl-base-1.0")
    parser.add_argument("--ip-adapter-repo", default="h94/IP-Adapter")
    parser.add_argument("--ip-adapter-weight", default="ip-adapter_sdxl.bin")
    parser.add_argument("--pixel-lora-repo", default="")
    parser.add_argument("--pixel-lora-weight", default="")
    parser.add_argument("--ip-scales", default="0.70")
    parser.add_argument("--lora-scales", default="0.80")
    parser.add_argument("--expressions", default="neutral,smile,sad,surprised,angry")
    parser.add_argument("--num-steps", type=int, default=14)
    parser.add_argument("--guidance-scale", type=float, default=7.0)
    parser.add_argument("--strength", type=float, default=0.55)
    parser.add_argument("--work-size", type=int, default=768)
    parser.add_argument("--preview-size", type=int, default=512)
    parser.add_argument("--face-margin", type=float, default=0.35)
    parser.add_argument("--base-prompt", default=DEFAULT_BASE_PROMPT)
    parser.add_argument("--pixel-prompt", default=DEFAULT_PIXEL_PROMPT)
    parser.add_argument("--negative-prompt", default=DEFAULT_NEGATIVE)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output-repo", default="")
    parser.add_argument("--output-path", default="jobs/pixel_face_lab_ai_face_only")
    parser.add_argument("--include-baseline", action="store_true")
    return parser.parse_args()


def download_image(url: str) -> Image.Image:
    res = requests.get(url, timeout=60)
    res.raise_for_status()
    return Image.open(BytesIO(res.content)).convert("RGB")


def detect_face_box_rgb(image: Image.Image) -> tuple[int, int, int, int] | None:
    try:
        import cv2
    except Exception:
        return None

    arr = np.array(image)
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
    if len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda b: b[2] * b[3])
    return int(x), int(y), int(w), int(h)


def crop_face_square(image: Image.Image, face_margin: float) -> tuple[Image.Image, tuple[int, int, int, int]]:
    w, h = image.size
    box = detect_face_box_rgb(image)
    if box is None:
        side = int(min(w, h) * 0.75)
        x0 = (w - side) // 2
        y0 = int((h - side) * 0.35)
        y0 = max(0, min(y0, h - side))
        return image.crop((x0, y0, x0 + side, y0 + side)), (x0, y0, side, side)

    x, y, fw, fh = box
    side = int(max(fw, fh) * (1.0 + face_margin * 2.0))
    cx = x + fw // 2
    cy = y + fh // 2
    x0 = max(0, min(cx - side // 2, w - side))
    y0 = max(0, min(cy - side // 2, h - side))
    side = max(64, min(side, min(w, h)))
    return image.crop((x0, y0, x0 + side, y0 + side)), (x0, y0, side, side)


def center_face_crop(image: Image.Image, margin: float = 0.28) -> Image.Image:
    box = detect_face_box_rgb(image)
    if box is None:
        return image
    x, y, w, h = box
    iw, ih = image.size
    side = int(max(w, h) * (1.0 + margin * 2.0))
    cx = x + w // 2
    cy = y + h // 2
    x0 = max(0, min(cx - side // 2, iw - side))
    y0 = max(0, min(cy - side // 2, ih - side))
    side = max(64, min(side, min(iw, ih)))
    return image.crop((x0, y0, x0 + side, y0 + side))


def make_square(image: Image.Image, size: int) -> Image.Image:
    return ImageOps.fit(image.convert("RGB"), (size, size), method=Image.Resampling.LANCZOS)


def to_preview(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.NEAREST)


def make_contact_sheet(items: list[tuple[str, Image.Image]], dst: Path) -> None:
    tile = 512
    cols = 3
    margin = 24
    label_h = 36
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tile + margin) + margin, rows * (tile + label_h + margin) + margin), (245, 245, 245))
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


def build_pipe(args: argparse.Namespace):
    is_cuda = torch.cuda.is_available()
    dtype = torch.float16 if is_cuda else torch.float32
    device = "cuda" if is_cuda else "cpu"
    pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
        args.base_model_id,
        torch_dtype=dtype,
        use_safetensors=True,
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
        pipe.set_adapters("pixel", scale)


def upload_results(out_dir: Path, repo_id: str, out_path: str) -> str:
    token = os.getenv("HF_TOKEN")
    if not token:
        raise RuntimeError("HF_TOKEN が未設定です。")
    api = HfApi(token=token)
    api.create_repo(repo_id=repo_id, repo_type="dataset", exist_ok=True)
    commit = api.upload_folder(
        repo_id=repo_id,
        repo_type="dataset",
        folder_path=str(out_dir),
        path_in_repo=f"{out_path.rstrip('/')}/{out_dir.name}",
        commit_message=f"Add face-only pixel outputs: {out_dir.name}",
    )
    return commit.oid


def main() -> None:
    args = parse_args()
    ip_scales = parse_float_list(args.ip_scales)
    lora_scales = parse_float_list(args.lora_scales)
    expressions = [e.strip().lower() for e in args.expressions.split(",") if e.strip()]
    if not expressions:
        raise ValueError("--expressions は1つ以上指定してください")
    for e in expressions:
        if e not in EXPRESSION_PROMPTS:
            raise ValueError(f"未対応の表情です: {e} (supported: {','.join(EXPRESSION_PROMPTS.keys())})")

    print(f"downloading input: {args.input_url}", flush=True)
    input_image = download_image(args.input_url)
    face_crop, face_crop_box = crop_face_square(input_image, args.face_margin)
    input_sq = make_square(face_crop, args.work_size)

    out_dir = Path(args.run_name).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    input_sq.save(out_dir / "input_face_square.png")

    print("building pipeline...", flush=True)
    pipe, device = build_pipe(args)
    print(f"pipeline ready (device={device})", flush=True)
    peft_available = True
    try:
        import peft  # noqa: F401
    except Exception:
        peft_available = False
    print(f"peft available: {peft_available}", flush=True)
    if args.pixel_lora_repo and not peft_available:
        raise RuntimeError("Pixel LoRAを使うにはpeftが必要です。")
    generator = torch.Generator(device=device).manual_seed(args.seed)

    generated: list[tuple[str, Image.Image]] = [("input_face_square", to_preview(input_sq, args.preview_size))]

    if args.include_baseline:
        for exp in expressions:
            exp_suffix = EXPRESSION_PROMPTS[exp]
            for ip_scale in ip_scales:
                pipe.set_ip_adapter_scale(ip_scale)
                image = pipe(
                    prompt=f"{args.base_prompt}, {exp_suffix}",
                    negative_prompt=args.negative_prompt,
                    image=input_sq,
                    ip_adapter_image=input_sq,
                    strength=args.strength,
                    num_inference_steps=args.num_steps,
                    guidance_scale=args.guidance_scale,
                    generator=generator,
                ).images[0]
                image_face = make_square(center_face_crop(image), args.preview_size)
                name = f"baseline_{exp}_ip{ip_scale:.2f}"
                image.save(out_dir / f"{name}_full.png")
                image_face.save(out_dir / f"{name}_face_only.png")
                generated.append((f"{name}_face_only", to_preview(image_face, args.preview_size)))
                print(f"generated: {name}", flush=True)

    if args.pixel_lora_repo:
        print(f"loading pixel lora: {args.pixel_lora_repo}", flush=True)
        load_pixel_lora(pipe, args.pixel_lora_repo, args.pixel_lora_weight)
        for lora_scale in lora_scales:
            set_pixel_lora_scale(pipe, lora_scale)
            for exp in expressions:
                exp_suffix = EXPRESSION_PROMPTS[exp]
                for ip_scale in ip_scales:
                    pipe.set_ip_adapter_scale(ip_scale)
                    image = pipe(
                        prompt=f"{args.pixel_prompt}, {exp_suffix}",
                        negative_prompt=args.negative_prompt,
                        image=input_sq,
                        ip_adapter_image=input_sq,
                        strength=args.strength,
                        num_inference_steps=args.num_steps,
                        guidance_scale=args.guidance_scale,
                        generator=generator,
                    ).images[0]
                    image_face = make_square(center_face_crop(image), args.preview_size)
                    name = f"pixel_{exp}_lora{lora_scale:.2f}_ip{ip_scale:.2f}"
                    image.save(out_dir / f"{name}_full.png")
                    image_face.save(out_dir / f"{name}_face_only.png")
                    generated.append((f"{name}_face_only", to_preview(image_face, args.preview_size)))
                    print(f"generated: {name}", flush=True)

    make_contact_sheet(generated, out_dir / "contact_sheet_face_only.png")

    meta = {
        "input_url": args.input_url,
        "run_name": args.run_name,
        "base_model_id": args.base_model_id,
        "ip_adapter_repo": args.ip_adapter_repo,
        "ip_adapter_weight": args.ip_adapter_weight,
        "pixel_lora_repo": args.pixel_lora_repo or None,
        "pixel_lora_weight": args.pixel_lora_weight or None,
        "ip_scales": ip_scales,
        "lora_scales": lora_scales if args.pixel_lora_repo else [],
        "expressions": expressions,
        "num_steps": args.num_steps,
        "guidance_scale": args.guidance_scale,
        "strength": args.strength,
        "work_size": args.work_size,
        "preview_size": args.preview_size,
        "face_margin": args.face_margin,
        "face_crop_box_xywh": face_crop_box,
        "base_prompt": args.base_prompt,
        "pixel_prompt": args.pixel_prompt,
        "negative_prompt": args.negative_prompt,
        "include_baseline": args.include_baseline,
        "generated_at": datetime.now().isoformat(),
        "job_id": os.getenv("JOB_ID", ""),
        "accelerator": os.getenv("ACCELERATOR", ""),
    }
    (out_dir / "run_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.output_repo:
        oid = upload_results(out_dir, args.output_repo, args.output_path)
        print(f"uploaded to dataset repo: {args.output_repo} (commit={oid})", flush=True)
        print(
            f"results path: https://huggingface.co/datasets/{args.output_repo}/tree/main/"
            f"{args.output_path.rstrip('/')}/{args.run_name}",
            flush=True,
        )

    print(f"local output: {out_dir}", flush=True)


if __name__ == "__main__":
    main()
