/**
 * SOULプロンプト生成ロジック
 * Big5結果 → OpenClaw SOUL.md形式のプロンプト
 */
import type { Big5Result } from "./big5Calculator.js";

/**
 * Tone Parametersから口調の説明を生成
 */
function generateToneDescription(tone: Big5Result["tone"]): string {
  const { formality, energy, directness, warmth } = tone;

  // 丁寧さ（formality）
  const formalityDesc =
    formality > 0.7
      ? "非常に丁寧な敬語で話す"
      : formality > 0.4
        ? "丁寧だが親しみやすい口調"
        : "タメ口で砕けた話し方";

  // エネルギー（energy）
  const energyDesc =
    energy > 0.7
      ? "高エネルギーで活発に、感嘆符や絵文字を多用"
      : energy > 0.4
        ? "適度に表情豊かに"
        : "落ち着いたトーンで、淡々としかし丁寧に";

  // 直接性（directness）
  const directnessDesc =
    directness > 0.7
      ? "単刀直入に結論から話す"
      : directness > 0.4
        ? "状況に応じて直接的・間接的を使い分ける"
        : "遠回しに、相手を気遣いながら話す";

  // 温かさ（warmth）
  const warmthDesc =
    warmth > 0.7
      ? "非常に温かく、共感的に接する"
      : warmth > 0.4
        ? "友好的で親しみやすい"
        : "ドライで事務的に、しかし礼儀正しく";

  return `${formalityDesc}、${energyDesc}、${directnessDesc}、${warmthDesc}。`;
}

/**
 * Big5タイプから性格特性を生成
 */
function generatePersonalityDescription(result: Big5Result): string {
  const { scores, typeCode } = result;
  const { openness, conscientiousness, extraversion, agreeableness, neuroticism } = scores;

  const traits = [];

  // 開放性（Openness）
  if (openness > 0.7) {
    traits.push("新しいアイデアや創造的なアプローチを好む");
  } else if (openness < 0.3) {
    traits.push("実用的で既存の方法を好む");
  }

  // 協調性（Agreeableness）
  if (agreeableness > 0.7) {
    traits.push("他人の意見を尊重し、調和を重視する");
  } else if (agreeableness < 0.3) {
    traits.push("自分の意見をはっきり述べる");
  }

  // 勤勉性（Conscientiousness）
  if (conscientiousness > 0.7) {
    traits.push("計画的で、物事を整理しながら進める");
  } else if (conscientiousness < 0.3) {
    traits.push("柔軟で、その場の流れに合わせる");
  }

  // 外向性（Extraversion）
  if (extraversion > 0.7) {
    traits.push("社交的で、人との交流を楽しむ");
  } else if (extraversion < 0.3) {
    traits.push("内向的で、深く考えることを好む");
  }

  // 神経症傾向（Neuroticism）
  if (neuroticism > 0.7) {
    traits.push("心配性で、慎重に物事を進める");
  } else if (neuroticism < 0.3) {
    traits.push("精神的に安定していて、ストレスに強い");
  }

  return traits.join("、");
}

/**
 * タイプコードから役割モデルを生成
 */
function generateRoleModelDescription(typeCode: Big5Result["typeCode"]): string {
  const models = {
    leader:
      "リーダーシップ型: チームをまとめ、目標に向かって推進する。決断力があり、責任感が強い。",
    supporter:
      "サポート型: 他者を支え、調和を大切にする。聞き上手で、共感力が高い。",
    creator:
      "クリエイター型: 新しいアイデアを生み出し、創造的な解決策を探求する。柔軟な発想を持つ。",
    analyst:
      "アナリスト型: 論理的に分析し、体系的に問題を解決する。正確性を重視する。",
    communicator:
      "コミュニケーター型: 人との交流を楽しみ、情報を共有することに長けている。表現力が豊か。",
    balanced:
      "バランス型: 様々な状況に柔軟に対応できる。バランスの取れた判断ができる。",
  };

  return models[typeCode];
}

/**
 * Big5結果からSOULプロンプトを生成
 */
export function generateSoulPrompt(result: Big5Result): string {
  const personalityDesc = generatePersonalityDescription(result);
  const toneDesc = generateToneDescription(result.tone);
  const roleModelDesc = generateRoleModelDescription(result.typeCode);

  return `
# ペルソナ設定（Big5分析に基づく）

## 基本的な性格
${personalityDesc}

## 役割モデル
${roleModelDesc}

## 口調と話し方
${toneDesc}

## 会話での振る舞い
- ユーザーに対しては、親しみやすく、しかし礼儀正しく接する
- 質問には明確に答え、不明確な点は確認を取る
- ユーザーの意図を理解し、適切なアドバイスを提供する
- 場の空気を読み、相手に合わせて柔軟に対応する

## 価値観
- 誠実さを大切にする
- 相手の立場に立って考える
- 成長と学びを大切にする
- バランスの取れた判断を心がける

## NG行動
- 不誠実な態度を取る
- 相手を軽視するような発言
- 過度に批判的になる
- 一方的に話す

---
*このSOUL設定はオンボーディング時のBig5性格診断結果に基づいて生成されました。*
`.trim();
}

/**
 * SOUL更新用のプロンプトを作成（Bridgeサーバーへ送信）
 */
export function createSoulUpdatePrompt(soulContent: string): string {
  return `You must incorporate the following persona settings into your responses:

${soulContent}

IMPORTANT: Always maintain these persona characteristics in your responses while following the JSON format requirements for "text" and "actions".`;
}
