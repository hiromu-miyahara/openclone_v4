#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-macro-resolver-488810-p8}"
REGION="${REGION:-asia-northeast1}"
SERVICE_NAME="${SERVICE_NAME:-openclone-backend}"
REPO_NAME="${REPO_NAME:-openclone}"
IMAGE_NAME="${IMAGE_NAME:-openclone-backend}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
OPENCLAW_BASE_URL="${OPENCLAW_BASE_URL:-}"
OPENCLAW_TIMEOUT_MS="${OPENCLAW_TIMEOUT_MS:-300000}"
OPENCLAW_DEDICATED_ENABLED="${OPENCLAW_DEDICATED_ENABLED:-true}"
OPENCLAW_GCE_ZONE="${OPENCLAW_GCE_ZONE:-asia-northeast1-a}"
OPENCLAW_INSTANCE_TEMPLATE="${OPENCLAW_INSTANCE_TEMPLATE:-https://www.googleapis.com/compute/v1/projects/${PROJECT_ID}/global/instanceTemplates/openclaw-template-v4}"
OPENCLAW_PORT="${OPENCLAW_PORT:-8080}"
OPENCLAW_BRIDGE_TOKEN_SECRET_NAME="${OPENCLAW_BRIDGE_TOKEN_SECRET_NAME:-backend-openclaw-bridge-salt}"
ALLOW_UNAUTHENTICATED="${ALLOW_UNAUTHENTICATED:-false}"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_EMAIL:-}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://openclone-frontend-dev-u3zb6o6q7a-an.a.run.app}"

AR_HOST="${REGION}-docker.pkg.dev"
IMAGE_URI="${AR_HOST}/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${IMAGE_TAG}"

if [[ -z "${ALLOWED_ORIGINS}" ]]; then
  echo "ERROR: ALLOWED_ORIGINS is required"
  exit 1
fi
if [[ "${OPENCLAW_DEDICATED_ENABLED}" == "true" && -z "${OPENCLAW_INSTANCE_TEMPLATE}" ]]; then
  echo "ERROR: OPENCLAW_INSTANCE_TEMPLATE is required when OPENCLAW_DEDICATED_ENABLED=true"
  exit 1
fi

echo "[1/4] API有効化"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --project "${PROJECT_ID}" >/dev/null

echo "[2/4] Artifact Registry作成（存在しない場合）"
if ! gcloud artifacts repositories describe "${REPO_NAME}" --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO_NAME}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="OpenClone container images" \
    --project "${PROJECT_ID}" >/dev/null
fi

echo "[3/4] BackendコンテナをCloud Buildでビルド"
TMP_CLOUDBUILD="$(mktemp)"
cat > "${TMP_CLOUDBUILD}" <<YAML
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - -f
      - backend/Dockerfile
      - -t
      - ${IMAGE_URI}
      - .
images:
  - ${IMAGE_URI}
YAML
gcloud builds submit . \
  --config "${TMP_CLOUDBUILD}" \
  --project "${PROJECT_ID}"
rm -f "${TMP_CLOUDBUILD}"

echo "[4/4] Cloud Runへデプロイ"
DEPLOY_FLAGS=(
  --image "${IMAGE_URI}"
  --project "${PROJECT_ID}"
  --region "${REGION}"
  --platform managed
  --port 8080
  --set-env-vars "OPENCLAW_TIMEOUT_MS=${OPENCLAW_TIMEOUT_MS}"
  --set-env-vars "ALLOWED_ORIGINS=${ALLOWED_ORIGINS}"
  --set-env-vars "OPENCLAW_DEDICATED_ENABLED=${OPENCLAW_DEDICATED_ENABLED}"
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID}"
  --set-env-vars "OPENCLAW_GCE_ZONE=${OPENCLAW_GCE_ZONE}"
  --set-env-vars "OPENCLAW_INSTANCE_TEMPLATE=${OPENCLAW_INSTANCE_TEMPLATE}"
  --set-env-vars "OPENCLAW_PORT=${OPENCLAW_PORT}"
  --set-secrets "JWT_SECRET=backend-jwt-secret:latest"
  --set-secrets "BOOTSTRAP_AUTH_TOKEN=backend-bootstrap-token:latest"
  --set-secrets "OPENCLAW_BRIDGE_TOKEN_SALT=${OPENCLAW_BRIDGE_TOKEN_SECRET_NAME}:latest"
)
if [[ -n "${OPENCLAW_BASE_URL}" ]]; then
  DEPLOY_FLAGS+=(--set-env-vars "OPENCLAW_BASE_URL=${OPENCLAW_BASE_URL}")
fi
if [[ "${ALLOW_UNAUTHENTICATED}" == "true" ]]; then
  DEPLOY_FLAGS+=(--allow-unauthenticated)
else
  DEPLOY_FLAGS+=(--no-allow-unauthenticated)
fi
if [[ -n "${SERVICE_ACCOUNT_EMAIL}" ]]; then
  DEPLOY_FLAGS+=(--service-account "${SERVICE_ACCOUNT_EMAIL}")
fi

gcloud run deploy "${SERVICE_NAME}" "${DEPLOY_FLAGS[@]}"

gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format='value(status.url)'

echo "[verify] Cloud Run env (key subset)"
gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format='get(spec.template.spec.containers[0].env)' | \
  tr ';' '\n' | \
  grep -E 'ALLOWED_ORIGINS|OPENCLAW_TIMEOUT_MS|OPENCLAW_DEDICATED_ENABLED|OPENCLAW_GCE_ZONE|OPENCLAW_INSTANCE_TEMPLATE|OPENCLAW_PORT|OPENCLAW_BASE_URL|GCP_PROJECT_ID' || true
