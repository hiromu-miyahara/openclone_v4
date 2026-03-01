# Nanobanana2 全身ドット絵モーション: プロンプト/フロー実践メモ（2026-03-01）

## 1. 目的
`顔写真1枚 -> 全身ベース生成 -> モーション6コマ生成 -> GIF化` を、`gemini-3.1-flash-image-preview` で安定運用するための実務指針を定義する。

## 2. モデル実行条件（固定）
- モデル: `gemini-3.1-flash-image-preview`
- ロケーション: `global`
- 温度: `0`
- seed: 固定（例: `42`）
- 生成モダリティ: `TEXT + IMAGE`

## 3. プロンプト設計
### 3.1 ベース全身生成
```text
Use this person as reference and generate one full-body 16-bit pixel art chibi character,
super deformed two-head style, standing front view, arms visible, legs visible,
only one character centered, clean silhouette, crisp pixel edges, pure black background.
```

### 3.2 モーションフレーム生成
```text
Use this exact pixel-art full-body character as reference.
Keep same identity, same body shape, same outfit colors, same pixel style, same camera framing, same black background.
Create animation frame for motion '{motion}', frame {i}/{n}.
Pose/expression: {pose_desc}.
Only subtle pose change for smooth animation, no extra objects.
```

### 3.3 安定化ルール
- 1回目でベース画像を確定し、以降フレーム生成は必ずそのベース画像を参照入力に使う
- `same identity / same body shape / same outfit colors / same camera framing` を毎フレームに明記する
- 1フレームあたりの変化量は「小さく」を明示し、破綻を抑える

## 4. モーション定義（MVP）
- `idle`, `speaking`, `nod`, `agree`, `surprised`, `thinking`
- 各モーション `6` コマ
- ポーズ定義は `experiments/pixel_face_lab/fullbody_motion_pose_presets.json` で固定管理する

## 5. 推奨実行フロー
1. 入力写真を読み込み
2. Nanobananaでベース全身1枚を生成
3. モーションごとに6コマのポーズ記述でフレーム生成
4. モーションごとに `frames/*.png` をGIF化
5. `run_meta.json` にモデル条件・プロンプト・出力パスを保存

## 6. 既知の注意点
- フレーム間で頭身が揺れる場合は、ポーズ記述をさらに弱める（表情中心に寄せる）
- 背景ノイズが混入する場合は、`pure black background` など背景固定語を強める
- 同一性が崩れる場合は、seedを固定したままベース再生成を先に実施する
