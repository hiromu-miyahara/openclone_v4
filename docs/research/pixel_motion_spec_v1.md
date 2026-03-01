# OpenClone 全身ドット絵モーション仕様 v1.1

## 1. 目的
LLMのStructured Outputで返る `action` に応じて、全身ドット絵モーションを安定再生するための実装仕様を定義する。

## 2. アクション種別（英語キー / 日本語意味）
- `idle`: 待機
- `thinking`: 考え込み
- `speaking`: 発話
- `nod`: うなずき
- `agree`: 賛同
- `surprised`: 驚き
- `emphasis`: 強調

## 3. Structured Output仕様
```json
{
  "text": "まずは小さく試そう。次に改善していこう。",
  "action": "emphasis"
}
```

### 3.1 バリデーション
- `action` は上記の列挙値のみ許可
- 不正値は `speaking` に正規化

## 4. モーション品質プロファイル
### A. ハッカソン最短（低工数）
- 解像度: `64x64`
- FPS: `6`
- フレーム数: `4〜6`
- 目安: 実装は最速だが動きは単調になりやすい

### B. バランス重視（コスト優先）
- 解像度: `96x96`
- FPS: `8`
- フレーム数: `8〜12`
- 目安: スマホ表示で十分高品質、制作工数も許容範囲

### C. 高品質/顔再現重視（MVP採用）✅
- 解像度: `128x128`
- FPS: `8`
- フレーム数: `10`
- 目安: 顔の識別が可能レベル、ドット絵感も十分

### D. 超高品質（工数高）
- 解像度: `192x192`
- FPS: `10〜12`
- フレーム数: `12〜16`
- 目安: 顔の再現性は高いが、ドット絵感は薄れる

## 5. MVP推奨値
- 採用プロファイル: `C. 高品質/顔再現重視` ✅
- 固定値:
  - 解像度: `128x128`
  - FPS: `8`
  - 1アクションあたり: `10フレーム`
  - ループ: `idle/thinking/speaking` のみループ
  - ワンショット: `nod/agree/surprised/emphasis`
- 技術スタック:
  - IP-Adapter (0.6-0.7): 顔特徴維持
  - Canny ControlNet (0.3): 輪郭維持
  - Pixel Art LoRA (0.8): スタイル適用
  - 将来拡張: ユーザー専用LoRA（v1.1以降）

## 6. モック生成案（デモ向け）
- `7 actions x 10 frames = 70枚` を先に作成
- 優先順:
  1. `idle`
  2. `speaking`
  3. `thinking`
  4. `nod`
  5. `agree`
  6. `surprised`
  7. `emphasis`

## 7. 命名規則
- 画像パス:
  - `/assets/motion/{action}/{frame_no}.png`
- 例:
  - `/assets/motion/speaking/0001.png`
  - `/assets/motion/speaking/0002.png`

## 8. 実装メモ
- オンボーディング時にユーザー写真からドット絵生成
- 並列生成で20-30秒で70枚を作成
- 生成後は Cloud Storage に保存し、ランタイムでは再生成しない
- 再生は `requestAnimationFrame` またはCanvasベースで実装
- 先に `action` を受信し、テキストストリームと並行して再生開始する

## 9. 技術仕様（MVP）
### 9.1 生成方式
- **技術スタック:**
  - SDXL (stabilityai/stable-diffusion-xl-base-1.0)
  - IP-Adapter: 顔特徴維持
  - Canny ControlNet: 輪郭維持
  - Pixel Art LoRA: ドット絵スタイル適用
  - OpenPose ControlNet（オプション）: ポーズ制御

- **推論環境:**
  - Cloud Run + GPU (L4)
  - メモリ: 32GB
  - タイムアウト: 15分

- **生成パラメータ:**
  - 解像度: 128x128
  - ip_adapter_scale: 0.6-0.7
  - controlnet_conditioning_scale: 0.3 (Canny)
  - num_inference_steps: 50
  - guidance_scale: 7.5-10.0

### 9.2 品質目標
- 顔の類似度: 85%（IP-Adapter + ControlNet）
- ドット絵感: スーファミ/GBA風（16-bit）
- 生成時間: 20-30秒（並列生成）

### 9.3 将来拡張（v1.1以降）
- ユーザー専用LoRAファインチューニング
- 期待類似度: 90-95%
- 訓練時間: 5-10分
- コスト: $0.05-0.10/ユーザー
