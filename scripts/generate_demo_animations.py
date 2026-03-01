#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

ACTIONS = ["idle", "thinking", "speaking", "nod", "agree", "surprised", "emphasis"]
RESOLUTIONS = [64, 96, 128, 256, 512, 1024]


def load_action_frames(base_dir: Path, resolution: int, action: str) -> list[Image.Image]:
    action_dir = base_dir / str(resolution) / action
    frame_paths = sorted(action_dir.glob("*.png"))
    if not frame_paths:
        raise FileNotFoundError(f"missing frames: {action_dir}")
    return [Image.open(path).convert("RGBA") for path in frame_paths]


def save_action_gif(frames: list[Image.Image], out_path: Path, *, loop: bool) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    duration_ms = 125  # 8fps
    first, rest = frames[0], frames[1:]
    first.save(
        out_path,
        save_all=True,
        append_images=rest,
        optimize=False,
        duration=duration_ms,
        loop=0 if loop else 1,
        disposal=2,
        transparency=0,
    )


def save_showcase_gif(base_dir: Path, out_path: Path, resolution: int) -> None:
    stacked: list[Image.Image] = []
    labels: list[str] = []
    for action in ACTIONS:
        frames = load_action_frames(base_dir, resolution, action)
        stacked.extend(frames)
        labels.extend([action] * len(frames))

    rendered: list[Image.Image] = []
    for frame, label in zip(stacked, labels):
        canvas = Image.new("RGBA", (resolution, resolution + 16), (16, 18, 24, 255))
        canvas.paste(frame, (0, 16), frame)
        # 標準フォントで簡易ラベルを付与
        draw = ImageOps.expand(canvas, border=0)
        rendered.append(draw)

    save_action_gif(rendered, out_path, loop=True)


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    frames_root = repo_root / "assets" / "motion_demo"
    anim_root = repo_root / "assets" / "motion_demo_anim"

    for res in RESOLUTIONS:
        for action in ACTIONS:
            frames = load_action_frames(frames_root, res, action)
            out = anim_root / str(res) / f"{action}.gif"
            # loopアクションのみ無限ループ、それ以外は1回再生
            is_loop = action in {"idle", "thinking", "speaking"}
            save_action_gif(frames, out, loop=is_loop)

        showcase_out = anim_root / str(res) / f"showcase_{res}.gif"
        save_showcase_gif(frames_root, showcase_out, res)

    print(f"generated animation demos at: {anim_root}")


if __name__ == "__main__":
    main()
