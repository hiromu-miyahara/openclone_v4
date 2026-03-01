# OpenClone 顔ドット絵 + 体テンプレ合成 実現可能性メモ

## 1. 結論
提案方式（顔アップ画像から生成モデルで顔だけ本人似せ生成し、2等身の既定ボディに合成）はMVPで実現可能。  
1枚写真から複数表情が必要な要件では、画像処理のみの方式より適合性が高い。

## 2. 技術構成（推奨）
- 顔生成:
  - 第1候補: InstantID（顔領域に限定適用）
  - バックアップ: IP-Adapter
- 補助処理:
  - OpenCV（幾何変換、マスク）
  - Pillow（ドット化、合成）
- ボディ:
  - 事前作成2等身スプライト（性別 x 服装）

## 3. 実装フロー
1. ユーザーが顔アップ画像をアップロード
2. 顔領域を検出し、目・鼻・口基準で正規化
3. 生成モデルで表情違いの顔画像を複数生成し、ドット化
4. 首位置アンカーに対して affine で貼り付け
5. actionに応じて体テンプレのフレームを再生

## 4. なぜこの方式か
- メリット:
  - 生成の再現性が高い
  - 端末差・ネットワーク差の影響が小さい
  - GPU依存を最小化できる
- デメリット:
  - 髪型や服装の自由度は低い（テンプレ依存）

## 5. MVPでの割り切り
- 顔類似度を優先
- 体は2等身の4種テンプレ固定（male/female x formal/casual）
- 画質は96x96を標準、128x128をオプション

## 5.1 A/B方式の採用方針
- B方式（MVP採用）:
  - InstantIDを第1候補として採用
  - 品質/安定性が未達の場合はIP-Adapterへ切替
- A方式（代替）:
  - MediaPipe + OpenCV + Pillowによる顔ドット絵化とテンプレ合成
- 切替条件:
  - 人間評価でB方式が目標未達の場合のみA方式へ切替検討

## 6. 一次情報
- MediaPipe Face Landmarker:
  - https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker
- OpenCV Geometric Transformations:
  - https://docs.opencv.org/4.x/da/d54/group__imgproc__transform.html
- Pillow Image Transform:
  - https://pillow.readthedocs.io/en/stable/reference/Image.html#PIL.Image.Image.transform
- Pillow Quantize（減色）:
  - https://pillow.readthedocs.io/en/stable/reference/Image.html#PIL.Image.Image.quantize
