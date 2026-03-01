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


DEFAULT_MODEL = "gemini-3.1-flash-image-preview"
DEFAULT_LOCATION = "global"
DEFAULT_PROMPT = (
    "famicom-era 8-bit pixel art chibi head portrait of the same person, only head, centered face, frontal view, "
    "super deformed two-head character style, no neck, no shoulders, no body, "
    "preserve facial identity, preserve eye shape, preserve nose and mouth proportion, "
    "16-bit retro game sprite feeling (SNES era), medium-detail pixel clusters, limited color palette, "
    "hard pixel edges, minimal anti-aliasing, "
    "clean silhouette, pure white background, stable framing"
)
DEFAULT_NEGATIVE = (
    "realistic photo, full body, upper body, shoulders, neck, collarbone, hands, detailed background, scenery, black background, "
    "smooth shading, anti-aliased edges, high-resolution render, text, watermark, blurry, low quality, deformed face, extra eyes, extra face"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Vertex AI経由でNanobananaを実呼び出しする")
    parser.add_argument("--input", type=Path, required=True, help="入力画像")
    parser.add_argument("--run-name", default=f"nanobanana_live_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    parser.add_argument("--output-root", type=Path, default=Path("experiments/pixel_face_lab/output"))
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--location", default=DEFAULT_LOCATION)
    parser.add_argument("--project", default="")
    parser.add_argument("--prompt", default=DEFAULT_PROMPT)
    parser.add_argument("--negative-prompt", default=DEFAULT_NEGATIVE)
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-retries", type=int, default=3, help="429時の最大リトライ回数")
    parser.add_argument("--retry-sleep-sec", type=float, default=20.0, help="429時の初期待機秒")
    parser.add_argument("--run-fit", action="store_true", help="生成後にrun_face_fit_experiment.pyで体テンプレ合成まで実行")
    parser.add_argument("--template-res", type=int, default=128, help="--run-fit時の合成解像度")
    parser.add_argument("--fit-white-threshold", type=int, default=245, help="--run-fit時の白背景判定しきい値")
    parser.add_argument("--no-fit-resize", action="store_true", help="--run-fit時に顔を縮小せず元解像度のまま貼り込む")
    return parser.parse_args()


def gcloud_value(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True).strip()


def main() -> None:
    args = parse_args()
    if not args.input.exists():
        raise FileNotFoundError(f"入力画像が見つかりません: {args.input}")

    project = args.project or gcloud_value(["gcloud", "config", "get-value", "project"])
    token = gcloud_value(["gcloud", "auth", "print-access-token"])

    out_dir = args.output_root / args.run_name
    out_dir.mkdir(parents=True, exist_ok=True)

    img_b64 = base64.b64encode(args.input.read_bytes()).decode("utf-8")

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": args.prompt + "\nNegative prompt: " + args.negative_prompt},
                    {"inline_data": {"mime_type": "image/jpeg", "data": img_b64}},
                ],
            }
        ],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
            "temperature": args.temperature,
            "seed": args.seed,
        },
    }

    url = (
        f"https://aiplatform.googleapis.com/v1/projects/{project}/locations/{args.location}/"
        f"publishers/google/models/{args.model}:generateContent"
    )

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )

    raw = ""
    for attempt in range(args.max_retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=240) as resp:
                raw = resp.read().decode("utf-8")
            break
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="ignore")
            is_retryable = e.code == 429 and attempt < args.max_retries
            if is_retryable:
                sleep_sec = args.retry_sleep_sec * (2**attempt)
                time.sleep(sleep_sec)
                continue
            (out_dir / "http_error.txt").write_text(err, encoding="utf-8")
            raise RuntimeError(f"HTTP {e.code}: {err[:800]}") from e

    (out_dir / "raw_response.json").write_text(raw, encoding="utf-8")

    obj = json.loads(raw)
    text_parts: list[str] = []
    image_count = 0

    for ci, cand in enumerate(obj.get("candidates", []), start=1):
        for part in cand.get("content", {}).get("parts", []):
            if "text" in part:
                text_parts.append(part["text"])
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                ext = ".png" if "png" in mime else ".jpg"
                image_count += 1
                out_img = out_dir / f"nanobanana_candidate{ci}_image{image_count}{ext}"
                out_img.write_bytes(base64.b64decode(inline["data"]))

    (out_dir / "model_text.txt").write_text("\n\n".join(text_parts), encoding="utf-8")

    run_meta = {
        "project": project,
        "location": args.location,
        "model": args.model,
        "temperature": args.temperature,
        "seed": args.seed,
        "prompt": args.prompt,
        "negative_prompt": args.negative_prompt,
        "input": str(args.input),
        "image_count": image_count,
    }
    (out_dir / "request_meta.json").write_text(json.dumps(run_meta, ensure_ascii=False, indent=2), encoding="utf-8")

    if image_count == 0:
        raise RuntimeError("画像が返ってきませんでした。raw_response.jsonを確認してください。")

    print(f"generated images: {image_count}")
    print(f"output dir: {out_dir}")

    if args.run_fit:
        first_img = sorted(out_dir.glob("nanobanana_candidate*_image*"))[0]
        fit_name = f"{args.run_name}_fit"
        fit_cmd = [
            "python3",
            "experiments/pixel_face_lab/run_face_fit_experiment.py",
            "--input",
            str(first_img),
            "--run-name",
            fit_name,
            "--template-res",
            str(args.template_res),
            "--white-threshold",
            str(args.fit_white_threshold),
        ]
        if args.no_fit_resize:
            fit_cmd.append("--no-fit-resize")
        subprocess.run(fit_cmd, check=True)
        print(f"fit output: {args.output_root / fit_name}")


if __name__ == "__main__":
    main()
