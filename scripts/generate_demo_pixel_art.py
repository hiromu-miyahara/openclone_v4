#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image

ACTIONS = ["idle", "thinking", "speaking", "nod", "agree", "surprised", "emphasis"]
RESOLUTIONS = [64, 96, 128, 256, 512, 1024]
FRAMES_PER_ACTION = 3

PALETTE = {
    "bg": (0, 0, 0, 0),
    "hair": (43, 43, 52, 255),
    "skin": (242, 196, 157, 255),
    "jacket": (47, 91, 173, 255),
    "shirt": (231, 236, 246, 255),
    "pants": (52, 56, 70, 255),
    "shoe": (28, 32, 44, 255),
    "eye": (18, 20, 24, 255),
    "mouth": (170, 72, 72, 255),
    "accent": (255, 205, 74, 255),
}


def draw_rect(img: Image.Image, x: int, y: int, w: int, h: int, color: tuple[int, int, int, int], px: int) -> None:
    for yy in range(y * px, (y + h) * px):
        for xx in range(x * px, (x + w) * px):
            if 0 <= xx < img.width and 0 <= yy < img.height:
                img.putpixel((xx, yy), color)


def draw_avatar(img: Image.Image, action: str, frame: int, px: int) -> None:
    bob = [0, 1, 0][frame]
    nod_shift = [0, 1, 2][frame] if action == "nod" else 0
    y0 = 4 + bob + nod_shift

    # Head / hair
    draw_rect(img, 12, y0 + 0, 8, 2, PALETTE["hair"], px)
    draw_rect(img, 11, y0 + 2, 10, 4, PALETTE["skin"], px)
    draw_rect(img, 11, y0 + 2, 10, 1, PALETTE["hair"], px)

    eye_y = y0 + 4
    if action == "thinking":
        draw_rect(img, 13, eye_y, 1, 1, PALETTE["eye"], px)
        draw_rect(img, 17, eye_y, 1, 1, PALETTE["eye"], px)
        draw_rect(img, 16, eye_y - 1, 1, 1, PALETTE["accent"], px)
    elif action == "surprised":
        draw_rect(img, 13, eye_y - 1, 2, 2, PALETTE["eye"], px)
        draw_rect(img, 17, eye_y - 1, 2, 2, PALETTE["eye"], px)
        draw_rect(img, 15, eye_y + 2, 2, 2, PALETTE["mouth"], px)
    else:
        draw_rect(img, 13, eye_y, 2, 1, PALETTE["eye"], px)
        draw_rect(img, 17, eye_y, 2, 1, PALETTE["eye"], px)

    if action == "speaking":
        mouth_h = [1, 2, 1][frame]
        draw_rect(img, 15, y0 + 7, 2, mouth_h, PALETTE["mouth"], px)
    elif action == "agree":
        draw_rect(img, 14, y0 + 7, 4, 1, PALETTE["mouth"], px)
    elif action != "surprised":
        draw_rect(img, 15, y0 + 7, 2, 1, PALETTE["mouth"], px)

    # Torso
    draw_rect(img, 13, y0 + 8, 6, 8, PALETTE["jacket"], px)
    draw_rect(img, 15, y0 + 9, 2, 5, PALETTE["shirt"], px)

    # Arms
    left_arm_y = y0 + 10
    right_arm_y = y0 + 10
    left_arm_x = 11
    right_arm_x = 19

    if action == "thinking":
        left_arm_y = y0 + 8
    if action == "agree":
        right_arm_y = y0 + 7
        right_arm_x = 20
    if action == "emphasis":
        left_arm_y = y0 + 7
        right_arm_y = y0 + 7
    if action == "idle":
        sway = [-1, 0, 1][frame]
        left_arm_x += sway
        right_arm_x += sway

    draw_rect(img, left_arm_x, left_arm_y, 2, 5, PALETTE["jacket"], px)
    draw_rect(img, right_arm_x, right_arm_y, 2, 5, PALETTE["jacket"], px)

    if action == "emphasis":
        draw_rect(img, 9, y0 + 8, 2, 2, PALETTE["accent"], px)
        draw_rect(img, 21, y0 + 8, 2, 2, PALETTE["accent"], px)

    # Legs
    step = [0, 1, 0][frame] if action in {"speaking", "emphasis"} else 0
    draw_rect(img, 13, y0 + 16, 2, 6 + step, PALETTE["pants"], px)
    draw_rect(img, 17, y0 + 16, 2, 6 - step, PALETTE["pants"], px)

    # Shoes
    draw_rect(img, 12, y0 + 22, 4, 2, PALETTE["shoe"], px)
    draw_rect(img, 16, y0 + 22, 4, 2, PALETTE["shoe"], px)


def generate(output_root: Path, resolutions: Iterable[int] = RESOLUTIONS) -> None:
    for res in resolutions:
        px = res // 32
        if px <= 0:
            raise ValueError(f"unsupported resolution: {res}")

        for action in ACTIONS:
            action_dir = output_root / str(res) / action
            action_dir.mkdir(parents=True, exist_ok=True)

            for frame in range(FRAMES_PER_ACTION):
                img = Image.new("RGBA", (res, res), PALETTE["bg"])
                draw_avatar(img, action, frame, px)
                img.save(action_dir / f"{frame + 1:04d}.png")


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    output_root = repo_root / "assets" / "motion_demo"
    generate(output_root)
    print(f"generated demo sprites at: {output_root}")


if __name__ == "__main__":
    main()
