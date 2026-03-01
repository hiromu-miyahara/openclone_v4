#!/bin/bash
# Cloud Runデプロイスクリプト（front_mock）- Artifact Registry使用

set -e

# 設定
PROJECT_ID="${PROJECT_ID:-your-project-id}"
REGION="${REGION:-asia-northeast1}"
SERVICE_NAME="${SERVICE_NAME:-openclone-frontend-dev}"
ARTIFACT_REGISTRY_HOST="${REGION}-docker.pkg.dev"
ARTIFACT_REPO_NAME="cloud-run-source-deploy"
IMAGE_NAME="${ARTIFACT_REGISTRY_HOST}/${PROJECT_ID}/${ARTIFACT_REPO_NAME}/${SERVICE_NAME}"

# worktree内のパス
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONT_DIR="$(dirname "$SCRIPT_DIR")/front_mock"

echo "========================================="
echo "OpenClone Frontend Deploy Script"
echo "========================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo "Image: $IMAGE_NAME"
echo ""

cd "$FRONT_DIR"

# Check if gcloud is configured
if ! gcloud config get-value project &> /dev/null; then
    echo "Error: gcloud project not configured. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

# Create Artifact Registry repository if it doesn't exist
echo "Step 0: Ensuring Artifact Registry repository exists..."
gcloud artifacts repositories create "$ARTIFACT_REPO_NAME" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Cloud Run deploy source" \
  --quiet 2>/dev/null || echo "Repository already exists or creation failed (continuing)"

# Build and push image using Cloud Build
IMAGE_TAG="${IMAGE_NAME}:$(date +%Y%m%d-%H%M%S)"
VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://api.openclone.example.com}"
VITE_USE_API_MOCK="${VITE_USE_API_MOCK:-false}"
VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-}"

echo ""
echo "Step 1: Building and pushing Docker image via Cloud Build..."
TMP_CLOUDBUILD="$(mktemp)"
cat > "$TMP_CLOUDBUILD" <<YAML
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - -f
      - Dockerfile
      - -t
      - ${IMAGE_TAG}
      - --build-arg
      - VITE_API_BASE_URL=${VITE_API_BASE_URL}
      - --build-arg
      - VITE_USE_API_MOCK=${VITE_USE_API_MOCK}
      - --build-arg
      - VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
      - .
images:
  - ${IMAGE_TAG}
YAML
gcloud builds submit . \
  --config "$TMP_CLOUDBUILD" \
  --project "$PROJECT_ID"
rm -f "$TMP_CLOUDBUILD"

echo ""
echo "Step 2: Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_TAG" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --timeout 30s \
  --max-instances 100 \
  --min-instances 0 \
  --set-env-vars "VITE_API_BASE_URL=${VITE_API_BASE_URL},VITE_USE_API_MOCK=${VITE_USE_API_MOCK},VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}" \
  --project "$PROJECT_ID"

echo ""
echo "========================================="
echo "Deploy complete!"
echo "Service URL: $(gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format 'value(status.url)')"
echo "========================================="
