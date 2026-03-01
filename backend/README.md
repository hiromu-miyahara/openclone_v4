# OpenClone Backend (Scaffold)

OpenAPI契約に準拠したバックエンドのスキャフォールド実装。

## 開発
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## 動作確認
```bash
curl -s http://localhost:8080/healthz
curl -s http://localhost:8080/openapi.json | head
```

## DBマイグレーション（Cloud SQL/PostgreSQL）
```bash
export DATABASE_URL='postgres://...'
bash backend/scripts/apply_migrations.sh
```

主要DDLは `backend/db/migrations/0001_init.sql` に定義。

## 環境変数
| 変数名 | 必須 | 用途 |
|---|---|---|
| `JWT_SECRET` | Yes | Bearer JWTの署名/検証 |
| `BOOTSTRAP_AUTH_TOKEN` | Yes | `/auth/login` `/auth/register` のブートストラップ保護トークン |
| `ALLOWED_ORIGINS` | 本番推奨Yes | CORS許可オリジン（`,`区切り） |
| `OPENCLAW_BASE_URL` | No | 非専用モードで使う固定OpenClawエンドポイント（専用モードでは未使用） |
| `OPENCLAW_TIMEOUT_MS` | No | OpenClaw呼び出しタイムアウト（開発既定: 8000 / Cloud Run運用既定: 300000） |
| `OPENCLAW_DEDICATED_ENABLED` | No | `true` でユーザー専用CE自動プロビジョニングを有効化（Cloud Run運用既定: true） |
| `GCP_PROJECT_ID` | 専用時Yes | プロビジョニング先のGCP Project ID |
| `OPENCLAW_GCE_ZONE` | 専用時Yes | 専用インスタンス作成先zone |
| `OPENCLAW_INSTANCE_TEMPLATE` | 専用時Yes | OpenClaw入りInstance TemplateのselfLink |
| `OPENCLAW_PORT` | No | OpenClawポート（既定: 8080） |
| `PORT` | No | リッスンポート（既定: 8080） |

`.env.example`:
```bash
JWT_SECRET=change-me-in-production
BOOTSTRAP_AUTH_TOKEN=
ALLOWED_ORIGINS=http://localhost:5173
OPENCLAW_BASE_URL=
OPENCLAW_TIMEOUT_MS=8000
OPENCLAW_DEDICATED_ENABLED=false
GCP_PROJECT_ID=
OPENCLAW_GCE_ZONE=asia-northeast1-a
OPENCLAW_INSTANCE_TEMPLATE=
OPENCLAW_PORT=8080
```

## 認証（開発）
1. `POST /api/auth/login` を `login_token` 付きで呼び出して `token` を取得
2. `Authorization: Bearer <token>` を付与して保護APIを呼び出す

## ユーザー専用OpenClaw（CE）自動起動
- `POST /api/auth/register` または `POST /api/auth/login` でプロビジョニングを開始
- `GET /api/auth/provisioning-status` で `pending/ready/failed` を確認
- `ready` のユーザーは `chat/send` が専用OpenClaw endpointを優先利用
- `ready` になる前の `chat/send` は `503` を返す（フォールバックしない）
- `scripts/gcp/deploy_backend_cloud_run.sh` は専用運用向け既定値（`DEDICATED=true`, `TIMEOUT=300000`, `TEMPLATE=v4`）を使用

## Cloud Run デプロイ前提
- コンテナで `PORT` 環境変数を受けて起動
- `Dockerfile` で build/runtime を分離

例:
```bash
gcloud builds submit . \
  --tag gcr.io/<PROJECT_ID>/openclone-backend:dev \
  --file backend/Dockerfile

gcloud run deploy openclone-backend \
  --image gcr.io/<PROJECT_ID>/openclone-backend:dev \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated=false
```
