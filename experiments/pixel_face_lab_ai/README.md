# Pixel Face Lab AI（IP-Adapter + Diffusion 検証）

このディレクトリは、入力写真から `IP-Adapter + Stable Diffusion XL` で顔寄せドット絵を生成する実験用ネームスペースです。

## 目的
- 画像処理ベースではなく、生成AIベースで「顔らしさ」をどこまで維持できるかを検証する
- `ip_adapter_scale` と `controlnet_conditioning_scale` の探索を行う

## 構成
- `input/`: 入力画像
- `output/`: 実験結果
- `run_ipadapter_pixel_diffusion.py`: 実行スクリプト
- `requirements.txt`: 依存

## セットアップ
```bash
cd experiments/pixel_face_lab_ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 実行（最小）
```bash
cd experiments/pixel_face_lab_ai
source .venv/bin/activate

python3 run_ipadapter_pixel_diffusion.py \
  --input ../IMG_3274.jpg \
  --run-name trial_ipa_001
```

## 実行（ローカルキャッシュのみ）
```bash
python3 run_ipadapter_pixel_diffusion.py \
  --input ../IMG_3274.jpg \
  --run-name trial_ipa_offline \
  --local-files-only \
  --cache-dir ~/.cache/huggingface
```

## 実行（Canny ControlNet 併用）
```bash
python3 run_ipadapter_pixel_diffusion.py \
  --input ../IMG_3274.jpg \
  --run-name trial_ipa_canny_001 \
  --use-canny-controlnet
```

## 出力
- `output/<run-name>/input_square.png`
- `output/<run-name>/variant_*.png`
- `output/<run-name>/contact_sheet.png`
- `output/<run-name>/run_meta.json`

## 主要パラメータ
- `--num-steps`: 推論ステップ（既定: 40）
- `--guidance-scale`: CFG（既定: 7.5）
- `--strength`: img2img強度（既定: 0.55）
- `--ip-scales`: IP-Adapterの強度をカンマ区切りで指定（既定: `0.45,0.6,0.75`）
- `--control-scales`: ControlNet強度（既定: `0.2,0.35`）

## モデルID（固定）
- Base: `stabilityai/stable-diffusion-xl-base-1.0`
- IP-Adapter: `h94/IP-Adapter` + `ip-adapter_sdxl.bin`
- ControlNet(Canny): `diffusers/controlnet-canny-sdxl-1.0`

`latest` は使わず固定IDにしています。

## トラブルシュート
- `torch が見つかりません`:
  - `.venv` を有効化して `pip install -r requirements.txt`
- `model is not cached locally`:
  - ネットワーク接続ありで一度モデルを取得するか、`--local-files-only` を外して実行
  - もしくは `--cache-dir` に既存キャッシュを指定

## GCP GPU クイックテスト
このリポジトリには VM 作成から回収までを自動化したスクリプトを同梱しています。

スクリプト:
- `cloud_gpu_quicktest.sh`

実行例:
```bash
cd /Users/kokifunahashi/Documents/openclone
bash experiments/pixel_face_lab_ai/cloud_gpu_quicktest.sh \
  --project archimedes-technologies-ir-ai \
  --zone asia-northeast1-a \
  --image experiments/IMG_3274.jpg
```

補足:
- 実行前に `gcloud auth login` が必要です
- デフォルトで `g2-standard-8 + nvidia-l4` を使います
- テスト後は VM を自動削除します（残したい場合は `--keep-vm`）

## Hugging Face Jobs での実行
`Hugging Face Job` のGPUでこの実験を回せます。  
このリポジトリにはジョブ用スクリプトを同梱しています。

対象ファイル:
- `hf_job_pixel_diffusion.py`（UV script）
- `run_hf_job.sh`（投げるためのラッパー）

### 事前準備（あなたに必要な情報）
1. `入力画像URL`（公開URL）
2. `出力保存先のDataset repo`（例: `yourname/pixel-face-lab-results`）
3. `HF_TOKEN`（読み書き権限）

### 事前準備（ローカル）
```bash
pip install -U "huggingface_hub[cli]"
hf auth login
```

`HF_TOKEN` は Hugging Face Jobs の Secret として `HF_TOKEN` 名で登録してください（UIまたはCLI）。

### ジョブ投入
```bash
cd /Users/kokifunahashi/Documents/openclone
bash experiments/pixel_face_lab_ai/run_hf_job.sh \
  --input-url "https://example.com/IMG_3274.jpg" \
  --output-repo "yourname/pixel-face-lab-results"
```

初回の推奨（軽量・完走優先）:
```bash
bash experiments/pixel_face_lab_ai/run_hf_job.sh \
  --input-url "https://example.com/IMG_3274.jpg" \
  --output-repo "yourname/pixel-face-lab-results" \
  --no-canny \
  --num-steps 12 \
  --work-size 768 \
  --ip-scales "0.60"
```

LoRA比較（同一パイプラインで Baseline vs Pixel LoRA）:
```bash
bash experiments/pixel_face_lab_ai/run_hf_job.sh \
  --input-url "https://example.com/IMG_3274.jpg" \
  --output-repo "yourname/pixel-face-lab-results" \
  --no-canny \
  --num-steps 12 \
  --work-size 768 \
  --ip-scales "0.60" \
  --pixel-lora-repo "owner/pixel-art-lora" \
  --pixel-lora-weight "pixel_art.safetensors" \
  --lora-scales "0.80"
```

顔ニュアンス維持向けの推奨プロンプト（デフォルト実装済み）:
- Base:
  - `portrait of the same person, preserve facial identity, preserve eye shape, preserve nose and mouth proportion, clean face lighting, bust shot`
- Pixel LoRA:
  - `pixel art portrait of the same person, preserve facial identity, preserve eye shape, preserve nose and mouth proportion, 16-bit retro sprite style, clean edges, limited color palette, high-contrast clusters, readable face`

## 顔だけ出力ジョブ（2頭身合成向け）
顔検出→顔中心クロップ→生成→顔のみ最終出力を行う専用ジョブです。

対象ファイル:
- `hf_job_face_only_pixel.py`
- `run_hf_job_face_only.sh`

実行例:
```bash
cd /Users/kokifunahashi/Documents/openclone
export HF_TOKEN="$(cat ~/.cache/huggingface/token)"
bash experiments/pixel_face_lab_ai/run_hf_job_face_only.sh \
  --input-url "https://huggingface.co/datasets/funashi/pixel-face-lab-results/resolve/main/IMG_3274.jpg" \
  --output-repo "funashi/pixel-face-lab-results" \
  --pixel-lora-repo "nerijs/pixel-art-xl" \
  --pixel-lora-weight "pixel-art-xl.safetensors" \
  --expressions "neutral,smile,sad,surprised,angry"
```

注意:
- `--ip-adapter-weight` は既定で `ip-adapter_sdxl.bin` を使います（互換性重視）
- `ip-adapter-plus-face_sdxl_vit-h.safetensors` は環境により次元不整合エラーになる場合があります
- `PEFT backend is required` が出る場合:
  - 依存に `peft` が必要です（`run_hf_job_face_only.sh` は `uv --with peft>=0.12.0` を強制）

出力:
- `*_full.png`: 生成フル画像
- `*_face_only.png`: 顔のみクロップ画像（2頭身合成向け）
- `contact_sheet_face_only.png`: 比較一覧

補足:
- デフォルトは Pixel LoRAベースのみ生成（写真感を減らしキャラ寄せ）
- `--include-baseline` を付けると LoRAなし結果も併せて出力

### 進行確認
```bash
hf jobs ps
hf jobs logs <job_id>
```

### コスト節約のコツ
- まず `--no-canny` で回して軽く検証
- `--flavor a10g-small` から開始
- `--num-steps` は 20 前後で比較し、必要時のみ増やす
