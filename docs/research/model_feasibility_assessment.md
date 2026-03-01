# OpenClone モデル実現可能性評価（Mistral系）v1.0

## 1. 結論
ご提示のアナウンス（Ministral 3 / Mistral Large 3 / Voxtral Realtime）に対して、OpenCloneは実装可能。  
ただし用途を分ける必要がある。

- `Mistral Large 3` / `Ministral 3`:
  - チャット生成（Structured Outputで`text`+`action`）に適用
- `Voxtral Realtime`:
  - 音声認識（STT）用途
  - 現MVP方針（Web Speech API固定）では将来切替候補として評価対象

## 2. モデル群ごとの実現可能性
### 2.1 Ministral 3（3B/8B/14B）
- API提供:
  - あり（`ministral-3b-2512` / `ministral-8b-2512` / `ministral-14b-2512`）
- オープンソース/HF:
  - あり（Mistral公式のモデルページでOpen v25.12とWeights導線を提供）
- OpenCloneでの採用:
  - 低遅延応答、日次学習要約、軽量運用に適合

### 2.2 Mistral Large 3
- API提供:
  - あり（`mistral-large-2512`）
- オープンソース/HF:
  - あり（Mistral Large 3ページでOpen-Weight表記とWeights導線）
- OpenCloneでの採用:
  - メインの会話生成モデルとして採用

### 2.3 Voxtral / Voxtral Realtime
- API提供:
  - あり（音声文字起こしAPI、`voxtral-mini-transcribe-2507`）
- オープンソース/HF:
  - あり（Voxtral Mini 3B、Voxtral Small 24B など）
- OpenCloneでの採用:
  - 現時点は評価オプション（MVPのSTTはWeb Speech API）
  - 精度検証結果次第で切替判断

## 3. OpenCloneへの反映内容
- 設計書のモデルルーティングを以下に固定:
  - `default_chat_model`: `mistral-large-2512`
  - `fast_chat_model`: `ministral-8b-2512`
  - `cheap_background_model`: `ministral-3b-2512`
  - `quality_chat_model`: `ministral-14b-2512`
- STT方針:
  - MVPはWeb Speech API固定
  - 自動フォールバックなし
  - Voxtral Realtimeは将来切替候補
- モデルID運用:
  - 固定IDを使用し、`latest` エイリアスは使用しない

## 4. 参照ドキュメント（一次情報）
- Mistral API Models Overview:
  - https://docs.mistral.ai/getting-started/models/models_overview/
- Ministral 3 family:
  - https://docs.mistral.ai/getting-started/models/models/ministral/
- Mistral Large 3:
  - https://docs.mistral.ai/getting-started/models/models/large/
- Audio Transcription（Voxtral model IDs）:
  - https://docs.mistral.ai/capabilities/speech/audio_transcription/
- Structured Output（JSON出力）:
  - https://docs.mistral.ai/capabilities/completion/structured_output/
- HF（例: Mistral公式公開モデル）:
  - https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506
  - https://huggingface.co/mistralai/Voxtral-Mini-3B-2507
