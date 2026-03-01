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

from PIL import Image


DEFAULT_MODEL = "gemini-3.1-flash-image-preview"
DEFAULT_LOCATION = "global"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="IMG_3274から2段生成で口パクGIFを作る")
    parser.add_argument("--input", type=Path, default=Path("experiments/IMG_3274.jpg"))
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path("experiments/pixel_face_lab/output"),
    )
    parser.add_argument(
        "--run-name",
        default=f"img3274_mouth_anim_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
    )
    parser.add_argument("--project", default="")
    parser.add_argument("--location", default=DEFAULT_LOCATION)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-retries", type=int, default=3)
    parser.add_argument("--retry-sleep-sec", type=float, default=20.0)
    parser.add_argument("--gif-size", type=int, default=512)
    parser.add_argument("--gif-duration-ms", type=int, default=180)
    return parser.parse_args()


def gcloud_value(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True).strip()


def request_image(
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
            is_retryable = e.code == 429 and attempt < max_retries
            if is_retryable:
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


def save_gif(frame_a: Path, frame_b: Path, out_gif: Path, size: int, duration_ms: int) -> None:
    a = Image.open(frame_a).convert("RGBA")
    b = Image.open(frame_b).convert("RGBA")
    a = a.resize((size, size), Image.Resampling.NEAREST)
    b = b.resize((size, size), Image.Resampling.NEAREST)
    frames = [a, b, a, b, a, b]
    out_gif.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        out_gif,
        save_all=True,
        append_images=frames[1:],
        duration=duration_ms,
        loop=0,
        disposal=2,
    )


def main() -> None:
    args = parse_args()
    if not args.input.exists():
        raise FileNotFoundError(f"入力画像が見つかりません: {args.input}")

    project = args.project or gcloud_value(["gcloud", "config", "get-value", "project"])
    token = gcloud_value(["gcloud", "auth", "print-access-token"])

    out_dir = args.output_root / args.run_name
    out_dir.mkdir(parents=True, exist_ok=True)

    prompt_1 = (
        "Use this person as reference and generate a clean 16-bit style pixel-art character head portrait, "
        "slightly turned about 15 degrees to the left (3/4-ish), mouth closed, calm expression, "
        "only head, no neck, no shoulders, pure white background, crisp pixel edges."
    )
    raw1, img1 = request_image(
        project=project,
        location=args.location,
        model=args.model,
        token=token,
        input_image=args.input,
        prompt=prompt_1,
        temperature=args.temperature,
        seed=args.seed,
        max_retries=args.max_retries,
        retry_sleep_sec=args.retry_sleep_sec,
    )
    (out_dir / "step1_raw_response.json").write_text(raw1, encoding="utf-8")
    step1_path = out_dir / "step1_tilt_closed.png"
    step1_path.write_bytes(img1)

    prompt_2 = (
        "Use this exact pixel-art head as reference and keep the same angle, same identity, same hairstyle, "
        "same lighting, same framing, same background. Only change expression to mouth open as if saying 'ah'. "
        "Do not change head size or position. only head, pure white background."
    )
    raw2, img2 = request_image(
        project=project,
        location=args.location,
        model=args.model,
        token=token,
        input_image=step1_path,
        prompt=prompt_2,
        temperature=args.temperature,
        seed=args.seed + 1,
        max_retries=args.max_retries,
        retry_sleep_sec=args.retry_sleep_sec,
    )
    (out_dir / "step2_raw_response.json").write_text(raw2, encoding="utf-8")
    step2_path = out_dir / "step2_tilt_open.png"
    step2_path.write_bytes(img2)

    gif_path = out_dir / "mouth_pakupaku.gif"
    save_gif(step1_path, step2_path, gif_path, args.gif_size, args.gif_duration_ms)

    meta = {
        "input": str(args.input),
        "project": project,
        "location": args.location,
        "model": args.model,
        "temperature": args.temperature,
        "seed_step1": args.seed,
        "seed_step2": args.seed + 1,
        "step1_image": str(step1_path),
        "step2_image": str(step2_path),
        "gif": str(gif_path),
        "gif_size": args.gif_size,
        "gif_duration_ms": args.gif_duration_ms,
    }
    (out_dir / "run_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"generated: {out_dir}")


if __name__ == "__main__":
    main()

