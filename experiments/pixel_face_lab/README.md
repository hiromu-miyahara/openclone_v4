# Pixel Face Lab（実験ネームスペース）

このディレクトリは、入力画像から「どんな顔ドット絵を作れるか」を素早く検証するための実験用ネームスペースです。

## 目的
- 1枚の画像から顔領域を切り出し
- 複数方式のドット絵バリエーションを自動生成
- 生成結果を一覧比較（コンタクトシート）して方式を見極める

## 構成
- `input/`: 検証元画像を置く
- `output/`: 生成結果（都度作成）
- `generate_face_pixel_variants.py`: 実験スクリプト
- `requirements.txt`: 実験依存
- `generate_fullbody_motion_gifs.py`: Nanobanana全身生成 + モーション6コマ生成 + GIF化
- `fullbody_motion_pose_presets.json`: モーションごとのフレームポージング定義

## セットアップ
```bash
cd experiments/pixel_face_lab
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 実行
```bash
cd experiments/pixel_face_lab
source .venv/bin/activate
python3 generate_face_pixel_variants.py \
  --input input/source.jpg \
  --run-name trial_001
```

## 生成物
- `output/<run-name>/face_crop.png`: 切り出し顔
- `output/<run-name>/variant_*.png`: 各方式のドット絵
- `output/<run-name>/contact_sheet.png`: 一覧比較画像
- `output/<run-name>/run_meta.json`: 実行パラメータ

## 顔領域の手動指定（任意）
自動切り出しがズレる場合は `--face-box x,y,w,h` を指定してください。

```bash
python3 generate_face_pixel_variants.py \
  --input input/source.jpg \
  --run-name trial_manual_crop \
  --face-box 120,80,360,360
```

## 補足
- この実験は「高速な品質比較」を目的に、まず Pillow ベース（非生成AI）で組んでいます。
- 次段で IP-Adapter / ControlNet 系の重い生成に進むかを判断しやすくする設計です。

## 全身モーション生成（Nanobanana実呼び出し）
`gemini-3.1-flash-image-preview` を使って、以下を一括実行します。
1. 入力写真から全身2等身ドット絵ベースを1枚生成
2. ベース画像を参照して、各モーションを6コマ生成
3. モーションごとにGIFとコンタクトシートを出力

```bash
python3 experiments/pixel_face_lab/generate_fullbody_motion_gifs.py \
  --input experiments/IMG_3274.jpg \
  --location global \
  --model gemini-3.1-flash-image-preview \
  --temperature 0 \
  --frames-per-motion 6 \
  --motions idle,speaking,nod,agree,surprised,thinking
```

主な出力:
- `output/<run-name>/base_fullbody.png`
- `output/<run-name>/motions/<motion>/frames/*.png`
- `output/<run-name>/motions/<motion>/<motion>.gif`
- `output/<run-name>/run_meta.json`
