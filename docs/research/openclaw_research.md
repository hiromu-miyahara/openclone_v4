# OpenClaw 調査メモ（OpenClone向け）

## 1. 要点
- OpenClawは、モデル接続・チャネル接続・エージェント実行をまとめて扱うオープンソース基盤。
- 公式ドキュメント上で、Gateway / Control UI / Relay / Worker に分かれた構成が示されている。
- OpenCloneでは、OpenClawをバックエンド実行基盤として使い、OpenClone側はユーザー向けラッパーUI/APIとして実装するのが妥当。

## 2. OpenCloneへの適用方針
- OpenClawに任せる:
  - エージェント実行
  - モデル実行パイプライン
  - 外部チャネル接続の基盤
- OpenCloneラッパーに残す:
  - 人格プロファイル適用
  - Voxtral STT
  - ElevenLabs TTS
  - 2等身アバター制御
  - OpenClaw I/O整形（構造化出力 `text` + `action`）

## 3. 注意点
- OpenClaw自体の機能更新が速いため、実装時は公式ドキュメントの最新仕様を固定参照する。
- MVPでは「回答専用エージェント」の制約を維持し、外部アクション実行は無効化する。

## 4. 参照元（一次情報）
- OpenClaw 公式サイト:
  - https://openclaw.ai/
- OpenClaw Docs:
  - https://docs.openclaw.ai/
- OpenClaw アーキテクチャ:
  - https://docs.openclaw.ai/architecture/overview
- OpenClaw GitHub:
  - https://github.com/clawdbot/clawdbot
