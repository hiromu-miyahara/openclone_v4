#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw


DEFAULT_MODEL = "gemini-3.1-flash-image-preview"
DEFAULT_LOCATION = "global"

EXPRESSIONS: dict[str, str] = {
    "neutral_closed": (
        "Keep the same pixel-art head, same angle, same identity, same framing, same background. "
        "Expression: neutral, mouth closed."
    ),
    "smile": (
        "Keep everything exactly the same except expression. "
        "Expression: gentle smile, mouth slightly open."
    ),
    "big_smile": (
        "Keep everything exactly the same except expression. "
        "Expression: big happy smile, cheerful eyes, open mouth."
    ),
    "surprised": (
        "Keep everything exactly the same except expression. "
        "Expression: surprised, eyes wider, round open mouth."
    ),
    "tears": (
        "Keep everything exactly the same except expression. "
        "Expression: teary eyes with visible cartoon tears, sad mouth."
    ),
    "angry": (
        "Keep everything exactly the same except expression. "
        "Expression: angry, eyebrows lowered, tight mouth."
    ),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="IMG_3274から顔の複数表情セットを生成する")
    parser.add_argument("--input", type=Path, default=Path("experiments/IMG_3274.jpg"))
    parser.add_argument("--output-root", type=Path, default=Path("experiments/pixel_face_lab/output"))
    parser.add_argument("--run-name", default=f"img3274_expression_set_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    parser.add_argument("--project", default="")
    parser.add_argument("--location", default=DEFAULT_LOCATION)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-retries", type=int, default=3)
    parser.add_argument("--retry-sleep-sec", type=float, default=20.0)
    parser.add_argument("--sheet-size", type=int, default=512)
    return parser.parse_args()


def gcloud_value(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True).strip()


def call_image_api(
    *,
    project: str,
    location: str,
    model: str,
    token: str,
    input_image: Path,
    prompt: str,
    temperature: float,
    seed: int,
    max_retries: int,
    retry_sleep_sec: float,
) -> tuple[str, bytes]:
    img_b64 = base64.b64encode(input_image.read_bytes()).decode("utf-8")
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": "image/png", "data": img_b64}},
                ],
            }
        ],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
            "temperature": temperature,
            "seed": seed,
        },
    }

    url = (
        f"https://aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/"
        f"publishers/google/models/{model}:generateContent"
    )
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )

    raw = ""
    for attempt in range(max_retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=240) as resp:
                raw = resp.read().decode("utf-8")
            break
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="ignore")
            if e.code == 429 and attempt < max_retries:
                time.sleep(retry_sleep_sec * (2**attempt))
                continue
            raise RuntimeError(f"HTTP {e.code}: {err[:800]}") from e

    obj = json.loads(raw)
    img_bytes: bytes | None = None
    for cand in obj.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                img_bytes = base64.b64decode(inline["data"])
                break
        if img_bytes is not None:
            break
    if img_bytes is None:
        raise RuntimeError("画像が返ってきませんでした")
    return raw, img_bytes


def save_contact_sheet(items: list[tuple[str, Path]], out_file: Path, tile: int) -> None:
    cols = 3
    rows = (len(items) + cols - 1) // cols
    margin = 20
    label_h = 28
    canvas = Image.new(
        "RGB",
        (cols * (tile + margin) + margin, rows * (tile + label_h + margin) + margin),
        (245, 245, 245),
    )
    for i, (label, p) in enumerate(items):
        img = Image.open(p).convert("RGB").resize((tile, tile), Image.Resampling.NEAREST)
        c = i % cols
        r = i // cols
        x = margin + c * (tile + margin)
        y = margin + r * (tile + label_h + margin)
        canvas.paste(img, (x, y))
        lbl = Image.new("RGB", (tile, label_h), (245, 245, 245))
        ImageDraw.Draw(lbl).text((4, 6), label, fill=(25, 25, 25))
        canvas.paste(lbl, (x, y + tile))
    canvas.save(out_file)


def main() -> None:
    args = parse_args()
    if not args.input.exists():
        raise FileNotFoundError(f"入力画像が見つかりません: {args.input}")

    project = args.project or gcloud_value(["gcloud", "config", "get-value", "project"])
    token = gcloud_value(["gcloud", "auth", "print-access-token"])

    out_dir = args.output_root / args.run_name
    out_dir.mkdir(parents=True, exist_ok=True)

    base_prompt = (
        "Use this person as reference and generate a clean 16-bit style pixel-art head portrait, "
        "slightly turned about 15 degrees to the left, only head, no neck, no shoulders, pure white background, "
        "crisp pixel edges."
    )
    base_raw, base_img = call_image_api(
        project=project,
        location=args.location,
        model=args.model,
        token=token,
        input_image=args.input,
        prompt=base_prompt,
        temperature=args.temperature,
        seed=args.seed,
        max_retries=args.max_retries,
        retry_sleep_sec=args.retry_sleep_sec,
    )
    base_path = out_dir / "base_tilt.png"
    base_path.write_bytes(base_img)
    (out_dir / "base_raw_response.json").write_text(base_raw, encoding="utf-8")

    generated: list[tuple[str, Path]] = [("base_tilt", base_path)]
    prompt_log: dict[str, str] = {"base_tilt": base_prompt}

    for idx, (name, expr_prompt) in enumerate(EXPRESSIONS.items(), start=1):
        full_prompt = (
            "Use this exact pixel-art head as reference and keep the same angle, same identity, same hairstyle, "
            "same framing, same lighting, same background. "
            + expr_prompt
            + " Do not change head size or position."
        )
        raw, img_bytes = call_image_api(
            project=project,
            location=args.location,
            model=args.model,
            token=token,
            input_image=base_path,
            prompt=full_prompt,
            temperature=args.temperature,
            seed=args.seed + idx,
            max_retries=args.max_retries,
            retry_sleep_sec=args.retry_sleep_sec,
        )
        out_img = out_dir / f"expr_{name}.png"
        out_img.write_bytes(img_bytes)
        (out_dir / f"expr_{name}_raw_response.json").write_text(raw, encoding="utf-8")
        generated.append((name, out_img))
        prompt_log[name] = full_prompt

    save_contact_sheet(generated, out_dir / "expression_contact_sheet.png", args.sheet_size)

    meta = {
        "input": str(args.input),
        "project": project,
        "location": args.location,
        "model": args.model,
        "temperature": args.temperature,
        "seed_base": args.seed,
        "outputs": {k: str(v) for k, v in generated},
        "prompt_log": prompt_log,
    }
    (out_dir / "run_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"generated: {out_dir}")


if __name__ == "__main__":
    main()

