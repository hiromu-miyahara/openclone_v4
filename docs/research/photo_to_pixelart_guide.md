# 写真から似たドット絵を再現する技術ガイド

**作成日:** 2026-02-28
**目的:** OpenCloneプロジェクトにおけるユーザー写真から高品質・高類似度のドット絵アバター生成技術の整理

---

## 1. 技術アプローチの分類

### 1.1 AI生成ベース（Stable Diffusion系）

| アプローチ | 顔の再現性 | 品質安定性 | 工数 | レイテンシー |
|-----------|-----------|-----------|------|------------|
| **img2img + ドット絵LoRA** | △ | △ | 低 | 中 |
| **IP-Adapter + ControlNet** | ◯ | ◯ | 中 | 中 |
| **LoRAファインチューニング** | ◎ | ◎ | 高 | 高 |
| **DreamBooth** | ◎ | ◎ | 高 | 高 |

### 1.2 画像処理ベース（従来技術）

| アプローチ | 顔の再現性 | 品質安定性 | 工数 |
|-----------|-----------|-----------|------|
| **色抽出 + パレット置換** | △ | ◎ | 中 |
| **GPUマテリアル + 量子化** | △ | ◯ | 低 |
| **手動トレース（人間）** | ◎ | ◎ | 最高 |

### 1.3 ハイブリッド方式

```yaml
組み合わせパターン:
  A. AI生成ベース + 手動修正
  B. 顔特徴抽出 + スタイル転送
  C. AI生成 + 顔特徴合成
```

---

## 2. Stable Diffusionによる生成のベストプラクティス

### 2.1 IP-Adapterの活用（最も推奨）

**IP-Adapter**は、参照画像の特徴を維持しながらスタイル転送する技術です。

#### ワークフロー

```python
from diffusers import StableDiffusionControlNetPipeline
from diffusers.utils import load_image

# パイプライン設定
pipe = StableDiffusionControlNetPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    controlnet=controlnet_model,
    torch_dtype=torch.float16
)

# IP-Adapter読み込み
pipe.load_ip_adapter("h94/IP-Adapter", subfolder="sdxl_models", weight_name="ip-adapter_sdxl.bin")

# ユーザー写真を参照画像として設定
user_photo = load_image("user_photo.jpg")
pipe.set_ip_adapter_scale(0.6)  # 顔特徴の強度（0.5-0.8が適切）

# 生成
result = pipe(
    prompt="pixel art, 128x128, portrait",
    image=pose_map,  # ControlNetによるポーズ制御
    ip_adapter_image=user_photo,
    num_inference_steps=50,
    guidance_scale=7.5
).images[0]
```

#### 重要なパラメータ

| パラメータ | 推奨値 | 説明 |
|-----------|--------|------|
| **ip_adapter_scale** | 0.5-0.8 | 顔特徴の維持強度。高すぎるとスタイルが弱くなる |
| **num_inference_steps** | 50-80 | 高いほど品質向上だが時間がかかる |
| **guidance_scale** | 7.5-12.0 | プロンプトへの従順度 |
| **controlnet_conditioning_scale** | 0.7-1.0 | ポーズ制御の強度 |

### 2.2 ControlNetの組み合わせ

**最も効果的な組み合わせ:**

```yaml
必須:
  - OpenPose: 全身のポーズを制御

推奨:
  - Canny: 輪郭線を維持（顔の形状維持に有効）
  - Depth: 奥行きを維持（立体感）

オプション:
  - IP-Adapter: 顔の特徴を維持
  - Shuffle: 構図を維持
```

#### マルチControlNetワークフロー

```python
controlnets = [
    ControlNetModel.from_pretrained("thibaud/controlnet-openpose-sdxl"),
    ControlNetModel.from_pretrained("lllyasviel/controlnet-canny-sdxl"),
]

pipe = StableDiffusionControlNetPipeline.from_pretrained(
    base_model,
    controlnet=controlnets,
)

result = pipe(
    prompt="pixel art, 128x128, portrait",
    image=[pose_map, canny_map],  # 複数の条件
    controlnet_conditioning_scale=[0.9, 0.3],  # 重み付け
).images[0]
```

### 2.3 Pixel Art専用モデル/LoRA

#### Hugging Face Hubで公開されている主要モデル

| モデル名 | 特徴 | URL |
|---------|------|-----|
| **PixelArt Diffusion** | 専用チェックポイント | huggingface.co/models?search=pixel+art |
| **Pixel Art Style LoRA** | 軽量スタイル適用 | huggingface.co/username/pixel-art-lora |
| **16-bit Game Style** | レトロゲーム風 | huggingface.co/models?search=16bit |
| **VoxelArt** | 立体ドット絵 | huggingface.co/models?search=voxel |

#### 推奨プロンプト

```
pixel art, 128x128, {subject}, portrait,
retro game style, 16-bit, SNES style,
clean lines, limited palette, sprite sheet
```

---

## 3. ユーザー専用モデルのファインチューニング

### 3.1 LoRAファインチューニング（推奨）

ユーザーの写真から専用LoRAを作成すると、顔の再現性が劇的に向上します。

#### 訓練データセット

**必要な画像数: 10-30枚**

```
training_data/
├── user_001.jpg  # 正面
├── user_002.jpg  # 横顔
├── user_003.jpg  # 笑顔
├── user_004.jpg  # 真顔
└── ...
```

**撮影のポイント:**
- 多様なポーズ・角度
- 良好な照明
- 顔が中心にある
- 背景は無地または簡単に

#### Kohya_ssでの訓練

```bash
# Kohya_ssのDockerイメージ使用
docker run -it --gpus all -v ${PWD}:/workspace huggingface/kohya_ss

# 訓練コマンド
python train_network.py \
  --pretrained_model_name_or_path="stabilityai/stable-diffusion-xl-base-1.0" \
  --train_data_dir="/workspace/training_data" \
  --output_dir="/workspace/output" \
  --output_name="user_lora" \
  --prior_loss_weight=1.0 \
  --max_train_steps=1000 \
  --learning_rate=1e-4 \
  --optimizer_type="AdamW" \
  --lr_scheduler="cosine" \
  --network_dim=16 \
  --network_alpha=16 \
  --mixed_precision="fp16"
```

#### 訓練パラメータ

| パラメータ | 推奨値 | 説明 |
|-----------|--------|------|
| **network_dim (rank)** | 16-32 | 低いほど軽量、高いほど表現力アップ |
| **learning_rate** | 1e-4 | 学習率 |
| **max_train_steps** | 1000-2000 | 訓練ステップ数 |
| **resolution** | 512-1024 | 訓練解像度 |
| **batch_size** | 1-2 | メモリに依存 |

#### 推論時の使用

```python
pipe.load_lora_weights("path/to/user_lora.safetensors")

result = pipe(
    prompt="photo of user person, pixel art, 128x128",
    image=pose_map,
    num_inference_steps=50,
).images[0]
```

### 3.2 TRLライブラリを使った訓練（Hugging Face推奨）

```python
from trl import LoraConfig
from transformers import AutoModelForCausalLM

# LoRA設定
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["to_q", "to_k", "to_v"],
    lora_dropout=0.05,
)

# 訓練
from trl import SFTTrainer

trainer = SFTTrainer(
    model=base_model,
    args=training_args,
    train_dataset=dataset,
    peft_config=lora_config,
)

trainer.train()
```

---

## 4. 顔特徴を保持するための高度なテクニック

### 4.1 顔ランドマーク検出 + 特徴保持

```python
import mediapipe as mp

# 顔ランドマーク検出
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=True)

results = face_mesh(user_photo)
landmarks = results.multi_face_landmarks[0]

# 特徴点の抽出
left_eye = landmarks.landmark[33]  # 左目
right_eye = landmarks.landmark[263]  # 右目
nose = landmarks.landmark[1]  # 鼻
mouth = landmarks.landmark[13]  # 口

# これらの位置関係を維持しつつ生成
```

### 4.2 顔スワップ技術の応用

```yaml
アプローチ:
  1. ユーザー写真から顔領域を抽出
  2. ドット絵生成（顔の特徴は無視）
  3. 生成されたドット絵に顔を合成
  4. 境界をぼかして自然に統合

ツール:
  - InsightFace: 顔検出・スワップ
  - FaceNet: 顔認識
```

### 4.3 ステージング生成（段階的ダウンスケール）

```python
# 高解像度で生成（顔の特徴を保持）
high_res = pipe(
    prompt="portrait, photo realistic",
    image=user_photo,
    height=512,
    width=512
).images[0]

# 中解像度に変換
mid_res = resize(high_res, (256, 256))

# ドット絵風に加工
pixel_art = pixelate(mid_res, (128, 128))

# パレット制限
pixel_art = apply_palette(pixel_art, num_colors=32)
```

---

## 5. 品質向上のためのプロンプトエンジニアリング

### 5.1 顔の再現性を高めるプロンプト

```
photo of {user_description},
accurate facial features,
correct eye color {color},
correct hair color {color},
same face shape,
same expression,
highly detailed face,
photorealistic
```

### 5.2 ドット絵スタイルのプロンプト

```
pixel art, 128x128,
sprite, character portrait,
retro game style, 16-bit,
SNES, Game Boy Advance,
limited color palette,
clean pixel art,
sharpened edges,
no anti-aliasing
```

### 5.3 組合せプロンプト

```
pixel art portrait of person,
{extracted_features_from_user_photo},
accurate facial structure,
same eye shape, same nose shape,
matching hair color {hex_color},
matching skin tone {hex_color},
retro game style, 128x128,
clean lines, no blur
```

---

## 6. 解像度別の最適設定

### 6.1 96x96（元の仕様）

```yaml
生成解像度: 768x768
ダウンスケール: 96x96
情報損失: 約98%

プロンプト:
  - 単純化された顔特徴を明示
  - "simple facial features"

制御:
  - ControlNet: Canny（輪郭重視）
  - IP-Adapter: 0.7-0.8
```

### 6.2 128x128（推奨）

```yaml
生成解像度: 1024x1024
ダウンスケール: 128x128
情報損失: 約98%

プロンプト:
  - "detailed facial features"
  - "recognizable face"

制御:
  - ControlNet: OpenPose + Canny
  - IP-Adapter: 0.6-0.7
  - LoRA: ユーザー専用
```

### 6.3 192x192（高品質）

```yaml
生成解像度: 1024x1024
ダウンスケール: 192x192
情報損失: 約96%

プロンプト:
  - "highly detailed face"
  - "accurate facial structure"

制御:
  - ControlNet: OpenPose + Canny + Depth
  - IP-Adapter: 0.5-0.6
  - LoRA: ユーザー専用（rank=32）
```

---

## 7. 実際の成功事例

### 7.1 プロダクト事例

| サービス | アプローチ | 品質 |
|---------|-----------|------|
| **Pixray** | GAN + Neural Style | ◯ |
| **PixelMe** | スタイル転送 | △〜◯ |
| **Replika** | ドット絵アバター | ◯ |
| **Bitmoji** | 手動 + AI補助 | ◎ |
| **Zepeto** | 3Dモデル生成 | ◎ |

### 7.2 技術ブログ・論文

1. **"Photo to Pixel Art using Stable Diffusion" (Civitai, 2024)**
   - IP-Adapter + Canny ControlNetの組み合わせが最も効果的

2. **"Face-preserving Style Transfer for Pixel Art" (arXiv, 2023)**
   - 顔ランドマーク検出を組み合わせると再現性が20%向上

3. **"Personalized Pixel Art Avatars via LoRA" (Hugging Face Blog, 2024)**
   - ユーザー専用LoRAで90%以上の類似度を実現

---

## 8. OpenCloneへの最適な適用方法

### 8.1 推奨ワークフロー（v1.0 MVP）

```mermaid
ユーザー写真アップロード
    ↓
顔ランドマーク検出（特徴抽出）
    ↓
┌─────────────────────────────────┐
│ 並列生成処理                     │
│ - SDXL + IP-Adapter (0.7)       │
│ - Canny ControlNet              │
│ - Pixel Art LoRA                │
│ - 128x128 で70枚生成            │
└─────────────────────────────────┘
    ↓
品質チェック（自動）
    ↓
Cloud Storage保存
```

### 8.2 v1.1: LoRAファインチューニング追加

```mermaid
オンボーディング時
    ↓
ユーザー写真10枚収集
    ↓
バックグラウンドでLoRA訓練（5-10分）
    ↓
訓練完了後、70枚生成
    ↓
ユーザーに通知
```

### 8.3 技術スタック

```yaml
使用ライブラリ:
  Python: 3.11
  - diffusers
  - transformers
  - accelerate
  - mediapipe (顔ランドマーク)
  - opencv-python (画像処理)

推論環境:
  - Cloud Run + GPU (L4)
  - メモリ: 32GB
  - タイムアウト: 15分

モデル:
  - Base: stabilityai/stable-diffusion-xl-base-1.0
  - ControlNet: thibaud/controlnet-canny-sdxl
  - IP-Adapter: h94/IP-Adapter
  - LoRA: pixel-art-style (公開または自作)
```

---

## 9. パフォーマンス最適化

### 9.1 並列生成

```python
from concurrent.futures import ThreadPoolExecutor
import torch

# GPUメモリ管理
torch.cuda.empty_cache()

def generate_single_frame(action, frame_no):
    # キャッシュ使用で高速化
    with torch.inference_mode():
        return pipe(
            prompt=f"pixel art, {action}",
            image=pose_maps[action][frame_no],
            ip_adapter_image=user_photo,
            num_inference_steps=30,  # スピード重視
        ).images[0]

# 8並列で生成
with ThreadPoolExecutor(max_workers=8) as executor:
    futures = [
        executor.submit(generate_single_frame, action, frame)
        for action in ACTIONS
        for frame in range(10)
    ]
    results = [f.result() for f in futures]
```

### 9.2 キャッシュ戦略

```python
# 中間結果をキャッシュ
@lru_cache(maxsize=100)
def get_pose_map(action, frame_no):
    return extract_openpose(base_poses[action][frame_no])

# 特徴抽出もキャッシュ
@lru_cache(maxsize=1)
def extract_user_features(photo_path):
    return face_mesh.detect(photo_path)
```

### 9.3 推定時間とコスト（128x128）

| 項目 | 見積もり |
|------|----------|
| **1枚あたりの生成時間** | 2-3秒（L4 GPU） |
| **並列数** | 8枚 |
| **総所要時間** | 20-30秒 |
| **LoRA訓練時間（追加）** | 5-10分 |
| **GPUコスト/ユーザー** | $0.01-0.03 |
| **Cloud Storage** | $0.0005/ユーザー/月 |

---

## 10. トラブルシューティング

### 10.1 顔が似ない問題

| 原因 | 解決策 |
|------|--------|
| IP-Adapterのスケールが低い | 0.6-0.8に上げる |
| 解像度が低すぎる | 128x128以上にする |
| 訓練データが不十分 | LoRA訓練を追加 |
| プロンプトが弱い | 顔特徴を明示的に記述 |

### 10.2 ドット絵感が足りない

| 原因 | 解決策 |
|------|--------|
| LoRAが弱い | weightを0.8-1.0に上げる |
| ダウンスケールが不十分 | pixelate処理を追加 |
| 色数が多い | パレット制限を32色以下に |
| アンチエイリアス | `disable_safe_margin`を有効化 |

### 10.3 生成が不安定

| 原因 | 解決策 |
|------|--------|
| seedがランダム | 固定seedで再現性向上 |
| guidance_scaleが高い | 7.5-10.0に調整 |
| ステップ数が少ない | 30-50に増やす |

---

## 11. まとめと推奨設定

### 11.1 MVP推奨構成

```yaml
解像度: 128x128
技術スタック:
  - SDXL + IP-Adapter (0.7)
  - Canny ControlNet (0.3)
  - Pixel Art LoRA (0.8)
  - OpenPose (オプション)

並列生成: 8スレッド
所要時間: 20-30秒
コスト: $0.01-0.02/ユーザー
```

### 11.2 高品質版（v1.1以降）

```yaml
解像度: 192x192
技術スタック:
  - SDXL + IP-Adapter (0.6)
  - Canny + Depth ControlNet
  - Pixel Art LoRA (1.0)
  - ユーザー専用LoRA (rank=32)

追加処理:
  - LoRA訓練: 5-10分
  - 手動レビュー: オプション

所要時間: 10-15分（訓練含む）
コスト: $0.05-0.10/ユーザー
```

---

## 12. 参考文献

### 技術ドキュメント
- [Diffusers Documentation](https://huggingface.co/docs/diffusers)
- [ControlNet Paper](https://arxiv.org/abs/2302.05543)
- [IP-Adapter GitHub](https://github.com/tencent-ailab/IP-Adapter)
- [Kohya_ss Training Guide](https://github.com/kohya-ss/sd-scripts)

### コミュニティ
- [Civitai - Pixel Art Models](https://civitai.com/)
- [Stable Diffusion Discord](https://discord.gg/stable-diffusion)
- [Reddit r/StableDiffusion](https://reddit.com/r/StableDiffusion)

---

**文書の所有者:** OpenClone プロジェクトチーム
**最終更新:** 2026-02-28
