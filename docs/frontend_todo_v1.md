# OpenClone フロントエンド TODO v1（実API優先）

## 1. 前提
- `front_mock` を基準実装とする
- API契約は `docs/contracts/openapi_v1.yaml` を唯一の正とする
- バックエンド未完了タスク（BE-03/14/25/26/27/28 ほか）に依存する項目は、モックで先行UI実装後に実APIへ接続する

## 2. 実行順（優先順位順）

### Phase 1: チャット基盤（バックエンド実装済み範囲）
- [x] `FE-01` APIクライアント抽象化（`real`/`mock`切替） / 完了条件: 環境変数だけで切替でき、認証ヘッダー(`Bearer JWT`)を付与できる
- [x] `FE-02` SSEチャット画面（実API接続） / 完了条件: `token/final/error/done` の順序でUI状態遷移し、`action` と `audio_url` を反映できる
- [ ] `FE-03` `session_id` 発行/復元 / 完了条件: 初回発行、localStorage保存、403時の再初期化導線が動作する
- [ ] `FE-04` 音声入力UI（STT接続） / 完了条件: 録音→`/api/stt/transcribe`→transcript→`chat/send`投入の一連フローが動作する
- [ ] `FE-05` 履歴/検索/削除UI / 完了条件: `/api/chat/history` と `/api/chat/history/search` の結果一覧を画面表示し、`DELETE /api/data/chat-logs/{id}` 実行後に表示へ反映できる（`limit/offset` 含む）
- [ ] `FE-06` エラーUI統一 / 完了条件: `unauthorized`, `forbidden`, `stt_failed`, `openclaw_timeout`, `tts_failed`, `rate_limited` の表示/復帰導線が成立する

### Phase 2: オンボーディング（Big5 + Voice Clone）
- [ ] `FE-07` オンボーディングAPI接続 / 完了条件: `start`, `answer-audio-upload`, `answers`, `big5-answers`, `big5-result`, `voice-clone/start`, `voice-clone-status`, `complete` が接続できる
- [ ] `FE-08` Big5質問UI（TIPI-J 10問・7件法） / 完了条件: 1〜7回答、未回答バリデーション、送信が動作する
- [x] `FE-09` Big5結果表示UI / 完了条件: 診断結果（性格タイプ）を表示できる
- [x] `FE-10` Voice Clone待機導線 / 完了条件: `voice-clone-status` を `ready` までポーリングし、`ready` まで `onboarding/complete` を実行しない
- [ ] `FE-17` 直接遷移ガードの堅牢化 / 完了条件: `localStorage` 依存のみのガードを補強し、`auth/me` の `onboarding_completed` 参照で `/chat` 入場可否を判定する
- [ ] `FE-18` 個人データ保持最小化 / 完了条件: 顔写真の `localStorage` 永続保存を廃止し、必要最小の一時保持へ変更する

### Phase 3: アバター生成・再生（Nanobanana本実装追従）
- [ ] `FE-11` 生成待機画面の本実装追従 / 完了条件: 固定進捗モックを廃止し、`pixelart-status` 実レスポンスに同期して進捗表示できる
- [ ] `FE-12` `motion_frame_urls` でPNGフレーム再生 / 完了条件: `action` ごとにFPS可変・ループ・切替時リセット付きで再生できる
- [ ] `FE-13` GIF依存の段階的廃止 / 完了条件: 本番表示は `motion_frame_urls` 優先、`motion_gif_urls` はプレビュー用途のみで使用する
- [ ] `FE-14` アバター描画本実装 / 完了条件: `PixelAvatar` プレースホルダー描画を廃止し、生成アセットで action 連動再生できる

### Phase 4: 運用補助
- [ ] `FE-15` ランタイム状態表示（任意） / 完了条件: `GET /api/runtime/status` を表示できる
- [ ] `FE-16` Voice Clone状態UI / 完了条件: `queued/processing/ready/failed` を表示し、失敗時は「テキストチャットで継続」導線を提示できる

## 3. 受け入れ条件
- 実APIモードで `onboarding -> chat -> history -> search -> delete` が通る
- `onboarding/complete` は Voice Clone `ready` 前に実行されない
- SSEイベント順序とエラー形式が契約から逸脱しない
