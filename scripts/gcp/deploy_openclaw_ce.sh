#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-macro-resolver-488810-p8}"
REGION="${REGION:-asia-northeast1}"
ZONE="${ZONE:-asia-northeast1-a}"
REPO_NAME="${REPO_NAME:-openclone}"
IMAGE_NAME="${IMAGE_NAME:-openclaw-service}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
INSTANCE_NAME="${INSTANCE_NAME:-openclaw-be2}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-openclaw-vm-sa}"
MISTRAL_MODEL="${MISTRAL_MODEL:-ministral-8b-2410}"
OPENCLAW_PORT="${OPENCLAW_PORT:-8080}"
ALLOW_PUBLIC_INGRESS="${ALLOW_PUBLIC_INGRESS:-false}"
PUBLIC_SOURCE_RANGES="${PUBLIC_SOURCE_RANGES:-}"

AR_HOST="${REGION}-docker.pkg.dev"
IMAGE_URI="${AR_HOST}/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${IMAGE_TAG}"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "[1/7] API有効化"
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  compute.googleapis.com \
  secretmanager.googleapis.com \
  --project "${PROJECT_ID}" >/dev/null

echo "[2/7] Artifact Registry作成（存在しない場合）"
if ! gcloud artifacts repositories describe "${REPO_NAME}" --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO_NAME}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="OpenClone container images" \
    --project "${PROJECT_ID}" >/dev/null
fi

echo "[3/7] OpenClawコンテナをCloud Buildでビルド"
gcloud builds submit infra/openclaw \
  --tag "${IMAGE_URI}" \
  --project "${PROJECT_ID}"

echo "[4/7] VM用サービスアカウント作成（存在しない場合）"
if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT_EMAIL}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
    --display-name="OpenClaw VM Service Account" \
    --project "${PROJECT_ID}" >/dev/null
fi

echo "[5/7] 権限付与"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/artifactregistry.reader" >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/logging.logWriter" >/dev/null

echo "[6/7] Firewallルール作成（存在しない場合）"
if [[ "${ALLOW_PUBLIC_INGRESS}" == "true" ]]; then
  if [[ -z "${PUBLIC_SOURCE_RANGES}" ]]; then
    echo "PUBLIC_SOURCE_RANGES is required when ALLOW_PUBLIC_INGRESS=true" >&2
    exit 1
  fi
  if ! gcloud compute firewall-rules describe allow-openclaw-8080 --project "${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud compute firewall-rules create allow-openclaw-8080 \
      --project "${PROJECT_ID}" \
      --allow=tcp:${OPENCLAW_PORT} \
      --target-tags=openclaw \
      --source-ranges="${PUBLIC_SOURCE_RANGES}" \
      --description="Allow OpenClaw service traffic from trusted ranges only" >/dev/null
  fi
else
  echo "Public ingress is disabled. Firewall rule allow-openclaw-8080 will not be created."
fi

STARTUP_SCRIPT_FILE="$(mktemp)"
cat > "${STARTUP_SCRIPT_FILE}" <<SCRIPT
#!/bin/bash
set -euo pipefail
apt-get update
apt-get install -y ca-certificates curl gnupg lsb-release docker.io
systemctl enable docker
systemctl start docker

PROJECT_ID="${PROJECT_ID}"
REGION="${REGION}"
IMAGE_URI="${IMAGE_URI}"
MISTRAL_MODEL="${MISTRAL_MODEL}"
OPENCLAW_PORT="${OPENCLAW_PORT}"

TOKEN=\$(curl -s -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" | \
  python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

MISTRAL_API_KEY=\$(curl -s -H "Authorization: Bearer \${TOKEN}" \
  "https://secretmanager.googleapis.com/v1/projects/\${PROJECT_ID}/secrets/mistral-api-key/versions/latest:access" | \
  python3 -c 'import sys,json,base64; print(base64.b64decode(json.load(sys.stdin)["payload"]["data"]).decode())')

ACCESS_TOKEN=\$(curl -s -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" | \
  python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

echo "\${ACCESS_TOKEN}" | docker login -u oauth2accesstoken --password-stdin "${AR_HOST}"

docker rm -f openclaw-service || true
docker pull "\${IMAGE_URI}"
docker run -d --name openclaw-service --restart unless-stopped \
  -p \${OPENCLAW_PORT}:8080 \
  -e MISTRAL_API_KEY="\${MISTRAL_API_KEY}" \
  -e MISTRAL_MODEL="\${MISTRAL_MODEL}" \
  "\${IMAGE_URI}"
SCRIPT

echo "[7/7] Compute Engineインスタンス作成/更新"
if gcloud compute instances describe "${INSTANCE_NAME}" --zone "${ZONE}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud compute instances add-metadata "${INSTANCE_NAME}" \
    --zone "${ZONE}" \
    --project "${PROJECT_ID}" \
    --metadata-from-file startup-script="${STARTUP_SCRIPT_FILE}" >/dev/null
  gcloud compute instances reset "${INSTANCE_NAME}" --zone "${ZONE}" --project "${PROJECT_ID}" >/dev/null
else
  gcloud compute instances create "${INSTANCE_NAME}" \
    --project "${PROJECT_ID}" \
    --zone "${ZONE}" \
    --machine-type "e2-standard-2" \
    --image-family "debian-12" \
    --image-project "debian-cloud" \
    --service-account "${SERVICE_ACCOUNT_EMAIL}" \
    --scopes "https://www.googleapis.com/auth/cloud-platform.read-only,https://www.googleapis.com/auth/logging.write" \
    --tags "openclaw" \
    --metadata-from-file startup-script="${STARTUP_SCRIPT_FILE}"
fi

rm -f "${STARTUP_SCRIPT_FILE}"

EXTERNAL_IP="$(gcloud compute instances describe "${INSTANCE_NAME}" --zone "${ZONE}" --project "${PROJECT_ID}" --format='value(networkInterfaces[0].accessConfigs[0].natIP)')"
echo "OpenClaw URL: http://${EXTERNAL_IP}:${OPENCLAW_PORT}"
