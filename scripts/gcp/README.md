# GCPデプロイスクリプト

## OpenClaw (Compute Engine)
まず Instance Template を作成:
```bash
PROJECT_ID=macro-resolver-488810-p8 \
TEMPLATE_NAME=openclaw-template-v2 \
OPENCLAW_VERSION=2026.2.26 \
./scripts/gcp/create_openclaw_instance_template.sh
```

単体の共有検証インスタンスを作る場合:
```bash
PROJECT_ID=macro-resolver-488810-p8 \
REGION=asia-northeast1 \
ZONE=asia-northeast1-a \
ALLOW_PUBLIC_INGRESS=false \
./scripts/gcp/deploy_openclaw_ce.sh
```

## Backend (Cloud Run)
```bash
PROJECT_ID=macro-resolver-488810-p8 \
REGION=asia-northeast1 \
ALLOW_UNAUTHENTICATED=false \
ALLOWED_ORIGINS=https://openclone-frontend-dev-u3zb6o6q7a-an.a.run.app \
OPENCLAW_DEDICATED_ENABLED=true \
OPENCLAW_TIMEOUT_MS=300000 \
OPENCLAW_INSTANCE_TEMPLATE=https://www.googleapis.com/compute/v1/projects/macro-resolver-488810-p8/global/instanceTemplates/openclaw-template-v4 \
SERVICE_ACCOUNT_EMAIL=<BACKEND_RUNTIME_SA_EMAIL> \
./scripts/gcp/deploy_backend_cloud_run.sh
```

- `ALLOW_UNAUTHENTICATED=true` は組織ポリシーで拒否される場合がある。
- 非公開Cloud Runの場合は `gcloud run services proxy` 経由で動作確認可能。
- OpenClawの公開検証が必要なときだけ `ALLOW_PUBLIC_INGRESS=true` と `PUBLIC_SOURCE_RANGES=<CIDR>` を設定する。
- `deploy_backend_cloud_run.sh` の既定値は専用OpenClaw運用向け（`DEDICATED=true`, `TIMEOUT=300000`, `TEMPLATE=v4`）で固定されている。
- スクリプト実行後に `ALLOWED_ORIGINS` / `OPENCLAW_*` の主要値を自動表示して検証する。
