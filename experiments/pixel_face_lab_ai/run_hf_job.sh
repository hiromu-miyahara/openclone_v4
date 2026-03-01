#!/usr/bin/env bash
set -euo pipefail

# Hugging Face Jobs へ IP-Adapter + SDXL 実験を投げるラッパー
#
# 使い方:
#   bash experiments/pixel_face_lab_ai/run_hf_job.sh \
#     --input-url "https://.../IMG_3274.jpg" \
#     --output-repo "YOUR_NAME/pixel-face-lab-results"
#
# 必須:
# - hf CLI が使えること
# - HFログイン済み (hf auth login)

INPUT_URL=""
OUTPUT_REPO=""
RUN_NAME="hf_job_$(date +%Y%m%d_%H%M%S)"
FLAVOR="a10g-small"
TIMEOUT="2h"
USE_CANNY="false"
NAMESPACE=""
NUM_STEPS="12"
WORK_SIZE="768"
IP_SCALES="0.60"
CONTROL_SCALES="0.30"
GUIDANCE_SCALE="7.5"
STRENGTH="0.55"
PIXEL_LORA_REPO=""
PIXEL_LORA_WEIGHT=""
LORA_SCALES="0.80"
PROMPT=""
PIXEL_PROMPT=""
NEGATIVE_PROMPT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input-url)
      INPUT_URL="$2"; shift 2 ;;
    --output-repo)
      OUTPUT_REPO="$2"; shift 2 ;;
    --run-name)
      RUN_NAME="$2"; shift 2 ;;
    --flavor)
      FLAVOR="$2"; shift 2 ;;
    --timeout)
      TIMEOUT="$2"; shift 2 ;;
    --namespace)
      NAMESPACE="$2"; shift 2 ;;
    --num-steps)
      NUM_STEPS="$2"; shift 2 ;;
    --work-size)
      WORK_SIZE="$2"; shift 2 ;;
    --ip-scales)
      IP_SCALES="$2"; shift 2 ;;
    --control-scales)
      CONTROL_SCALES="$2"; shift 2 ;;
    --guidance-scale)
      GUIDANCE_SCALE="$2"; shift 2 ;;
    --strength)
      STRENGTH="$2"; shift 2 ;;
    --pixel-lora-repo)
      PIXEL_LORA_REPO="$2"; shift 2 ;;
    --pixel-lora-weight)
      PIXEL_LORA_WEIGHT="$2"; shift 2 ;;
    --lora-scales)
      LORA_SCALES="$2"; shift 2 ;;
    --prompt)
      PROMPT="$2"; shift 2 ;;
    --pixel-prompt)
      PIXEL_PROMPT="$2"; shift 2 ;;
    --negative-prompt)
      NEGATIVE_PROMPT="$2"; shift 2 ;;
    --use-canny)
      USE_CANNY="true"; shift 1 ;;
    --no-canny)
      USE_CANNY="false"; shift 1 ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1 ;;
  esac
done

if [[ -z "${INPUT_URL}" ]]; then
  echo "--input-url は必須です" >&2
  exit 1
fi

if ! command -v hf >/dev/null 2>&1; then
  echo "hf CLI が見つかりません。先にインストールしてください。" >&2
  exit 1
fi

SCRIPT_PATH="experiments/pixel_face_lab_ai/hf_job_pixel_diffusion.py"
if [[ ! -f "${SCRIPT_PATH}" ]]; then
  echo "ジョブスクリプトが見つかりません: ${SCRIPT_PATH}" >&2
  exit 1
fi

HF_CMD=(
  hf jobs uv run
  --flavor "${FLAVOR}"
  --timeout "${TIMEOUT}"
  -s HF_TOKEN
  "${SCRIPT_PATH}"
  --input-url "${INPUT_URL}"
  --run-name "${RUN_NAME}"
  --num-steps "${NUM_STEPS}"
  --guidance-scale "${GUIDANCE_SCALE}"
  --strength "${STRENGTH}"
  --work-size "${WORK_SIZE}"
  --ip-scales "${IP_SCALES}"
  --lora-scales "${LORA_SCALES}"
  --control-scales "${CONTROL_SCALES}"
)

if [[ "${USE_CANNY}" == "true" ]]; then
  HF_CMD+=(--use-canny-controlnet)
fi

if [[ -n "${OUTPUT_REPO}" ]]; then
  HF_CMD+=(--output-repo "${OUTPUT_REPO}")
fi

if [[ -n "${PIXEL_LORA_REPO}" ]]; then
  HF_CMD+=(--pixel-lora-repo "${PIXEL_LORA_REPO}")
fi

if [[ -n "${PIXEL_LORA_WEIGHT}" ]]; then
  HF_CMD+=(--pixel-lora-weight "${PIXEL_LORA_WEIGHT}")
fi

if [[ -n "${PROMPT}" ]]; then
  HF_CMD+=(--prompt "${PROMPT}")
fi

if [[ -n "${PIXEL_PROMPT}" ]]; then
  HF_CMD+=(--pixel-prompt "${PIXEL_PROMPT}")
fi

if [[ -n "${NEGATIVE_PROMPT}" ]]; then
  HF_CMD+=(--negative-prompt "${NEGATIVE_PROMPT}")
fi

if [[ -n "${NAMESPACE}" ]]; then
  HF_CMD+=(--namespace "${NAMESPACE}")
fi

echo "Submitting HF Job..."
printf 'Command: %q ' "${HF_CMD[@]}"
echo
"${HF_CMD[@]}"
