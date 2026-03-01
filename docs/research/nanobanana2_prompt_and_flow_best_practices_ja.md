# Nanobanana2 顔ドット絵化: プロンプト/フロー ベストプラクティス（2026-02-28）

## 1. 目的
`Nanobanana2 -> 画像取得 -> リサイズ -> 減色 -> 背景透過 -> 2等身体テンプレ合成` のMVP運用で、
顔の再現性と「体テンプレへのハマりやすさ」を両立する実務向け指針をまとめる。

## 2. 調査メモ（一次情報中心）
- Google Gemini 画像生成ドキュメントでは、**意図を自然言語で明示し、構図・被写体・スタイルを具体化**することが推奨される。
- 同ガイドでは、曖昧な短語よりも、目的に沿った説明的プロンプトを使う方が安定しやすい。
- Diffusersの `img2img` / IP-Adapter の実装観点では、**identity保持は参照画像条件 + 強度パラメータ**のチューニングが主軸。
- Pillow公式ドキュメント上、ドット絵化の後段は `quantize()`（減色）と `NEAREST`（拡大）を組み合わせる設計が基本。

参照:
- https://ai.google.dev/gemini-api/docs/image-generation
- https://ai.google.dev/gemini-api/docs/imagen-prompt-guide
- https://huggingface.co/docs/diffusers/using-diffusers/img2img
- https://huggingface.co/docs/diffusers/using-diffusers/ip_adapter
- https://pillow.readthedocs.io/en/stable/reference/Image.html#PIL.Image.Image.quantize
- https://pillow.readthedocs.io/en/stable/handbook/concepts.html

## 3. Nanobanana2向けプロンプト設計

### 3.1 プロンプトの原則
- 1プロンプト1目的: 「顔だけ」「正面」「背景単色」を同時に固定する
- 禁止要素は明示: 「肩・上半身・背景ディテール・文字」を除外
- 出力用途を明示: 「2-head body template compositing」に合わせる

### 3.2 ベースプロンプト（顔のみ）
```text
game character face portrait of the same person, only head, centered face, frontal view,
no shoulders, no body, clean silhouette, solid background,
preserve facial identity, preserve eye shape, preserve nose and mouth proportion,
readable at small sprite size
```

### 3.3 ピクセル寄せプロンプト
```text
pixel art game character face portrait of the same person, only head, centered face,
16-bit retro sprite style, clean pixel clusters, crisp outline,
limited color palette, high contrast, solid background
```

### 3.4 ネガティブプロンプト
```text
realistic photo, full body, upper body, shoulders, hands,
detailed background, scenery, text, watermark,
blurry, low quality, deformed face, extra eyes, extra face
```

### 3.5 表情差分テンプレート
- neutral: `neutral expression, relaxed face`
- smile: `gentle smile, cheerful expression`
- sad: `sad expression, slightly downturned mouth`
- surprised: `surprised expression, widened eyes, open mouth`
- angry: `angry expression, frowning eyebrows`

## 4. 推奨フロー（MVP運用）
1. 入力写真を正方形クロップ（顔中心）
2. Nanobanana2で「顔のみ」生成
3. 生成画像を `512x512` に正規化
4. `24x24` へ縮小して減色（16-32色）
5. `64x64` へ `NEAREST` 拡大
6. 背景透過（キー抜き + 輪郭1pxクリーンアップ）
7. 体テンプレのヘッドスロットへ合成
8. `64x64` 本番画像と `128x128` プレビューを書き出し

## 5. 実験（IMG_3274）

### 5.1 実施内容
- 入力: `experiments/IMG_3274.jpg`
- 実施日: 2026-02-28
- 実験スクリプト: `experiments/pixel_face_lab/run_face_fit_experiment.py`
- 生成ステージ: 今回はローカル実験として、Nanobanana2生成部分を「入力写真からの顔ドット絵化」で代替

### 5.2 実行コマンド
```bash
python3 experiments/pixel_face_lab/run_face_fit_experiment.py \
  --input experiments/IMG_3274.jpg \
  --run-name img3274_face_fit_v1
```

### 5.3 出力
- 顔透過画像: `experiments/pixel_face_lab/output/img3274_face_fit_v1/face_64_rgba.png`
- 合成結果一覧: `experiments/pixel_face_lab/output/img3274_face_fit_v1/contact_sheet_composite_64.png`
- 合成個別: `experiments/pixel_face_lab/output/img3274_face_fit_v1/composite_64/*/*/0001.png`
- メタ情報: `experiments/pixel_face_lab/output/img3274_face_fit_v1/run_meta.json`

## 6. 実装時の注意点
- 顔スロット座標はテンプレ仕様に依存するため、`base64: (x=22,y=2,w=20,h=20)` を基準に倍率拡張する
- 背景透過は「背景色推定 + 距離閾値 + 形状マスク」の併用で安定化する
- 自動フォールバックは増やさず、閾値は運用で固定値管理する

## 7. 未確定点（次アクション）
- Nanobanana2 APIの実環境パラメータ（seed, image guidance相当）が確定したら、
  本ドキュメントの推奨値を実測で更新する
- 顔類似度評価（本人らしさ）を運用指標として追加する
