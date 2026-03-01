# OpenClone フロー図・シーケンス図（Mermaid）

## 1. 会話処理フロー図
```mermaid
flowchart TD
  A[ユーザー入力<br/>テキスト or 音声録音] --> B{入力種別}
  B -->|音声| C[/api/stt/transcribe]
  C --> D[Voxtral STT<br/>voxtral-mini-transcribe-2507]
  D --> E[入力テキスト確定]
  B -->|テキスト| E

  E --> F[/api/chat/send]
  F --> RM[Runtime Manager]
  RM --> OC[ユーザー専用OpenClaw実行基盤]
  OC --> G[Mistralで応答生成<br/>Structured Output: text + action]
  G --> H[テキストをストリーミング返却]
  G --> I[ElevenLabs TTS生成<br/>eleven_turbo_v2]
  I --> J[audio_url返却]
  H --> K[actionに応じて2等身アバター再生]
  J --> L[音声再生（任意）]
  K --> M[ターン完了]
  L --> M
```

## 2. 会話処理シーケンス図
```mermaid
sequenceDiagram
  autonumber
  participant User as ユーザー
  participant PWA as スマホPWA
  participant API as OpenCloneラッパーAPI
  participant RM as Runtime Manager
  participant OC as OpenClaw
  participant VOX as Voxtral STT
  participant MTR as Mistral API
  participant EL as ElevenLabs

  User->>PWA: 音声入力開始
  PWA->>API: /api/stt/transcribe (録音データ)
  API->>VOX: STTリクエスト
  VOX-->>API: 転記テキスト
  API-->>PWA: transcript
  PWA->>API: /api/chat/send (text)
  API->>RM: ユーザー専用接続先を解決
  RM-->>API: OpenClaw接続先
  API->>OC: 実行リクエスト + SOUL.md + text
  OC->>MTR: 応答生成(text + action)
  MTR-->>OC: Structured Output
  OC-->>API: Structured Output
  API-->>PWA: textストリーミング + action
  API->>EL: TTS(text)
  EL-->>API: audio_url
  API-->>PWA: audio_url
  PWA-->>User: テキスト表示 + 2等身アバター再生

  opt ユーザーが音声再生を選択
    PWA-->>User: audio_urlを再生
  end
```

## 3. オンボーディング + Big5 シーケンス図
```mermaid
sequenceDiagram
  autonumber
  participant User as ユーザー
  participant PWA as スマホPWA
  participant API as OpenCloneラッパーAPI
  participant DB as Cloud SQL
  participant OC as OpenClaw(専用CE)

  User->>PWA: 音声8問に回答
  PWA->>API: /api/onboarding/answer-audio-upload
  API-->>PWA: answer_audio_url
  PWA->>API: /api/onboarding/answers
  API->>DB: 音声回答保存
  DB-->>API: 保存完了

  User->>PWA: Big5 10問に回答
  PWA->>API: /api/onboarding/big5-answers
  API->>DB: Big5回答保存
  DB-->>API: 保存完了
  PWA->>API: /api/onboarding/big5-result
  API->>DB: Big5スコア集計
  DB-->>API: type_code/type_label
  API-->>PWA: Big5結果

  PWA->>API: /api/onboarding/complete
  API->>OC: SOUL.md更新(音声要約+Big5)
  OC-->>API: 更新完了
  API-->>PWA: onboarding complete
```

## 4. 会話ログ検索シーケンス図
```mermaid
sequenceDiagram
  autonumber
  participant User as ユーザー
  participant PWA as スマホPWA
  participant API as OpenCloneラッパーAPI
  participant DB as Cloud SQL

  User->>PWA: 履歴検索キーワード入力
  PWA->>API: GET /api/chat/history/search?session_id=...&q=...
  API->>DB: セッション内メッセージを部分一致検索
  DB-->>API: 検索結果
  API-->>PWA: メッセージ検索結果
  PWA-->>User: 一致メッセージを表示
```
