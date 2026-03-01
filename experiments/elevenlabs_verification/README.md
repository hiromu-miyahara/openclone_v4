# ElevenLabs Voice Cloning 検証環境

## 目的
複数の音声データを結合し、声質再現（Voice Cloning）が可能か技術検証を行う。

## ディレクトリ構成

```
experiments/elevenlabs_verification/
├── audio_samples/          # 検証用音声ファイルの配置場所 (.mp3, .wav, .m4a等)
├── voice_profiles/         # 作成したボイスプロファイルの設定保存先
├── scripts/                # 検証スクリプト
├── results/                # 生成結果とログ
├── .env                    # 環境変数（APIキー等）
├── requirements.txt        # Python依存パッケージ
└── README.md               # 本ファイル
```

## セットアップ手順

### 1. 依存パッケージのインストール

```bash
cd experiments/elevenlabs_verification
pip install -r requirements.txt
```

**注意**: `pydub` はシステムに ffmpeg が必要です。
- macOS: `brew install ffmpeg`
- Ubuntu: `sudo apt install ffmpeg`

### 2. 環境変数の設定

`.env.example` をコピーしてAPIキーを設定：

```bash
cp .env.example .env
```

`.env` ファイルを編集して `ELEVENLABS_API_KEY` にあなたのAPIキーを設定してください。

### 3. 音声データの配置

`audio_samples/` ディレクトリに検証用音声ファイルを配置してください。

- フォーマット: MP3, WAV, M4A等
- 推奨条件:
  - 長さ: 30秒以上（複数ファイルで合計1〜3分程度）
  - クリアな音声（ノイズ少ない、一人で喋っている）
  - 様々な感情・トーンを含むと精度向上

## 検証フロー

1. **音声結合**: 複数の音声ファイルを1つに結合
2. **ボイスクローン作成**: 結合音声を元にボイスプロファイルを作成
3. **テキスト読み上げ**: 作成したボイスでテキストを読み上げ
4. **品質評価**: 生成音声の品質を確認

## 使用方法

詳細な検証スクリプトは `scripts/` ディレクトリに順次追加予定です。

基本的なフロー：

```python
from scripts.voice_cloning import (
    combine_audio_files,
    create_voice_clone,
    generate_speech
)

# 1. 音声結合
combined_audio = combine_audio_files("audio_samples/*.mp3", "results/combined.mp3")

# 2. ボイスクローン作成
voice_id = create_voice_clone(
    name="test_voice",
    audio_file="results/combined.mp3",
    description="検証用ボイスクローン"
)

# 3. テキスト読み上げ
generate_speech(
    voice_id=voice_id,
    text="こんにちは、これはテストです。",
    output_path="results/test_output.mp3"
)
```

## ElevenLabs API 制限

- 無料枠: 月10,000文字
- ボイスクローニング: アカウントごとに制限あり
- 詳細: https://elevenlabs.io/pricing

## 注意事項

- APIキーは絶対にリポジトリにコミットしないでください
- 音声データの著作権・プライバシーに注意してください
- 生成した音声の商用利用にはElevenLabsの利用規約を確認してください
