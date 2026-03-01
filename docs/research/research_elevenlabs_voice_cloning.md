# ElevenLabs Voice Cloning 技術調査レポート

**作成日**: 2026-02-28
**バージョン**: 1.0
**目的**: OpenCloneにおける本人の声質再現に向けたElevenLabs Voice Cloning技術の調査

---

## 1. はじめに

本レポートは、ユーザー本人の声質を再現するためにElevenLabs Voice Cloningを活用する技術的調査結果をまとめるものです。OpenCloneの要件定義およびシステム設計に基づき、API仕様、音声収集方法、コスト構造、セーフティ対策を調査しました。

---

## 2. ElevenLabs Voice Cloning 概要

### 2.1 Voice Cloningの種類

ElevenLabsには主に2種類のVoice Cloningが存在します：

| タイプ | 説明 | 推奨用途 |
|--------|------|----------|
| **Instant Voice Cloning** | 短い音声サンプル（1〜5分）で即座にボイス作成 | プロトタイピング、個人利用 |
| **Professional Voice Cloning** | 長時間の高品質サンプル（30分以上）で高品質なボイス作成 | 商用、プロダクション、高品質要件 |

### 2.2 各方式の特徴

#### Instant Voice Cloning
- **サンプル要件**: 1〜5分の音声
- **処理時間**: 数分で完了
- **品質**: 実用的な品質だが、微細なニュアンスの再現には限界あり
- **プラン**: Starter以上で利用可能
- **適用シーン**: MVP、早期検証

#### Professional Voice Cloning
- **サンプル要件**: 30分以上の音声（推奨は1時間以上）
- **処理時間**: 数時間〜数日（クラウド上での学習処理）
- **品質**: 呼吸パターン、感情表現、強弱の再現性が高い
- **プラン**: Enterprise/独立ライセンス
- **適用シーン**: 本番稼働、商用利用

---

## 3. API仕様と実装手順

### 3.1 認証

```bash
curl https://api.elevenlabs.io/v1/voices \
  -H "xi-api-key: YOUR_API_KEY"
```

### 3.2 Voice Cloning API

#### 3.2.1 Instant Voice Cloning

**エンドポイント**: `POST https://api.elevenlabs.io/v1/voices/add`

```bash
curl -X POST https://api.elevenlabs.io/v1/voices/add \
  -H "xi-api-key: YOUR_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F "files=@sample.mp3" \
  -F "name=My Voice" \
  -F "description=My personal voice clone"
```

**リクエストパラメータ**:
- `files`: 音声ファイル（複数可）
- `name`: ボイス名
- `description`: 説明（オプション）

**レスポンス**:
```json
{
  "voice_id": "abc123...",
  "name": "My Voice",
  "samples": [
    {"sample_id": "sample1", "file_name": "sample.mp3"}
  ]
}
```

#### 3.2.2 Professional Voice Cloning

**エンドポイント**: `POST https://api.elevenlabs.io/v1/voices/add-clone`

```bash
curl -X POST https://api.elevenlabs.io/v1/voices/add-clone \
  -H "xi-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Professional Voice",
    "description": "High quality voice clone",
    "files": ["url1", "url2", ...],
    "labels": {"gender": "female", "age": "30s"}
  }'
```

### 3.3 Text-to-Speech API

**エンドポイント**: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`

```bash
curl -X POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id} \
  -H "xi-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "こんにちは、元気？",
    "model_id": "eleven_multilingual_v2",
    "voice_settings": {
      "stability": 0.5,
      "similarity_boost": 0.75,
      "style": 0.0,
      "use_speaker_boost": true
    }
  }' \
  --output output.mp3
```

**モデルID**:
- `eleven_multilingual_v2`: 最新の多言語モデル（推奨）
- `eleven_turbo_v2`: 高速・低コストモデル

**パラメータ詳細**:
- `stability` (0〜1): 安定性が高いほど、より一貫性のある音声になる
- `similarity_boost` (0〜1): 元音声との類似度を上げる
- `style` (0〜1): スタイルの再現度（Professional Cloningで有効）
- `use_speaker_boost`: クリッピングを防ぐブースト処理

### 3.4 Streaming API（低レイテンシー対応）

OpenCloneの「1秒以下」要件を満たすため、Streaming APIの使用を推奨します。

**エンドポイント**: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream`

```bash
curl -X POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream \
  -H "xi-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "こんにちは、元気？",
    "model_id": "eleven_turbo_v2",
    "output_format": "mp3_44100_128"
  }'
```

---

## 4. 音声サンプルの要件

### 4.1 品質要件

| 項目 | 推奨条件 |
|------|----------|
| **フォーマット** | MP3, WAV, M4A, OGG |
| **サンプリングレート** | 44.1kHz 以上 |
| **ビットレート** | 128kbps 以上（推奨: 192kbps） |
| **チャンネル** | モノラル可、ステレオ推奨 |
| **ファイルサイズ** | 1ファイルあたり 50MB 以下 |
| **総ファイルサイズ** | 200MB 以下（1回のリクエスト） |

### 4.2 録音環境要件

**必須条件**:
- 背景ノイズのない静かな環境
- 一定の距離からマイクに話す（10〜30cm）
- 一貫した音量と話速

**推奨条件**:
- 外部マイクの使用（スマホ内蔵マイクでも可）
- 反響のない部屋（カーテン、カーペットあり）
- エアコン、扇風機をOFF

### 4.3 コンテンツ要件

**推奨サンプル構成**:

| カテゴリ | 内容 | 長さ |
|----------|------|------|
| **日常会話** | 自然な会話、挨拶 | 30秒〜1分 |
| **感情表現** | 喜び、驚き、疑問、納得 | 各15〜30秒 |
| **読み上げ** | ニュース、説明文 | 30秒〜1分 |
| **口癖・言い回し** | よく使うフレーズ集 | 30秒〜1分 |

**トータル推奨時間**:
- Instant Voice Cloning: **1〜5分**
- Professional Voice Cloning: **30分〜1時間**

### 4.4 NGとなる音声

- 音楽やBGMが含まれる音声
- 複数人の会話が混在する音声
- 劇的な加工（エフェクト、ピッチ変更）が施された音声
- 電話通話品質（8kHz）の音声

---

## 5. オンボーディングでの音声収集設計

### 5.1 UI設計案

#### ステップ1: 説明画面
```
┌─────────────────────────────────────┐
│  音声収集について                      │
│                                     │
│  あなたの声を再現するために、           │
│  音声を録音します。                    │
│                                     │
│  所要時間: 約3〜5分                   │
│  録音内容: 指定のテキストを読み上げ     │
│                                     │
│  [録音を開始する]                     │
└─────────────────────────────────────┘
```

#### ステップ2: 録音画面
```
┌─────────────────────────────────────┐
│  録音 1/5                            │
│                                     │
│  以下のテキストを自然に読んでください    │
│                                     │
│  「こんにちは。今日はいい天気ですね。     │
│   最近、新しい趣味を見つけました。       │
│   週末は友人と映画を見に行く予定です。」  │
│                                     │
│  ● [録音中...] 00:00:05              │
│                                     │
│  [録り直し]  [次へ]                  │
└─────────────────────────────────────┘
```

#### ステップ3: 確認画面
```
┌─────────────────────────────────────┐
│  音声確認                             │
│                                     │
│  録音した音声を再生して確認してください  │
│                                     │
│  [▶ 再生]                            │
│                                     │
│  問題なければ「次へ」を押してください    │
│                                     │
│  [録り直し]  [次へ]                  │
└─────────────────────────────────────┘
```

### 5.2 オンボーディングフロー

```typescript
// フロー設計
interface OnboardingVoiceFlow {
  // 1. 説明と同意
  explanation: {
    title: "音声収集について"
    duration: "約3〜5分"
    privacy: "音声はボイス作成のみに使用されます"
  }

  // 2. 環境チェック
  environmentCheck: {
    microphonePermission: boolean
    noiseLevel: "quiet" | "moderate" | "noisy"
    volumeLevel: number
  }

  // 3. 録音セッション
  recordingSessions: [
    {
      id: 1,
      category: "日常会話",
      script: "こんにちは。今日はいい天気ですね...",
      targetDuration: 30, // 秒
      minDuration: 15,
      maxDuration: 60
    },
    // ... 合計5セッション
  ]

  // 4. アップロードと処理
  upload: {
    endpoint: "/api/onboarding/voice-upload"
    processingStatus: "uploading" | "processing" | "completed" | "failed"
  }
}
```

### 5.3 スクリプト案

**セッション1: 日常会話（約30秒）**
> 「こんにちは。今日はいい天気ですね。最近、新しい趣味を見つけました。週末は友人と映画を見に行く予定です。楽しみにしています。」

**セッション2: 感情表現-喜び（約20秒）**
> 「わあ、すごい！本当にできたんだね。おめでとう！」

**セッション3: 感情表現-驚き（約20秒）**
> 「えっ、そうなの？知らなかった。」

**セッション4: 説明文（約30秒）**
> 「この機能は、設定画面から有効にできます。使い方はとても簡単で、ボタンを押すだけで完了します。」

**セッション5: 自由発話（約30秒）**
> 「自分について自由に話してください」←ユーザーに自由に話してもらう

### 5.4 技術実装

```typescript
// フロントエンド（録音）
const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus'
  })

  const chunks: Blob[] = []
  mediaRecorder.ondataavailable = (e) => chunks.push(e.data)

  return { mediaRecorder, chunks }
}

// バックエンド（ElevenLabsへ送信）
import FormData from 'form-data'
import fs from 'fs'

async function uploadVoiceToElevenLabs(
  audioFile: Buffer,
  voiceName: string,
  apiKey: string
): Promise<string> {
  const form = new FormData()
  form.append('files', audioFile, {
    filename: 'voice_sample.mp3',
    contentType: 'audio/mpeg'
  })
  form.append('name', voiceName)
  form.append('description', 'User voice clone from OpenClone')

  const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      ...form.getHeaders()
    },
    body: form.getBuffer()
  })

  const data = await response.json()
  return data.voice_id
}
```

---

## 6. 品質と制約

### 6.1 品質評価指標

| 指標 | 評価方法 |
|------|----------|
| **音質自然度** | MOS（Mean Opinion Score） |
| **話者類似度** | 話者認識モデルによる評価 |
| **感情表現** | 感情分類モデルでの一致率 |
| **発話一貫性** | 複数セッション間の品質ばらつき |

### 6.2 制約事項

**技術的制約**:
- 短時間サンプル（<1分）では、再現品質が劣化
- 特殊な話し方（極端な早口、方言）では再現性が低下
- プロの声優と同等の品質にはProfessional Cloningが必要

**ビジネス制約**:
- Instant Cloningは商用利用ライセンスが含まれない場合あり
- ボイスの削除・編集には別途APIが必要
- APIレート制限（プラン依存）

**法的制約**:
- 本人の明示的な同意が必要
- 第三者の音声クローニングは禁止
- 商用利用にはEnterpriseプランが必要

---

## 7. コスト構造と最適化

### 7.1 プラン・料金（2025年時点の目安）

| プラン | 月額 | 文字数クォータ | Voice Cloning | 商用利用 |
|--------|------|----------------|---------------|----------|
| **Free** | $0 | 10,000文字/月 | なし | なし |
| **Starter** | $5 | 30,000文字/月 | Instant Cloning 3個 | × |
| **Creator** | $22 | 100,000文字/月 | Instant Cloning 10個 | ○ |
| **Pro** | $99 | 500,000文字/月 | Instant + Professional | ○ |
| **Enterprise** | カスタム | 無制限 | 無制限 | ○ |

### 7.2 TTS生成コスト

文字数ベースの従量課金：

| モデル | コスト（文字数あたり） | 特徴 |
|--------|----------------------|------|
| `eleven_turbo_v2` | 低コスト | 高速、低レイテンシー |
| `eleven_multilingual_v2` | 中コスト | 高品質、多言語 |

### 7.3 OpenClone向けコスト見積もり

**前提条件**:
- 1ユーザーあたり1日平均100ターンの会話
- 1ターンあたり平均50文字
- 1ヶ月30日

**計算**:
```
月間文字数 = 100ターン/日 × 50文字 × 30日 = 150,000文字/ユーザー/月
```

| ユーザー数 | 月間総文字数 | Creatorプラン | プラン数 | 月額コスト |
|----------|-------------|---------------|----------|-----------|
| 10 | 1,500,000 | - | - | Enterprise要相談 |
| 100 | 15,000,000 | - | - | Enterprise要相談 |
| 1,000 | 150,000,000 | - | - | Enterprise要相談 |

**Enterpriseプランでの見積もり目安**:
- $0.001〜$0.002/文字（ボリュームディスカウント適用後）
- 150,000文字/ユーザー/月 × $0.0015 = **$225/ユーザー/月**

※ これは高コストなため、後述の最適化策が必須

### 7.4 コスト最適化戦略

#### 7.4.1 キャッシュ戦略

**同一テキストのキャッシュ**:
```typescript
// 会話中によく使う定型表現をキャッシュ
const commonResponses = [
  "なるほど、そうなんだ。",
  "それ、いいね。",
  "確かにそうかもね。",
  // ...
]

// キャッシュ確認フロー
async function generateTTS(text: string, voiceId: string) {
  const cacheKey = hash(text + voiceId)
  const cached = await redis.get(cacheKey)
  if (cached) return cached

  // ElevenLabs API呼び出し
  const audioUrl = await callElevenLabs(text, voiceId)
  await redis.setex(cacheKey, 86400, audioUrl) // 24時間キャッシュ
  return audioUrl
}
```

**期待される削減率**: キャッシュヒット率30%〜50%

#### 7.4.2 モデル選択最適化

| シーン | 推奨モデル | 理由 |
|--------|-----------|------|
| 通常会話 | `eleven_turbo_v2` | レイテンシー優先 |
| 重要な発話 | `eleven_multilingual_v2` | 品質優先 |

**期待される削減率**: 20〜30%

#### 7.4.3 文字数削減

- ストリーミング出力の最初のN文字のみを音声化
- ユーザー設定で「音声なし」モードを提供

**期待される削減率**: 30〜50%（ユーザー設定依存）

#### 7.4.4 総合コスト削減効果

最適化適用後の試算：

| 項目 | 削減率 | コスト |
|------|--------|--------|
| ベース | - | $225/ユーザー/月 |
| キャッシュ適用 | -40% | $135 |
| モデル選択 | -25% | $101 |
| 文字数削減 | -30% | $71 |

**目標コスト**: **$70〜$100/ユーザー/月**

### 7.5 エンタープライズ契約のポイント

- ボリュームディスカウント: 100万文字/月以上で大幅割引
- クレジットパッケージ: 前払いで割引
- カスタムSLA: レイテンシー保証
- 専用サポート: 技術的な問題対応

---

## 8. セーフティとプライバシー対策

### 8.1 データ保護

**音声データの保存場所**:
- ElevenLabsクラウド: ボイス作成時に一時保存
- OpenClone Cloud Storage: 生成済み音声のキャッシュ

**保存期間ポリシー**:
- オンボーディング音声: ボイス作成完了後、30日で自動削除
- 生成済み音声: 24時間キャッシュ後、自動削除

**暗号化**:
- 転送中: TLS 1.3
- 保存中: AES-256

### 8.2 アクセス制御

```typescript
// ユーザー本人のみアクセス可能
interface VoiceAccessPolicy {
  userId: string
  voiceId: string
  permissions: {
    read: boolean
    update: boolean
    delete: boolean
    share: boolean // MVPはfalse
  }
}
```

### 8.3 同意取得

オンボーディング時に以下の同意を取得：

```
[✓] 私の音声をボイスクローニングに使用することに同意します
[✓] 生成された音声は、私の分身AIでのみ使用されることを理解しました
[✓] 音声データは安全に管理され、不要時に削除されることを理解しました
```

### 8.4 削除権利の実装

```typescript
// ユーザーがボイス削除をリクエスト
async function deleteUserVoice(userId: string) {
  // 1. ElevenLabs上のボイス削除
  await deleteVoiceFromElevenLabs(voiceId)

  // 2. キャッシュされた音声削除
  await deleteCachedAudio(userId)

  // 3. データベース上の参照削除
  await db.persona_profiles.update({
    where: { user_id: userId },
    data: { voice_profile_ref: null }
  })
}
```

### 8.5 安全性チェック

**不正利用防止**:
- APIキーのローテーション
- レート制限の監視
- 異常な使用パターンの検知

---

## 9. エラーハンドリングとフォールバック設計

### 9.1 エラーケース分類

| エラー種別 | 原因 | フォールバック |
|-----------|------|---------------|
| **APIレート制限** | リクエスト過多 | キャッシュ優先、待機キュー |
| **音声生成失敗** | サーバーエラー | テキストのみ返却 |
| **ネットワークエラー** | 接続障害 | リトライ（最大3回）、テキスト縮退 |
| **ボイス未作成** | オンボーディング未完了 | デフォルトボイス使用 |

### 9.2 フォールバック実装

```typescript
interface TTSResponse {
  audioUrl?: string
  fallbackMode: "full" | "text_only" | "cached" | "default_voice"
}

async function generateSpeechWithFallback(
  text: string,
  userId: string
): Promise<TTSResponse> {
  try {
    // 1. キャッシュ確認
    const cached = await getCachedAudio(text, userId)
    if (cached) {
      return { audioUrl: cached, fallbackMode: "cached" }
    }

    // 2. ElevenLabs API呼び出し
    const audioUrl = await callElevenLabs(text, userId)
    await cacheAudio(text, userId, audioUrl)

    return { audioUrl, fallbackMode: "full" }

  } catch (error) {
    if (error instanceof RateLimitError) {
      // レート制限: キャッシュから優先取得
      const bestMatch = await findBestCachedResponse(text)
      if (bestMatch) {
        return { audioUrl: bestMatch, fallbackMode: "cached" }
      }
      return { fallbackMode: "text_only" }
    }

    if (error instanceof NetworkError) {
      // ネットワークエラー: リトライ
      return retryWithBackoff(() => generateSpeechWithFallback(text, userId))
    }

    // その他: テキストのみ
    return { fallbackMode: "text_only" }
  }
}
```

### 9.3 デフォルトボイス戦略

ボイス作成前やエラー時のデフォルトボイス：
- Japanese男性ボイス（汎用的なニュートラルな声）
- ユーザープロファイル（年齢・性別）に基づき適切なデフォルトを選択

---

## 10. API実装の具体的な手順

### 10.1 バックエンド実装（TypeScript）

```typescript
// services/elevenlabs.service.ts
import axios from 'axios'

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io'

interface VoiceSettings {
  stability: number
  similarity_boost: number
  style: number
  use_speaker_boost: boolean
}

interface TTSCreateRequest {
  text: string
  voiceId: string
  modelId?: string
  settings?: Partial<VoiceSettings>
}

export class ElevenLabsService {
  constructor(private apiKey: string) {}

  /**
   * ボイス一覧取得
   */
  async getVoices(): Promise<any[]> {
    const response = await axios.get(
      `${ELEVENLABS_API_BASE}/v1/voices`,
      {
        headers: { 'xi-api-key': this.apiKey }
      }
    )
    return response.data.voices
  }

  /**
   * ボイス追加（Instant Cloning）
   */
  async addVoice(
    name: string,
    audioBuffer: Buffer,
    description?: string
  ): Promise<string> {
    const FormData = require('form-data')
    const form = new FormData()

    form.append('files', audioBuffer, {
      filename: 'voice_sample.mp3',
      contentType: 'audio/mpeg'
    })
    form.append('name', name)
    if (description) {
      form.append('description', description)
    }

    const response = await axios.post(
      `${ELEVENLABS_API_BASE}/v1/voices/add`,
      form,
      {
        headers: {
          'xi-api-key': this.apiKey,
          ...form.getHeaders()
        }
      }
    )

    return response.data.voice_id
  }

  /**
   * テキスト音声合成
   */
  async textToSpeech(request: TTSCreateRequest): Promise<Buffer> {
    const {
      text,
      voiceId,
      modelId = 'eleven_turbo_v2',
      settings = {
        stability: 0.5,
        similarity_boost: 0.75,
        use_speaker_boost: true
      }
    } = request

    const response = await axios.post(
      `${ELEVENLABS_API_BASE}/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: modelId,
        voice_settings: settings
      },
      {
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        responseType: 'arraybuffer'
      }
    )

    return Buffer.from(response.data)
  }

  /**
   * ストリーミング音声合成
   */
  async streamTextToSpeech(
    request: TTSCreateRequest
  ): Promise<ReadableStream> {
    // 実装は同様だが、Streamとして処理
    const response = await axios.post(
      `${ELEVENLABS_API_BASE}/v1/text-to-speech/${request.voiceId}/stream`,
      {
        text: request.text,
        model_id: request.modelId || 'eleven_turbo_v2',
        output_format: 'mp3_44100_128'
      },
      {
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }
    )

    return response.data
  }

  /**
   * ボイス削除
   */
  async deleteVoice(voiceId: string): Promise<void> {
    await axios.delete(
      `${ELEVENLABS_API_BASE}/v1/voices/${voiceId}`,
      {
        headers: { 'xi-api-key': this.apiKey }
      }
    )
  }
}
```

### 10.2 APIルート実装

```typescript
// app/api/onboarding/voice/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/services/elevenlabs.service'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const audioFile = formData.get('audio') as File
  const userId = formData.get('userId') as string

  if (!audioFile || !userId) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    )
  }

  try {
    // 音声バッファ取得
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())

    // ElevenLabsへ送信
    const elevenLabs = new ElevenLabsService(process.env.ELEVENLABS_API_KEY!)
    const voiceId = await elevenLabs.addVoice(
      `user_${userId}`,
      audioBuffer,
      'Voice clone created from OpenClone onboarding'
    )

    // データベースに保存
    await prisma.persona_profiles.update({
      where: { user_id: userId },
      data: {
        voice_profile_ref: voiceId,
        updated_at: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      voiceId
    })

  } catch (error) {
    console.error('Voice creation failed:', error)
    return NextResponse.json(
      { error: 'Failed to create voice' },
      { status: 500 }
    )
  }
}

// app/api/chat/tts/route.ts
export async function POST(request: NextRequest) {
  const { text, userId } = await request.json()

  try {
    // ユーザーのボイスID取得
    const profile = await prisma.persona_profiles.findUnique({
      where: { user_id: userId }
    })

    if (!profile?.voice_profile_ref) {
      return NextResponse.json(
        { error: 'Voice not found' },
        { status: 404 }
      )
    }

    // キャッシュ確認
    const cacheKey = `tts:${hash(text)}:${profile.voice_profile_ref}`
    const cached = await redis.get(cacheKey)

    if (cached) {
      return NextResponse.json({ audioUrl: cached, cached: true })
    }

    // 音声生成
    const elevenLabs = new ElevenLabsService(process.env.ELEVENLABS_API_KEY!)
    const audioBuffer = await elevenLabs.textToSpeech({
      text,
      voiceId: profile.voice_profile_ref
    })

    // Cloud Storageへアップロード
    const audioUrl = await uploadToGCS(
      `tts/${userId}/${Date.now()}.mp3`,
      audioBuffer,
      'audio/mpeg'
    )

    // キャッシュ保存（24時間）
    await redis.setex(cacheKey, 86400, audioUrl)

    return NextResponse.json({ audioUrl, cached: false })

  } catch (error) {
    // フォールバック: テキストのみ返却
    return NextResponse.json({
      error: 'TTS failed',
      fallback: 'text_only'
    }, { status: 202 }) // 202: 処理継続可能
  }
}
```

---

## 11. 監視とメトリクス

### 11.1 追踪すべき指標

| 指標 | 目標値 | 警告閾値 |
|------|--------|----------|
| TTS生成成功率 | > 99% | < 95% |
| 平均生成レイテンシー | < 500ms | > 1000ms |
| キャッシュヒット率 | > 40% | < 20% |
| APIエラー率 | < 1% | > 5% |

### 11.2 Cloud Loggingでの構造化ログ

```typescript
import { Logger } from '@google-cloud/logging-logger'

const logger = new Logger()

function logTTSMetrics(event: {
  userId: string
  textLength: number
  latency: number
  cached: boolean
  success: boolean
  modelId: string
}) {
  logger.log(
    'tts_generation',
    {
      user_id: event.userId,
      text_length: event.textLength,
      latency_ms: event.latency,
      cached: event.cached,
      success: event.success,
      model_id: event.modelId,
      timestamp: new Date().toISOString()
    }
  )
}
```

---

## 12. 参考ドキュメント

### 12.1 公式ドキュメント

- [ElevenLabs API Documentation](https://docs.elevenlabs.io/api-reference)
- [Voice Cloning Guide](https://docs.elevenlabs.io/learn/voice-cloning)
- [Text-to-Speech API](https://docs.elevenlabs.io/api-reference/text-to-speech)
- [Pricing Page](https://elevenlabs.io/pricing)

### 12.2 技術ブログ・記事

- ElevenLabs公式ブログ
- "Voice Cloning: A Technical Deep Dive"（ElevenLabs Engineering Blog）
- "Building Real-Time Voice AI Applications"（技術記事）

### 12.3 関連規格・ガイドライン

- OWASP Top 10 for LLM Applications
- NIST AI RMF Generative AI Profile
- GDPR・個人情報保護法（音声データの取扱い）

---

## 13. まとめと推奨事項

### 13.1 推奨実装プラン

**フェーズ1（MVP）**:
- Instant Voice Cloningを採用
- オンボーディングで3〜5分の音声収集
- `eleven_turbo_v2`モデルをデフォルト使用
- キャッシュ戦略を実装

**フェーズ2（品質向上）**:
- ユーザーフィードバックに基づきProfessional Cloningへ移行
- 30分以上の音声収集フローの実装
- `eleven_multilingual_v2`モデルの選択的適用

### 13.2 リスクと対策

| リスク | 対策 |
|--------|------|
| 高コスト | キャッシュ戦略、モデル選択最適化 |
| レイテンシー | ストリーミングAPI、`turbo`モデル |
| 音質ばらつき | オンボーディングでの品質チェック |
| プライバシー | データ最小化、暗号化、削除権利 |

### 13.3 今後の検討事項

1. エッジTTS（ローカル生成）の検討
2. 複数ボイスの切り替え（感情に応じた声質変化）
3. リアルタイムボイス変換（Voice Changer）
4. 他社TTSとの比較検討

---

**文書履歴**:
- v1.0 (2026-02-28): 初版作成
