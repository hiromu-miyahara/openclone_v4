#!/usr/bin/env bash
set -euo pipefail

# IP-Adapter + SDXL のクラウドGPUクイックテスト
# 使い方:
#   bash experiments/pixel_face_lab_ai/cloud_gpu_quicktest.sh \
#     --project YOUR_PROJECT \
#     --zone asia-northeast1-a \
#     --image experiments/IMG_3274.jpg

PROJECT_ID=""
ZONE="asia-northeast1-a"
VM_NAME="pixel-face-lab-gpu-test"
MACHINE_TYPE="g2-standard-8"
GPU_TYPE="nvidia-l4"
GPU_COUNT="1"
BOOT_DISK_SIZE="200GB"
IMAGE_PATH="experiments/IMG_3274.jpg"
RUN_NAME="cloud_test_$(date +%Y%m%d_%H%M%S)"
KEEP_VM="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_ID="$2"; shift 2 ;;
    --zone)
      ZONE="$2"; shift 2 ;;
    --vm-name)
      VM_NAME="$2"; shift 2 ;;
    --machine-type)
      MACHINE_TYPE="$2"; shift 2 ;;
    --gpu-type)
      GPU_TYPE="$2"; shift 2 ;;
    --gpu-count)
      GPU_COUNT="$2"; shift 2 ;;
    --boot-disk-size)
      BOOT_DISK_SIZE="$2"; shift 2 ;;
    --image)
      IMAGE_PATH="$2"; shift 2 ;;
    --run-name)
      RUN_NAME="$2"; shift 2 ;;
    --keep-vm)
      KEEP_VM="true"; shift 1 ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1 ;;
  esac
done

if [[ -z "${PROJECT_ID}" ]]; then
  echo "--project は必須です" >&2
  exit 1
fi

if [[ ! -f "${IMAGE_PATH}" ]]; then
  echo "入力画像が見つかりません: ${IMAGE_PATH}" >&2
  exit 1
fi

REMOTE_ROOT="~/openclone_cloud_test"
REMOTE_EXP_DIR="${REMOTE_ROOT}/pixel_face_lab_ai"
LOCAL_EXP_DIR="experiments/pixel_face_lab_ai"
LOCAL_OUTPUT_DIR="${LOCAL_EXP_DIR}/output"

echo "[1/6] GPU VM を作成します: ${VM_NAME}"
gcloud compute instances create "${VM_NAME}" \
  --project "${PROJECT_ID}" \
  --zone "${ZONE}" \
  --machine-type "${MACHINE_TYPE}" \
  --accelerator "type=${GPU_TYPE},count=${GPU_COUNT}" \
  --maintenance-policy TERMINATE \
  --provisioning-model STANDARD \
  --restart-on-failure \
  --image-family "common-cu124-ubuntu-2204-nvidia-570" \
  --image-project "deeplearning-platform-release" \
  --boot-disk-size "${BOOT_DISK_SIZE}" \
  --metadata "install-nvidia-driver=True" \
  --scopes "https://www.googleapis.com/auth/cloud-platform"

echo "[2/6] 実験コードと画像を転送します"
gcloud compute ssh "${VM_NAME}" --project "${PROJECT_ID}" --zone "${ZONE}" --command "mkdir -p ${REMOTE_EXP_DIR}/input ${REMOTE_EXP_DIR}/output"
gcloud compute scp --recurse "${LOCAL_EXP_DIR}" "${VM_NAME}:${REMOTE_ROOT}" --project "${PROJECT_ID}" --zone "${ZONE}"
gcloud compute scp "${IMAGE_PATH}" "${VM_NAME}:${REMOTE_EXP_DIR}/input/source.jpg" --project "${PROJECT_ID}" --zone "${ZONE}"

echo "[3/6] リモート環境で依存をインストールします"
gcloud compute ssh "${VM_NAME}" --project "${PROJECT_ID}" --zone "${ZONE}" --command "
set -euo pipefail
cd ${REMOTE_EXP_DIR}
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
"

echo "[4/6] 生成テストを実行します"
gcloud compute ssh "${VM_NAME}" --project "${PROJECT_ID}" --zone "${ZONE}" --command "
set -euo pipefail
cd ${REMOTE_EXP_DIR}
source .venv/bin/activate
python3 run_ipadapter_pixel_diffusion.py \
  --input input/source.jpg \
  --run-name ${RUN_NAME} \
  --use-canny-controlnet \
  --ip-scales 0.6 \
  --control-scales 0.3 \
  --num-steps 20 \
  --guidance-scale 7.5 \
  --strength 0.55
"

echo "[5/6] 生成成果物をローカルへ回収します"
mkdir -p "${LOCAL_OUTPUT_DIR}"
gcloud compute scp --recurse "${VM_NAME}:${REMOTE_EXP_DIR}/output/${RUN_NAME}" "${LOCAL_OUTPUT_DIR}/" --project "${PROJECT_ID}" --zone "${ZONE}"
echo "回収完了: ${LOCAL_OUTPUT_DIR}/${RUN_NAME}"

if [[ "${KEEP_VM}" == "true" ]]; then
  echo "[6/6] --keep-vm が指定されたため VM は残します: ${VM_NAME}"
else
  echo "[6/6] VM を削除します: ${VM_NAME}"
  gcloud compute instances delete "${VM_NAME}" --project "${PROJECT_ID}" --zone "${ZONE}" --quiet
fi

echo "完了"
