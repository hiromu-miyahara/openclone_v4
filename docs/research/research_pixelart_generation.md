# 写真からドット絵アニメーション生成技術調査レポート

**作成日:** 2026-02-28
**バージョン:** 1.0
**目的:** OpenCloneプロジェクトにおける全身ドット絵アバター生成技術の調査

---

## 1. エグゼクティブサマリー

本レポートは、ユーザーの写真からドット絵アニメーションを生成する技術について調査した結果をまとめる。MVP開発の観点から、**「事前生成アセット方式」**を推奨する。リアルタイム生成は技術的には可能だが、品質安定性・コスト・レイテンシーの観点から、ハッカソンMVPでは非推奨とする。

### 推奨アプローチ（MVP）
- ユーザー写真を元に、オフラインでドット絵アセットを一括生成
- 生成済みフレームを静的配信
- LLMはアクションラベルのみを出力し、フロントエンドが対応フレームを再生

### 将来の拡張案（v2以降）
- ControlNet + 専用LoRAによるオンデマンド生成
- 動的モーション合成

---

## 2. 技術調査：画像生成モデルによるドット絵生成

### 2.1 Stable Diffusion によるドット絵生成

#### 主要なアプローチ

| 手法 | 概要 | メリット | デメリット |
|------|------|----------|------------|
| **専用チェックポイント** | ドット絵専用にファインチューニングされたモデルを使用 | 高品質、一貫性 | 汎用性が低い |
| **LoRAスタイル適用** | 汎用モデルにドット絵LoRAを適用 | 柔軟、軽量 | 品質が変動しやすい |
| **プロンプトエンジニアリング** | "pixel art", "16-bit" 等のキーワードで制御 | 設定不要 | 再現性が低い |

#### 代表的なモデル（2024-2025）

1. **Pixel Art SD Models**
   - `PixelArtDiffusion`: 専用チェックポイント
   - `VoxelArt`: 立体ドット絵にも対応
   - Hugging Face で多数公開

2. **ControlNet による構造制御**
   - `Canny ControlNet`: 輪郭線維持
   - `Depth ControlNet`: 奥行き構造維持
   - `OpenPose`: ポーズ維持（全身アバターに最適）

3. **IP-Adapter**
   - 画像参照によるスタイル転送
   - ユーザー写真の特徴維持に有効

### 2.2 ComfyUI によるワークフロー構築

ComfyUI はノードベースのStable Diffusionインターフェースであり、複雑な処理パイプラインを視覚的に構築できる。

#### 推奨ワークフロー（写真→ドット絵）

```
[入力写真] → [IP-Adapter] → [ControlNet(OpenPose)] → [PixelArt LoRA] → [Upscale/Downscale] → [出力]
```

**ノード構成例:**
1. **CheckpointLoader**: ドット絵対応モデル
2. **LoadImage**: 入力写真
3. **ControlNetApply**: OpenPoseでポーズ制御
4. **LoraLoader**: ドット絵スタイルLoRA
5. **KSampler**: 生成パラメータ調整
6. **ImageResize**: 解像度変換（64x64/96x96）
7. **VAEDecode**: 画像出力

#### プログラマティック実行
- ComfyUI API を使用してバッチ処理可能
- JSON形式でワークフロー定義
- HTTPエンドポイントから実行

---

## 3. 写真からドット絵への変換手法

### 3.1 LoRAファインチューニング

#### 学習データセット
- **ソース画像**: 対象ユーザーの写真（多様なポーズ・角度）
- **ターゲット画像**: 対応するドット絵（手動または自動変換）
- **推奨サイズ**: 50-100枚程度

#### 訓練パラメータ

| パラメータ | 推奨値 |
|------------|--------|
| Rank | 16-32 |
| Learning Rate | 1e-4 〜 5e-4 |
| Steps | 1000-2000 |
| Resolution | 512x512 (SD 1.5) / 1024x1024 (SDXL) |

#### ツール
- **Kohya_ss**: LoRA訓練のデファクトスタンダード
- **TheLastBen Colab**: 簡易訓練環境
- **Automatic1111 WebUI**: GUIベース訓練

### 3.2 DreamBooth による対象化

DreamBoothはモデル全体をファインチューニングするため、特定キャラクターの再現に適している。

- ユニークトークン（例: `pzzl person`）を設定
- 専用モデルサイズ: 2GB-4GB
- 訓練時間: GPU A100で約20-30分

**MVP推奨**: DreamBoothはモデルサイズが大きくなるため、LoRAを推奨。

### 3.3 スタイル転送手法

#### Image-to-Image (img2img)
- 写真を入力に、ドット絵スタイルで生成
- Denoising Strength: 0.6-0.8 が適切

#### ControlNet
- 入力画像の構造を維持しつつスタイル転送
- Cannyエッジ + ポーズ制御が最も安定

---

## 4. ドット絵アニメーション生成手法

### 4.1 フレーム生成アプローチ

#### 手法1: 各フレームを個別生成
- メリット: 自由度が高い
- デメリット: フレーム間の一貫性が維持困難

#### 手法2: ベースフレーム + 変形
- 1フレーム目を高品質生成
- ControlNetで軽微な変形を適用
- 一貫性維持に最適

#### 手法3: 専用動画生成モデル（2025年トレンド）
- **AnimateDiff**: Stable Diffusionベースの動画生成
- **Stable Video Diffusion (SVD)**: 単眼画像から動画生成
- **Runway Gen-2 / Pika Labs**: クラウドAPIベース

### 4.2 モーション制御

#### OpenPoseベース制御
- 骨格情報でポーズを正確に制御
- ドット絵アバターのモーションに最適

#### Depth制御
- 奥行き情報を維持した変換
- 立体感のあるドット絵に有効

### 4.3 Interpolation（フレーム補完）

生成フレーム間を補完して滑らかなアニメーションにする手法:

- **FILM (Google)**: 高品質なフレーム補完
- **RIFE**: リアルタイム補完
- **DAIN**: アニメーション向け

---

## 5. セルフホスト vs クラウドAPI 比較

### 5.1 比較表

| 項目 | セルフホスト | クラウドAPI |
|------|--------------|-------------|
| **初期コスト** | 高（GPUサーバー） | 低 |
| **ランニングコスト** | 電気気代のみ | 従量課金 |
| **レイテンシー** | 低（ローカル） | 中〜高 |
| **カスタマイズ** | 自由度高 | 制約あり |
| **運用工数** | 高 | 低 |
| **セキュリティ** | 完全自制 | プロバイダ依存 |

### 5.2 主要クラウドAPI

| サービス | 料金（概算） | 特徴 |
|----------|--------------|------|
| **Stability AI** | $0.02-0.05 / 画 | SDXL、高品質 |
| **Replicate** | $0.001-0.01 / 秒 | モデル多様 |
| **Runway** | $0.05-0.20 / 秒 | 動画生成強み |
| **Fal.ai** | $0.0001-0.001 / 画 | 低レイテンシー |

### 5.3 OpenClone MVP 推奨構成

**ハッカソンMVP**: オフライン生成 + 静的配布
- 開発環境でComfyUI使用
- 生成アセットをCloud Storageに保存
- ランタイムは静的配信のみ

**v2以降**: Cloud Run + GPU (L4) でのオンデマンド生成検討

---

## 6. GCP環境での実装方法

### 6.1 GPUインスタンス選択

| GPU | 用途 | 月額費用（概算） |
|-----|------|-----------------|
| **NVIDIA L4** | 推論向け | $300-500 |
| **NVIDIA A10G** | 訓練/推論 | $800-1200 |
| **NVIDIA A100** | 大規模訓練 | $2000-3000 |

### 6.2 Cloud Run でのデプロイ

#### 推論コンテナ構成
```dockerfile
FROM python:3.11-slim

# Stable Diffusion dependencies
RUN pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
RUN pip install diffusers transformers accelerate

# API server
RUN pip install fastapi uvicorn

COPY . /app
WORKDIR /app

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

#### リソース設定
- CPU: 4-8 vCPU
- Memory: 16-32GB
- GPU: 1x L4 (必要時)
- Max Instances: 10-100

### 6.3 Vertex AI との統合

- **Vertex AI Model Garden**: 事前学習済みモデルをデプロイ
- **Vertex AI Pipelines**: 訓練パイプライン自動化
- **Vertex AI Endpoints**: 低レイテンシー推論

### 6.4 Cloud Storage によるアセット管理

```
gs://openclone-motion-assets/
├── {user_id}/
│   ├── idle/
│   │   ├── 0001.png
│   │   └── ...
│   ├── speaking/
│   └── ...
└── common/
    └── default_avatar/
```

---

## 7. 最新技術トレンド（2024-2025）

### 7.1 注目技術論文

1. **AnimateDiff (2023-2024)**
   - Stable Diffusionベースの動画生成
   - 一貫性のあるアニメーション生成が可能

2. **Stable Video Diffusion (SVD)**
   - 単眼画像から高品質動画
   - ドット絵変換との統合が容易

3. **LCM (Latent Consistency Model)**
   - 高速生成（ステップ数2-4で可能）
   - リアルタイム生成に適

### 7.2 ツール・ライブラリ

| ツール | 用途 | URL |
|--------|------|-----|
| **ComfyUI** | ノードベースGUI | github.com/comfyanonymous/ComfyUI |
| **Fooocus** | 簡易版SD | github.com/lllyasviel/Fooocus |
| **Kohya_ss** | LoRA訓練 | github.com/kohya-ss/sd-scripts |
| **Automatic1111** | WebUI標準 | github.com/AUTOMATIC1111 |

---

## 8. 制約事項

### 8.1 コスト

| 項目 | 見積もり |
|------|----------|
| **GPU開発環境** | $300-500/月 (L4) |
| **クラウドAPI（生成時）** | $0.02-0.05/アセット |
| **Cloud Storage** | $0.02/GB/月 |
| **Cloud Run（推論）** | $0.40/百万リクエスト |

**MVP推奨**: 生成は開発環境で実施し、静的配信のみ本番環境へ

### 8.2 レイテンシー

| 方法 | 平均レイテンシー | p95 |
|------|------------------|-----|
| **事前生成配信** | <50ms | <100ms |
| **クラウドAPI生成** | 3-8秒 | 10-15秒 |
| **セルフホストGPU** | 1-3秒 | 3-5秒 |
| **LCM高速生成** | 0.5-1秒 | 1-2秒 |

### 8.3 品質

| 解像度 | 用途 | 品質目安 |
|--------|------|----------|
| 32x32 | 最小 | 認識レベル |
| 64x64 | 推奨最小 | 実用レベル |
| 96x96 | **MVP推奨** | 高品質 |
| 128x128 | 高品質 | 制作工数増 |

---

## 9. 実装ロードマップ

### Phase 1: MVP（ハッカソン）

1. 既存ドット絵アセットを活用（フリー素材）
2. 7アクション x 10フレーム = 70枚
3. 静的配信のみ実装
4. LLMStructured Outputでアクション制御

### Phase 2: 写真対応（v1.1）

1. ComfyUIワークフロー構築
2. ユーザー写真アップロード機能
3. オフラインバッチ処理でドット絵生成
4. Cloud Storageへ配信

### Phase 3: リアルタイム生成（v2.0）

1. Cloud Run + GPU環境構築
2. LCMによる高速生成
3. オンデマンドモーション生成

---

## 10. 参考URL

### モデル・ツール
- [ComfyUI - GitHub](https://github.com/comfyanonymous/ComfyUI)
- [Stable Diffusion - Hugging Face](https://huggingface.co/models?search=stable+diffusion)
- [ControlNet - Hugging Face](https://huggingface.co/models?search=controlnet)
- [Kohya_ss Training Scripts](https://github.com/kohya-ss/sd-scripts)
- [AnimateDiff - Hugging Face](https://huggingface.co/models?search=animatediff)

### GCP
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Vertex AI Model Garden](https://cloud.google.com/vertex-ai/docs/model-garden)
- [Deep Learning VM Image](https://cloud.google.com/ai-platform/deep-learning-vm/docs)

### コミュニティ
- [Civitai - Pixel Art Models](https://civitai.com/)
- [Stable Diffusion Art - Pixel Art Guide](https://stable-diffusion-art.com/)
- [Reddit - r/StableDiffusion](https://reddit.com/r/StableDiffusion)

---

## 11. 結論と推奨事項

### MVP 推奨構成
1. **アセット生成**: ComfyUI + 専用LoRAでオフライン生成
2. **配信**: Cloud Storage による静的配信
3. **制御**: LLM Structured Output でアクションラベル出力
4. **表示**: フロントエンドでCanvasベースのアニメーション

### 将来の拡張ポイント
1. ユーザー写真からの自動ドット絵生成（バッチ処理）
2. LCMによるリアルタイム生成（v2以降）
3. AnimateDiffによる動的モーション合成

### リスク管理
1. **品質のばらつき**: 手動レビューまたは自動品質スコアリング導入
2. **コスト増大**: 生成頻度の制限とキャッシュ戦略
3. **レイテンシー**: 事前生成を基本とし、オンデマンドはオプション

---

**文書の所有者:** OpenClone プロジェクトチーム
**最終更新:** 2026-02-28
