#!/usr/bin/env python3
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image

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
RESOLUTIONS = [64, 96, 128, 256, 512, 1024]
FRAMES_PER_ACTION = 10

TRANSPARENT = (0, 0, 0, 0)


@dataclass(frozen=True)
class OutfitPalette:
    skin: tuple[int, int, int, int]
    top: tuple[int, int, int, int]
    inner: tuple[int, int, int, int]
    bottom: tuple[int, int, int, int]
    shoes: tuple[int, int, int, int]
    accent: tuple[int, int, int, int]


OUTFITS: dict[str, OutfitPalette] = {
    "male_formal": OutfitPalette(
        skin=(242, 196, 157, 255),
        top=(38, 62, 96, 255),
        inner=(236, 241, 248, 255),
        bottom=(40, 46, 58, 255),
        shoes=(25, 29, 38, 255),
        accent=(198, 145, 49, 255),
    ),
    "male_casual": OutfitPalette(
        skin=(242, 196, 157, 255),
        top=(60, 130, 126, 255),
        inner=(226, 236, 230, 255),
        bottom=(58, 78, 113, 255),
        shoes=(37, 44, 54, 255),
        accent=(231, 176, 66, 255),
    ),
    "female_formal": OutfitPalette(
        skin=(244, 201, 170, 255),
        top=(77, 62, 138, 255),
        inner=(242, 239, 248, 255),
        bottom=(55, 53, 93, 255),
        shoes=(34, 31, 55, 255),
        accent=(220, 169, 84, 255),
    ),
    "female_casual": OutfitPalette(
        skin=(244, 201, 170, 255),
        top=(191, 103, 110, 255),
        inner=(252, 238, 224, 255),
        bottom=(84, 112, 128, 255),
        shoes=(55, 66, 81, 255),
        accent=(243, 194, 109, 255),
    ),
}


def draw_rect(img: Image.Image, x: int, y: int, w: int, h: int, color: tuple[int, int, int, int], px: int) -> None:
    for yy in range(y * px, (y + h) * px):
        for xx in range(x * px, (x + w) * px):
            if 0 <= xx < img.width and 0 <= yy < img.height:
                img.putpixel((xx, yy), color)


def wave(frame: int, values: list[int]) -> int:
    return values[frame % len(values)]


def tone(color: tuple[int, int, int, int], delta: int, alpha: int | None = None) -> tuple[int, int, int, int]:
    r, g, b, a = color
    rr = max(0, min(255, r + delta))
    gg = max(0, min(255, g + delta))
    bb = max(0, min(255, b + delta))
    aa = a if alpha is None else max(0, min(255, alpha))
    return (rr, gg, bb, aa)


def draw_body(img: Image.Image, palette: OutfitPalette, action: str, frame: int, px: int, variant: str, unit: int) -> None:
    def u(n: int) -> int:
        return n * unit

    def r(x: int, y: int, w: int, h: int, color: tuple[int, int, int, int]) -> None:
        draw_rect(img, u(x), u(y), u(w), u(h), color, px)

    def rr(x: int, y: int, w: int, h: int, color: tuple[int, int, int, int]) -> None:
        draw_rect(img, x, y, w, h, color, px)

    idle_bob = [0, 1, 1, 2, 1, 1, 0, -1, -1, 0]
    calm_bob = [0, 0, 1, 1, 0, 0, -1, -1, 0, 0]
    active_bob = [0, 1, 2, 2, 1, 0, -1, -1, 0, 1]
    heavy_bob = [1, 1, 2, 2, 2, 1, 1, 0, 0, 1]

    bob_by_action = {
        "idle": idle_bob,
        "thinking": calm_bob,
        "speaking": active_bob,
        "nod": idle_bob,
        "agree": active_bob,
        "surprised": heavy_bob,
        "emphasis": heavy_bob,
        "sad": calm_bob,
        "happy": active_bob,
        "angry": heavy_bob,
        "confused": calm_bob,
        "greeting": active_bob,
        "wave": active_bob,
        "celebrate": heavy_bob,
        "shrug": calm_bob,
        "sleepy": calm_bob,
    }
    y_bias = 1 if action in {"sad", "sleepy"} else 0
    bob = wave(frame, bob_by_action[action])
    nod_shift = wave(frame, [0, 1, 2, 3, 2, 1, 0, 0, 0, 0]) if action == "nod" else 0
    y0 = 4 + y_bias + bob + nod_shift

    # Neck only. Head/face region is intentionally transparent for face compositing.
    r(15, y0 + 7, 2, 1, palette.skin)

    torso_x = 13
    torso_w = 6
    torso_h = 9

    if variant.startswith("female"):
        torso_x = 12
        torso_w = 8
        torso_h = 8

    r(torso_x, y0 + 8, torso_w, torso_h, palette.top)

    if variant.endswith("formal"):
        r(torso_x + (torso_w // 2) - 1, y0 + 9, 2, torso_h - 2, palette.inner)
        r(torso_x + (torso_w // 2) + 1, y0 + 9, 1, torso_h - 3, palette.accent)
    else:
        r(torso_x + 2, y0 + 10, max(2, torso_w - 4), torso_h - 3, palette.inner)

    left_arm_x = torso_x - 2
    right_arm_x = torso_x + torso_w
    left_arm_y = y0 + 10
    right_arm_y = y0 + 10

    if action in {"thinking", "confused"}:
        left_arm_y = y0 + 8
    if action in {"agree", "greeting"}:
        right_arm_y = y0 + 7
        right_arm_x += 1
    if action in {"emphasis", "celebrate"}:
        left_arm_y = y0 + 7
        right_arm_y = y0 + 7
    if action == "happy":
        left_arm_y = y0 + 8
        right_arm_y = y0 + 8
    if action == "wave":
        right_arm_y = y0 + wave(frame, [7, 6, 6, 7, 8, 7, 6, 6, 7, 8])
        right_arm_x += wave(frame, [1, 2, 2, 1, 0, 1, 2, 2, 1, 0])
    if action == "angry":
        left_arm_y = y0 + 9
        right_arm_y = y0 + 9
        left_arm_x -= 1
        right_arm_x += 1
    if action in {"sad", "sleepy"}:
        left_arm_y = y0 + 11
        right_arm_y = y0 + 11
        left_arm_x += 1
        right_arm_x -= 1
    if action == "shrug":
        left_arm_y = y0 + 9
        right_arm_y = y0 + 9
        left_arm_x += 1
        right_arm_x -= 1
    if action == "idle":
        sway = wave(frame, [-1, -1, 0, 1, 1, 0, -1, -1, 0, 1])
        left_arm_x += sway
        right_arm_x += sway

    r(left_arm_x, left_arm_y, 2, 5, palette.top)
    r(right_arm_x, right_arm_y, 2, 5, palette.top)

    if action in {"emphasis", "celebrate", "angry"}:
        r(left_arm_x - 1, left_arm_y + 1, 1, 2, palette.accent)
        r(right_arm_x + 2, right_arm_y + 1, 1, 2, palette.accent)
    if action == "shrug":
        r(torso_x + 1, y0 + 8, 1, 1, palette.accent)
        r(torso_x + torso_w - 2, y0 + 8, 1, 1, palette.accent)
    if action in {"sad", "sleepy"}:
        r(torso_x + (torso_w // 2), y0 + 15, 1, 1, palette.inner)

    step_actions = {"speaking", "emphasis", "greeting", "wave", "happy", "celebrate"}
    step_pattern = [0, 1, 2, 1, 0, -1, -2, -1, 0, 1]
    if action in {"sad", "sleepy"}:
        step_pattern = [0, 0, 1, 0, 0, -1, -1, 0, 0, 0]
    step = wave(frame, step_pattern) if action in step_actions or action in {"sad", "sleepy"} else 0

    if variant.startswith("female"):
        skirt_y = y0 + 16
        r(torso_x + 1, skirt_y, torso_w - 2, 3, palette.bottom)
        r(14, y0 + 19, 2, 4 + step, palette.bottom)
        r(16, y0 + 19, 2, 4 - step, palette.bottom)
    else:
        r(13, y0 + 16, 2, 6 + step, palette.bottom)
        r(17, y0 + 16, 2, 6 - step, palette.bottom)

    r(12, y0 + 22, 4, 2, palette.shoes)
    r(16, y0 + 22, 4, 2, palette.shoes)

    if action in {"surprised", "confused"}:
        r(torso_x - 1, y0 + 9, 1, 1, palette.accent)
        r(torso_x + torso_w, y0 + 9, 1, 1, palette.accent)

    # Additional outfit details for high-density pixel art outputs.
    if unit >= 6:
        tx = torso_x * unit
        ty = (y0 + 8) * unit
        tw = torso_w * unit
        th = torso_h * unit
        la_x = left_arm_x * unit
        la_y = left_arm_y * unit
        ra_x = right_arm_x * unit
        ra_y = right_arm_y * unit

        line_dark = tone(palette.top, -30)
        line_soft = tone(palette.top, -16)
        line_light = tone(palette.top, 24)
        stitch = tone(palette.inner, -24)
        glow = tone(palette.inner, 18)

        # Base rim and seam
        rr(tx + tw - 2, ty + 1, 2, th - 2, line_dark)
        rr(tx + 1, ty + 1, tw - 2, 1, line_light)
        rr(tx + 1, ty + th - 2, tw - 2, 1, line_soft)

        # Arm cuffs
        rr(la_x, la_y + 4 * unit, 2 * unit, 1, line_dark)
        rr(ra_x, ra_y + 4 * unit, 2 * unit, 1, line_dark)

        # Fabric texture (sparse dithering)
        for yy in range(ty + 3, ty + th - 3, 3):
            for xx in range(tx + ((yy // 3) % 2), tx + tw - 2, 4):
                rr(xx, yy, 1, 1, tone(palette.top, -10, 210))

        if variant.endswith("formal"):
            # Lapel, tie, buttons
            rr(tx + 1, ty + 2, 2 * unit, 2, line_dark)
            rr(tx + tw - 2 * unit - 1, ty + 2, 2 * unit, 2, line_dark)
            rr(tx + tw // 2 - 1, ty + 3, 2, th - 5, stitch)
            rr(tx + tw // 2 + unit // 2, ty + 4, 1, th - 6, tone(palette.accent, -18))
            rr(tx + tw // 2 - 1, ty + 8, 2, 2, tone(palette.accent, 6))
            rr(tx + tw // 2 - 1, ty + 14, 2, 2, tone(palette.accent, 6))
        else:
            # Casual zipper/neck rib and pockets
            rr(tx + tw // 2 - 1, ty + 3, 2, th - 4, stitch)
            rr(tx + 1, ty + 2, tw - 2, 1, line_soft)
            rr(tx + 2, ty + th - 7, unit + 1, 2, tone(palette.top, -22))
            rr(tx + tw - unit - 3, ty + th - 7, unit + 1, 2, tone(palette.top, -22))

        if variant.startswith("female"):
            # Skirt pleats and hem
            sy = (y0 + 16) * unit
            for px_off in [2, 4, 6]:
                rr((torso_x + px_off) * unit, sy + 1, 1, 3 * unit - 1, line_soft)
            rr((torso_x + 1) * unit, sy + 3 * unit - 1, (torso_w - 2) * unit, 1, line_dark)
        else:
            # Pants center seam
            py = (y0 + 16) * unit
            rr(15 * unit, py + 2, 1, 6 * unit, line_soft)
            rr(17 * unit, py + 2, 1, 6 * unit, line_soft)

        # Shoes highlight
        sh_y = (y0 + 22) * unit
        rr(12 * unit + 1, sh_y + 1, 4 * unit - 2, 1, glow)
        rr(16 * unit + 1, sh_y + 1, 4 * unit - 2, 1, glow)


def generate(output_root: Path, resolutions: Iterable[int] = RESOLUTIONS) -> None:
    for variant, palette in OUTFITS.items():
        for res in resolutions:
            logical_size = 192 if res >= 3072 else 32
            px = res // logical_size
            if px <= 0:
                raise ValueError(f"unsupported resolution: {res}")
            if res % logical_size != 0:
                raise ValueError(f"resolution {res} is not divisible by logical size {logical_size}")
            unit = logical_size // 32

            for action in ACTIONS:
                action_dir = output_root / variant / str(res) / action
                action_dir.mkdir(parents=True, exist_ok=True)

                for frame in range(FRAMES_PER_ACTION):
                    img = Image.new("RGBA", (res, res), TRANSPARENT)
                    draw_body(img, palette, action, frame, px, variant, unit)
                    img.save(action_dir / f"{frame + 1:04d}.png")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate face-less body templates.")
    parser.add_argument(
        "--resolutions",
        default=",".join(str(r) for r in RESOLUTIONS),
        help="comma-separated resolutions (e.g. 128,3072)",
    )
    args = parser.parse_args()
    resolutions = [int(x.strip()) for x in args.resolutions.split(",") if x.strip()]

    repo_root = Path(__file__).resolve().parents[1]
    output_root = repo_root / "assets" / "body_templates"
    generate(output_root, resolutions=resolutions)
    print(f"generated body templates at: {output_root} (resolutions={resolutions})")


if __name__ == "__main__":
    main()
