# OpenClone エラーカタログ v1

## 1. 目的
フロント/バックエンドで共通のエラーコード運用を行うための固定表。

## 2. 共通レスポンス
```json
{
  "code": "stt_failed",
  "message": "音声の文字起こしに失敗しました",
  "request_id": "req_01H..."
}
```

## 3. エラーコード一覧（Day 0固定）
- `validation_error`
  - 入力不正（必須不足、形式不正）
- `unauthorized`
  - 未認証
- `forbidden`
  - 権限不足（他ユーザーのsession_idなど）
- `stt_failed`
  - Voxtral転記失敗
- `openclaw_timeout`
  - OpenClaw応答タイムアウト
- `tts_failed`
  - ElevenLabs音声生成失敗
- `rate_limited`
  - レート制限超過
- `internal_error`
  - 予期しないサーバ内部エラー
- `resource_not_found`
  - 対象メッセージ/ジョブが存在しない

## 4. SSE時のエラー
- イベント名: `error`
- data payload:
```json
{
  "code": "openclaw_timeout",
  "message": "応答生成がタイムアウトしました",
  "request_id": "req_01H..."
}
```

## 5. 運用ルール
- `code` は固定値のみ使用し、自由文字列を追加しない
- 新規エラー追加はこの文書とOpenAPIを同時更新する
