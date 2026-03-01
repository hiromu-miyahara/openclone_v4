#!/usr/bin/env bash
set -euo pipefail

INPUT_URL=""
OUTPUT_REPO=""
RUN_NAME="hf_face_only_$(date +%Y%m%d_%H%M%S)"
FLAVOR="a10g-small"
TIMEOUT="2h"
NUM_STEPS="14"
WORK_SIZE="768"
IP_SCALES="0.70"
LORA_SCALES="0.80"
EXPRESSIONS="neutral,smile,sad,surprised,angry"
GUIDANCE_SCALE="7.0"
STRENGTH="0.55"
FACE_MARGIN="0.35"
PIXEL_LORA_REPO=""
PIXEL_LORA_WEIGHT=""
NAMESPACE=""
INCLUDE_BASELINE="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input-url) INPUT_URL="$2"; shift 2 ;;
    --output-repo) OUTPUT_REPO="$2"; shift 2 ;;
    --run-name) RUN_NAME="$2"; shift 2 ;;
    --flavor) FLAVOR="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --num-steps) NUM_STEPS="$2"; shift 2 ;;
    --work-size) WORK_SIZE="$2"; shift 2 ;;
    --ip-scales) IP_SCALES="$2"; shift 2 ;;
    --lora-scales) LORA_SCALES="$2"; shift 2 ;;
    --expressions) EXPRESSIONS="$2"; shift 2 ;;
    --guidance-scale) GUIDANCE_SCALE="$2"; shift 2 ;;
    --strength) STRENGTH="$2"; shift 2 ;;
    --face-margin) FACE_MARGIN="$2"; shift 2 ;;
    --pixel-lora-repo) PIXEL_LORA_REPO="$2"; shift 2 ;;
    --pixel-lora-weight) PIXEL_LORA_WEIGHT="$2"; shift 2 ;;
    --namespace) NAMESPACE="$2"; shift 2 ;;
    --include-baseline) INCLUDE_BASELINE="true"; shift 1 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "${INPUT_URL}" ]]; then
  echo "--input-url は必須です" >&2
  exit 1
fi

SCRIPT_PATH="experiments/pixel_face_lab_ai/hf_job_face_only_pixel.py"
if [[ ! -f "${SCRIPT_PATH}" ]]; then
  echo "ジョブスクリプトが見つかりません: ${SCRIPT_PATH}" >&2
  exit 1
fi

HF_CMD=(
  hf jobs uv run
  --flavor "${FLAVOR}"
  --timeout "${TIMEOUT}"
  --with "peft>=0.12.0"
  -s HF_TOKEN
  "${SCRIPT_PATH}"
  --input-url "${INPUT_URL}"
  --run-name "${RUN_NAME}"
  --num-steps "${NUM_STEPS}"
  --work-size "${WORK_SIZE}"
  --ip-scales "${IP_SCALES}"
  --lora-scales "${LORA_SCALES}"
  --expressions "${EXPRESSIONS}"
  --guidance-scale "${GUIDANCE_SCALE}"
  --strength "${STRENGTH}"
  --face-margin "${FACE_MARGIN}"
)

if [[ -n "${OUTPUT_REPO}" ]]; then
  HF_CMD+=(--output-repo "${OUTPUT_REPO}")
fi

if [[ -n "${PIXEL_LORA_REPO}" ]]; then
  HF_CMD+=(--pixel-lora-repo "${PIXEL_LORA_REPO}")
fi

if [[ -n "${PIXEL_LORA_WEIGHT}" ]]; then
  HF_CMD+=(--pixel-lora-weight "${PIXEL_LORA_WEIGHT}")
fi

if [[ -n "${NAMESPACE}" ]]; then
  HF_CMD+=(--namespace "${NAMESPACE}")
fi

if [[ "${INCLUDE_BASELINE}" == "true" ]]; then
  HF_CMD+=(--include-baseline)
fi

echo "Submitting HF face-only job..."
printf 'Command: %q ' "${HF_CMD[@]}"
echo
"${HF_CMD[@]}"
