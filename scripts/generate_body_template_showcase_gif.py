#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ACTIONS = [
    "idle",
    "thinking",
    "speaking",
    "nod",
    "agree",
    "surprised",
    "emphasis",
    "sad",
    "happy",
    "angry",
    "confused",
    "greeting",
    "wave",
    "celebrate",
    "shrug",
    "sleepy",
]
VARIANTS = [
    "male_formal",
    "male_casual",
    "female_formal",
    "female_casual",
]


def load_frames(base_dir: Path, variant: str, resolution: int, action: str) -> list[Image.Image]:
    action_dir = base_dir / variant / str(resolution) / action
    paths = sorted(action_dir.glob("*.png"))
    if not paths:
        raise FileNotFoundError(f"missing frames: {action_dir}")
    return [Image.open(p).convert("RGBA") for p in paths]


def label_of(variant: str) -> str:
    return {
        "male_formal": "M Formal",
        "male_casual": "M Casual",
        "female_formal": "F Formal",
        "female_casual": "F Casual",
    }[variant]


def make_showcase(base_dir: Path, out_path: Path, resolution: int = 128) -> None:
    loaded: dict[tuple[str, str], list[Image.Image]] = {}
    for variant in VARIANTS:
        for action in ACTIONS:
            loaded[(variant, action)] = load_frames(base_dir, variant, resolution, action)

    frames_per_action = len(loaded[(VARIANTS[0], ACTIONS[0])])
    timeline: list[tuple[str, int]] = []
    for action in ACTIONS:
        for i in range(frames_per_action):
            timeline.append((action, i))

    pad = 10
    title_h = 26
    panel_w = resolution
    panel_h = resolution
    canvas_w = panel_w * 2 + pad * 3
    canvas_h = title_h + panel_h * 2 + pad * 3

    rendered: list[Image.Image] = []
    positions = {
        "male_formal": (pad, title_h + pad),
        "male_casual": (pad * 2 + panel_w, title_h + pad),
        "female_formal": (pad, title_h + pad * 2 + panel_h),
        "female_casual": (pad * 2 + panel_w, title_h + pad * 2 + panel_h),
    }

    for action, frame_idx in timeline:
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (20, 22, 30, 255))
        draw = ImageDraw.Draw(canvas)
        draw.text((pad, 6), f"Body Template Showcase  {action}  frame {frame_idx + 1}/{frames_per_action}", fill=(230, 232, 236, 255))

        for variant in VARIANTS:
            x, y = positions[variant]
            panel = loaded[(variant, action)][frame_idx]
            box = Image.new("RGBA", (panel_w, panel_h), (32, 36, 48, 255))
            box.paste(panel, (0, 0), panel)
            canvas.paste(box, (x, y), box)
            draw.text((x + 4, y + 4), label_of(variant), fill=(245, 248, 252, 255))

        rendered.append(canvas)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    first, rest = rendered[0], rendered[1:]
    first.save(
        out_path,
        save_all=True,
        append_images=rest,
        optimize=False,
        duration=110,
        loop=0,
        disposal=2,
    )


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    frames_root = repo_root / "assets" / "body_templates"
    out = repo_root / "assets" / "body_templates_anim" / "showcase_all_128.gif"
    make_showcase(frames_root, out, resolution=128)
    print(f"generated: {out}")


if __name__ == "__main__":
    main()
