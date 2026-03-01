# OpenClone バックエンド TODO v1

## 1. 前提
- API契約は `docs/contracts/openapi_v1.yaml` を唯一の正とする
- エラーコードは `docs/contracts/error_catalog_v1.md` に固定する
- `chat/send` は `token -> final -> done` を保証する

## 2. 実行順（依存順）

### Phase 0: 永続化・基盤（最優先）
- [x] `BE-01` OpenAPI準拠のサーバ骨格生成 / 完了条件: 契約上の全エンドポイントが疎通する
- [x] `BE-02` 認証ミドルウェア（Bearer JWT） / 完了条件: 保護APIで `401/403` が正しく返る
- [x] `BE-04` 共通エラー基盤（`code/message/request_id`） / 完了条件: 全APIで同一エラーフォーマットを返す
- [x] `BE-03` DBマイグレーション（DDL + index + `pg_trgm`） / 完了条件: スキーマ適用・再適用が安定する（`backend/db/migrations/0001_init.sql` + `backend/scripts/apply_migrations.sh`）
- [ ] `BE-28` 永続化本実装（MemoryStore脱却） / 完了条件: `store.ts` をCloud SQL実装へ置換し、再起動後も状態が維持される

### Phase 1: 会話基盤（実装済みの品質仕上げ）
- [x] `BE-05` `POST /api/stt/transcribe`（Voxtral）
- [x] `BE-07` `POST /api/chat/send` SSE基盤
- [x] `BE-08` OpenClaw連携（text/action）
- [x] `BE-09` ElevenLabs TTS連携
- [x] `BE-10` `session_id` 発行/所有者検証
- [x] `BE-11` 履歴API（`GET /api/chat/history`）
- [x] `BE-12` 検索API（`GET /api/chat/history/search`）
- [x] `BE-13` 削除API（`DELETE /api/data/chat-logs/{message_id}`）
- [x] `BE-15` レート制御とタイムアウト
- [x] `BE-22` トークン期限と認可共通化 / 完了条件: JWT有効期限24時間、会話系API全体へ所有権検証ミドルウェアを適用
- [x] `BE-22a` CSRF相当対策（Origin検証） / 完了条件: POST/DELETEで `Origin` 不一致時 `403`
- [ ] `BE-30` TTS配信本実装（data URL脱却） / 完了条件: Cloud Storage等の実URLで `audio_url` を返す

### Phase 2: オンボーディング（Big5 + Voice Clone）
- [x] `BE-06` `POST /api/onboarding/answer-audio-upload`
- [ ] `BE-14` オンボーディングAPI一式 / 完了条件: `start`, `answers`, `big5-answers`, `big5-result`, `voice-clone/start`, `voice-clone-status`, `complete` が契約どおり動作する

### Phase 3: Nanobanana2 本実装
- [ ] `BE-25` Nanobanana2ジョブ本実装（モック脱却） / 完了条件: `photo-upload` が実ジョブ起動し、`pixelart-status` が実URL/実状態を返す
- [ ] `BE-26` Nanobanana2アクションアニメ本実装 / 完了条件: 全身ベース生成→モーション差分→GIF/フレーム出力を実行し `motion_assets` 保存

### Phase 4: ランタイム・セキュリティ・運用
- [ ] `BE-19` ユーザー専用OpenClawランタイム自動プロビジョニング
- [x] `BE-19a` Cloud Run本番へのOpenClaw専用設定投入 / 完了条件: `OPENCLAW_DEDICATED_ENABLED=true`、`GCP_PROJECT_ID`、`OPENCLAW_GCE_ZONE`、`OPENCLAW_INSTANCE_TEMPLATE`、`OPENCLAW_PORT`、`OPENCLAW_BRIDGE_TOKEN_SALT` を本番反映し、`chat/send` の `503(OpenClaw未準備)` が解消される
- [ ] `BE-19b` OpenClaw応答遅延・セッションロック対策 / 完了条件: bridge経由の実応答で `openclaw_timeout` と `session file locked` を再現手順付きで潰し、連続2リクエスト以上を安定成功させる
- [ ] `BE-20` ランタイム状態API（`GET /api/runtime/status`）
- [ ] `BE-18` OpenClawガードレール実装
- [ ] `BE-21` アップロード検証強化
- [ ] `BE-23` CEメタデータ遮断
- [ ] `BE-24` 監査ログ/運用ハードニング
- [ ] `BE-24a` トレース秘匿強化
- [ ] `BE-31` チャット開始のサーバー側強制 / 完了条件: `/api/chat/send` で `onboarding_completed=true` を必須化し、未完了ユーザーは `403` で拒否する
- [ ] `BE-32` `onboarding/complete` 入力検証強化 / 完了条件: `big5_answers` の `question_id` 一意(1..10) と `choice_value` 範囲(1..7) を検証し、逸脱時 `400` を返す
- [ ] `BE-33` SOUL更新の追記型廃止 / 完了条件: `system-prompt.js` への無制限appendを廃止し、置換または固定ブロック更新で肥大化を防止する
- [ ] `BE-34` Googleログイン検証強化 / 完了条件: `email_verified=true` の確認を追加し、不正トークンを拒否する
- [ ] `BE-35` テンプレート既定値の運用整合 / 完了条件: `create_openclaw_instance_template.sh` の既定テンプレートを `v4` に統一し、運用ドリフトを防止する

### Phase 5: テスト
- [ ] `BE-16` 契約テスト/結合テスト / 完了条件: OpenAPI準拠テスト、SSE順序、Voice Clone readyゲートを含めてグリーン

## 3. 受け入れ条件
- フロントが契約どおりに接続して待ち合わせなしで動作する
- SSEイベント順序とエラー形式が契約から逸脱しない
