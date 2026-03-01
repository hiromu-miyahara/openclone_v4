# OpenClone 並列開発ハンドオフ v1

## 1. 目的
この文書は、フロントエンドとバックエンドが同時に開発開始できる最小合意事項を定義する。

## 2. 参照元
- API契約: [openapi_v1.yaml](/Users/kokifunahashi/Documents/openclone/docs/contracts/openapi_v1.yaml)
- エラー定義: [error_catalog_v1.md](/Users/kokifunahashi/Documents/openclone/docs/contracts/error_catalog_v1.md)

## 3. フロント開始条件（これで着手可）
- 認証ヘッダ: `Authorization: Bearer <token>` を付与する
- `POST /api/chat/send` をSSEで受ける
  - `token` 受信ごとにテキスト追記
  - `final` 受信時に `action` 更新と `audio_url` 保持（`tts_status` も解釈）
  - `error` 受信時にエラートースト表示
  - `done` 受信で入力再有効化
- `session_id` は初回 `final` で必ず受け取り、以後は同じ値をlocalStorageから再利用
- `final` 後にTTS追加イベントは来ない前提で実装する（`final` の `audio_url/tts_status` を最終値として扱う）
- 音声入力は `POST /api/stt/transcribe` に録音ファイル送信し、返却 `transcript` を `chat/send` へ投入
- オンボーディング音声は `POST /api/onboarding/answer-audio-upload` でアップロードし、返却 `answer_audio_url` を `POST /api/onboarding/answers` に送る
  - 音声アップロード上限: 10MB（`audio/mpeg|wav|webm|ogg`）
- 音声8問完了後、Big5 10問を `POST /api/onboarding/big5-answers` で保存し、`GET /api/onboarding/big5-result` でスコア/タイプを取得する
- 音声8問保存後に `POST /api/onboarding/voice-clone/start` を呼び、`GET /api/onboarding/voice-clone-status/{job_id}` で `ready` までポーリングする（8問全量連結、品質フィルタなし）
- 顔画像は `POST /api/onboarding/photo-upload` 後に `GET /api/onboarding/pixelart-status/{job_id}` をポーリングし、`completed` 時の `asset_urls.base_fullbody_png` と `asset_urls.motion_frame_urls` を本番アバター資産として採用する（`motion_gif_urls` はプレビュー/互換用途）
  - 画像アップロード上限: 5MB（`image/jpeg|png`）
- 履歴検索は `GET /api/chat/history/search?session_id=...&q=...&limit=...&offset=...` を使用
- 任意表示として `GET /api/runtime/status` を呼び、専用OpenClawインスタンス状態（`provisioning/running/failed/stopped`）を表示可能

## 4. バックエンド開始条件（これで着手可）
- OpenAPIのリクエスト/レスポンス型に準拠
- `chat/send` は `text/event-stream` を返し、イベント順序を保証
  1. `token`（0回以上）
  2. `final`（1回）
  3. `done`（1回）
- `session_id` 未指定時は新規発行し、`final` で返す
- 異常時は `error` を返しストリーム終了
- `request_id` を全エラーレスポンスに付与
- `403` は「他ユーザーsession_idアクセス時」に返す
- `session_id` は128bit以上の暗号学的乱数で生成し、会話系APIで所有権照合を必須化
- JWTは24時間有効（`/api/auth/login` の `expires_in` を返す）
- state-changing API（POST/DELETE）は `Origin` 検証を必須化
- `POST /api/onboarding/complete` の前提は「音声8問 + Big5 10問の保存完了」かつ Voice Clone `ready`
- オンボーディング完了時に OpenClaw `SOUL.md` へ「音声回答要約 + Big5結果」を反映する
- OpenClawにはガードレールを適用し、system上書き要求とCE環境情報参照要求（metadata/file/env/command）を拒否する
- OpenClaw実行VMから `metadata.google.internal` への到達を遮断する
- ユーザー登録時に専用 Compute Engine インスタンスへ OpenClaw を自動プロビジョニングし、ユーザーID単位で接続先を分離する
- `GET /api/runtime/status` で専用インスタンス状態を返せる

## 5. SSE例（固定）
```text
event: token
data: {"text_chunk":"こんにちは"}

event: token
data: {"text_chunk":"、今日はどう？"}

event: final
data: {"message_id":"msg_123","session_id":"sess_123","action":"speaking","audio_url":"https://cdn.example.com/audios/a1.mp3","tts_status":"ready"}

event: done
data: {}
```

## 6. 契約変更ルール（凍結）
- Day 0以降、破壊的変更は禁止
- 追加項目は後方互換のみ許可
- 変更時は以下を同時更新
  - `openapi_v1.yaml`
  - `error_catalog_v1.md`
  - この文書
