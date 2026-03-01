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


DEFAULT_MODEL = "gemini-2.5-flash-image"
DEFAULT_LOCATION = "global"
DEFAULT_MOTIONS = ["idle", "speaking", "nod", "agree", "surprised", "thinking"]
DEFAULT_POSE_PRESETS = Path("experiments/pixel_face_lab/fullbody_motion_pose_presets.json")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="全身ドット絵のモーションGIFをNanobananaで生成する")
    parser.add_argument("--input", type=Path, default=Path("experiments/IMG_3274.jpg"))
    parser.add_argument("--output-root", type=Path, default=Path("experiments/pixel_face_lab/output"))
    parser.add_argument("--run-name", default=f"img3274_fullbody_motion_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    parser.add_argument("--project", default="")
    parser.add_argument("--location", default=DEFAULT_LOCATION)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-retries", type=int, default=3)
    parser.add_argument("--retry-sleep-sec", type=float, default=20.0)
    parser.add_argument("--request-timeout-sec", type=float, default=120.0)
    parser.add_argument("--motions", default=",".join(DEFAULT_MOTIONS), help="カンマ区切り")
    parser.add_argument("--frames-per-motion", type=int, default=6)
    parser.add_argument("--gif-size", type=int, default=512)
    parser.add_argument("--gif-duration-ms", type=int, default=140)
    parser.add_argument("--pose-presets", type=Path, default=DEFAULT_POSE_PRESETS)
    parser.add_argument("--base-image", type=Path, default=None, help="既存の全身ベース画像を使う")
    parser.add_argument("--base-only", action="store_true", help="ベース画像のみ生成して終了")
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
    request_timeout_sec: float,
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
            with urllib.request.urlopen(req, timeout=request_timeout_sec) as resp:
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
        raise RuntimeError(f"画像が返ってきませんでした raw={raw[:500]}")
    return raw, img_bytes


def frame_instruction(
    motion: str,
    frame_idx: int,
    frames_per_motion: int,
    pose_presets: dict[str, list[str]],
) -> str:
    cycle = pose_presets.get(motion)
    if not cycle:
        cycle = [f"pose frame {i+1}" for i in range(frames_per_motion)]
    return cycle[frame_idx % len(cycle)]


def make_contact_sheet(frames: list[Path], out_file: Path, tile: int = 256) -> None:
    cols = 3
    rows = (len(frames) + cols - 1) // cols
    margin = 16
    label_h = 24
    canvas = Image.new(
        "RGB",
        (cols * (tile + margin) + margin, rows * (tile + label_h + margin) + margin),
        (245, 245, 245),
    )
    for i, p in enumerate(frames):
        img = Image.open(p).convert("RGB").resize((tile, tile), Image.Resampling.NEAREST)
        c = i % cols
        r = i // cols
        x = margin + c * (tile + margin)
        y = margin + r * (tile + label_h + margin)
        canvas.paste(img, (x, y))
        label = Image.new("RGB", (tile, label_h), (245, 245, 245))
        ImageDraw.Draw(label).text((4, 4), p.stem, fill=(20, 20, 20))
        canvas.paste(label, (x, y + tile))
    canvas.save(out_file)


def make_gif(frame_paths: list[Path], out_file: Path, size: int, duration_ms: int) -> None:
    frames = [Image.open(p).convert("RGBA").resize((size, size), Image.Resampling.NEAREST) for p in frame_paths]
    out_file.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        out_file,
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

    motions = [m.strip() for m in args.motions.split(",") if m.strip()]
    if not args.pose_presets.exists():
        raise FileNotFoundError(f"ポージング定義が見つかりません: {args.pose_presets}")
    pose_presets = json.loads(args.pose_presets.read_text(encoding="utf-8"))
    out_dir = args.output_root / args.run_name
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"[start] run={out_dir}", flush=True)

    base_img = out_dir / "base_fullbody.png"
    base_raw = out_dir / "base_raw_response.json"
    if args.base_image is not None:
        if not args.base_image.exists():
            raise FileNotFoundError(f"--base-image が見つかりません: {args.base_image}")
        if not base_img.exists():
            base_img.write_bytes(args.base_image.read_bytes())
        print(f"[base] using provided base image: {args.base_image}", flush=True)
    else:
        # Step 1: base full-body sprite
        base_prompt = (
            "Use this person as reference and generate one full-body 16-bit pixel art chibi character, "
            "super deformed two-head style, standing front view, arms visible, legs visible, only one character centered, "
            "clean silhouette, crisp pixel edges. "
            "Background must be pure black only (#000000) for every background pixel. "
            "No white background, no gray background, no gradients, no shadows, no background objects."
        )
        if not base_img.exists():
            print("[base] generating base image", flush=True)
            raw_base, img_base = call_image_api(
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
                request_timeout_sec=args.request_timeout_sec,
            )
            base_img.write_bytes(img_base)
            base_raw.write_text(raw_base, encoding="utf-8")
        else:
            print("[base] reuse existing base image", flush=True)

    frame_ref = out_dir / "base_fullbody_ref_512.jpg"
    if not frame_ref.exists():
        ref_img = Image.open(base_img).convert("RGB")
        ref_img.thumbnail((512, 512), Image.Resampling.LANCZOS)
        ref_img.save(frame_ref, format="JPEG", quality=92, optimize=True)
        print(f"[base] created frame reference: {frame_ref}", flush=True)
    else:
        print(f"[base] reuse frame reference: {frame_ref}", flush=True)

    if args.base_only:
        meta = {
            "input": str(args.input),
            "project": project,
            "location": args.location,
            "model": args.model,
            "temperature": args.temperature,
            "seed_start": args.seed,
            "base_image": str(base_img),
            "base_ref_image": str(frame_ref),
            "base_only": True,
        }
        (out_dir / "run_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"generated(base-only): {out_dir}", flush=True)
        return

    motion_meta: dict[str, dict] = {}

    # Step 2: per-motion frames from base image
    seed_cursor = args.seed + 1
    for motion in motions:
        motion_dir = out_dir / "motions" / motion
        frames_dir = motion_dir / "frames"
        frames_dir.mkdir(parents=True, exist_ok=True)
        frame_paths: list[Path] = []
        prompts: list[str] = []

        for i in range(args.frames_per_motion):
            pose_desc = frame_instruction(
                motion=motion,
                frame_idx=i,
                frames_per_motion=args.frames_per_motion,
                pose_presets=pose_presets,
            )
            out_png = frames_dir / f"{i+1:04d}.png"
            raw_json = motion_dir / f"raw_{i+1:04d}.json"
            if out_png.exists() and raw_json.exists():
                print(f"[skip] {motion} frame {i+1}/{args.frames_per_motion}", flush=True)
                frame_paths.append(out_png)
                prompts.append("")
                seed_cursor += 1
                continue

            prompt = (
                "Use this exact full-body pixel character. Keep same identity, outfit, style, and framing. "
                f"Generate motion '{motion}' frame {i+1}/{args.frames_per_motion}. "
                f"Pose: {pose_desc}. "
                "Small pose change only. Single character. "
                "Background must be pure black only (#000000) for every background pixel. "
                "No white background, no gray background, no gradients, no shadows, no background objects."
            )
            print(f"[gen] {motion} frame {i+1}/{args.frames_per_motion}", flush=True)
            raw, img_bytes = call_image_api(
                project=project,
                location=args.location,
                model=args.model,
                token=token,
                input_image=frame_ref,
                prompt=prompt,
                temperature=args.temperature,
                seed=seed_cursor,
                max_retries=args.max_retries,
                retry_sleep_sec=args.retry_sleep_sec,
                request_timeout_sec=args.request_timeout_sec,
            )
            seed_cursor += 1
            out_png.write_bytes(img_bytes)
            raw_json.write_text(raw, encoding="utf-8")
            frame_paths.append(out_png)
            prompts.append(prompt)

        gif_path = motion_dir / f"{motion}.gif"
        make_gif(frame_paths, gif_path, args.gif_size, args.gif_duration_ms)
        make_contact_sheet(frame_paths, motion_dir / "contact_sheet.png", tile=256)
        print(f"[done] {motion} gif={gif_path}", flush=True)
        motion_meta[motion] = {
            "frames_dir": str(frames_dir),
            "gif": str(gif_path),
            "frame_count": len(frame_paths),
            "prompts": prompts,
        }

    meta = {
        "input": str(args.input),
        "project": project,
        "location": args.location,
        "model": args.model,
        "temperature": args.temperature,
        "seed_start": args.seed,
        "motions": motions,
        "frames_per_motion": args.frames_per_motion,
        "pose_presets_file": str(args.pose_presets),
        "base_image": str(base_img),
        "motion_meta": motion_meta,
    }
    (out_dir / "run_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"generated: {out_dir}")


if __name__ == "__main__":
    main()
