/**
 * Big5スコア計算ロジック（TIPI-J準拠）
 * docs/system_design_v1.md 5.5節の仕様に基づく
 */

export interface Big5Answer {
  question_id: number; // 1..10
  choice_value: number; // 1..7
}

export interface Big5ScoresRaw {
  openness: number; // 1.0..7.0
  conscientiousness: number; // 1.0..7.0
  extraversion: number; // 1.0..7.0
  agreeableness: number; // 1.0..7.0
  neuroticism: number; // 1.0..7.0
}

export interface Big5Scores {
  openness: number; // 0.0..1.0
  conscientiousness: number; // 0.0..1.0
  extraversion: number; // 0.0..1.0
  agreeableness: number; // 0.0..1.0
  neuroticism: number; // 0.0..1.0
}

export interface ToneParameters {
  formality: number; // 0.0..1.0
  energy: number; // 0.0..1.0
  directness: number; // 0.0..1.0
  warmth: number; // 0.0..1.0
}

export interface Big5Result {
  scoresRaw: Big5ScoresRaw;
  scores: Big5Scores;
  tone: ToneParameters;
  typeCode: "leader" | "supporter" | "creator" | "analyst" | "communicator" | "balanced";
}

/**
 * 逆転項目の変換
 * rev = 8 - raw
 */
function reverseScore(raw: number): number {
  return 8 - raw;
}

/**
 * Big5素点スコアの計算（1.0..7.0）
 *
 * 設計書 5.5節:
 * - E = (Q1 + rev(Q6)) / 2
 * - A = (rev(Q2) + Q7) / 2
 * - C = (Q3 + rev(Q8)) / 2
 * - N = (Q4 + rev(Q9)) / 2
 * - O = (Q5 + rev(Q10)) / 2
 */
function calculateRawScores(answers: Big5Answer[]): Big5ScoresRaw {
  // question_idをキーにしたマップを作成
  const answerMap = new Map<number, number>();
  for (const answer of answers) {
    answerMap.set(answer.question_id, answer.choice_value);
  }

  // 各質問の値を取得（存在しない場合はデフォルト値4）
  const q1 = answerMap.get(1) ?? 4;
  const q2 = answerMap.get(2) ?? 4;
  const q3 = answerMap.get(3) ?? 4;
  const q4 = answerMap.get(4) ?? 4;
  const q5 = answerMap.get(5) ?? 4;
  const q6 = answerMap.get(6) ?? 4;
  const q7 = answerMap.get(7) ?? 4;
  const q8 = answerMap.get(8) ?? 4;
  const q9 = answerMap.get(9) ?? 4;
  const q10 = answerMap.get(10) ?? 4;

  const extraversion = (q1 + reverseScore(q6)) / 2;
  const agreeableness = (reverseScore(q2) + q7) / 2;
  const conscientiousness = (q3 + reverseScore(q8)) / 2;
  const neuroticism = (q4 + reverseScore(q9)) / 2;
  const openness = (q5 + reverseScore(q10)) / 2;

  return {
    openness,
    conscientiousness,
    extraversion,
    agreeableness,
    neuroticism,
  };
}

/**
 * 正規化スコアの計算（0.0..1.0）
 * normalized = (dimension_score - 1.0) / 6.0
 */
function normalizeScores(raw: Big5ScoresRaw): Big5Scores {
  return {
    openness: (raw.openness - 1.0) / 6.0,
    conscientiousness: (raw.conscientiousness - 1.0) / 6.0,
    extraversion: (raw.extraversion - 1.0) / 6.0,
    agreeableness: (raw.agreeableness - 1.0) / 6.0,
    neuroticism: (raw.neuroticism - 1.0) / 6.0,
  };
}

/**
 * Tone Parametersの計算
 *
 * 設計書 5.5節:
 * - Formality = 0.4*C + 0.3*(1-E) + 0.3*(1-O)
 * - Energy = 0.4*E + 0.3*O + 0.2*(1-N) + 0.1*A
 * - Directness = 0.4*(1-A) + 0.3*C + 0.2*E + 0.1*(1-N)
 * - Warmth = 0.5*A + 0.2*E + 0.2*(1-N) + 0.1*O
 */
function calculateToneParameters(scores: Big5Scores): ToneParameters {
  const { openness, conscientiousness, extraversion, agreeableness, neuroticism } = scores;

  const formality = 0.4 * conscientiousness + 0.3 * (1 - extraversion) + 0.3 * (1 - openness);
  const energy = 0.4 * extraversion + 0.3 * openness + 0.2 * (1 - neuroticism) + 0.1 * agreeableness;
  const directness = 0.4 * (1 - agreeableness) + 0.3 * conscientiousness + 0.2 * extraversion + 0.1 * (1 - neuroticism);
  const warmth = 0.5 * agreeableness + 0.2 * extraversion + 0.2 * (1 - neuroticism) + 0.1 * openness;

  return {
    formality: Math.max(0, Math.min(1, formality)),
    energy: Math.max(0, Math.min(1, energy)),
    directness: Math.max(0, Math.min(1, directness)),
    warmth: Math.max(0, Math.min(1, warmth)),
  };
}

/**
 * タイプ分類
 *
 * 設計書 5.5節:
 * - Leader: E >= 0.6 and C >= 0.6
 * - Supporter: A >= 0.6 and N <= 0.4
 * - Creator: O >= 0.6 and E >= 0.5
 * - Analyst: C >= 0.6 and O >= 0.5
 * - Communicator: E >= 0.6 and A >= 0.5
 * - その他: Balanced
 */
function classifyType(scores: Big5Scores): Big5Result["typeCode"] {
  const { openness, conscientiousness, extraversion, agreeableness, neuroticism } = scores;

  if (extraversion >= 0.6 && conscientiousness >= 0.6) {
    return "leader";
  }
  if (agreeableness >= 0.6 && neuroticism <= 0.4) {
    return "supporter";
  }
  if (openness >= 0.6 && extraversion >= 0.5) {
    return "creator";
  }
  if (conscientiousness >= 0.6 && openness >= 0.5) {
    return "analyst";
  }
  if (extraversion >= 0.6 && agreeableness >= 0.5) {
    return "communicator";
  }
  return "balanced";
}

/**
 * Big5結果の集計
 */
export function calculateBig5Result(answers: Big5Answer[]): Big5Result {
  const scoresRaw = calculateRawScores(answers);
  const scores = normalizeScores(scoresRaw);
  const tone = calculateToneParameters(scores);
  const typeCode = classifyType(scores);

  return {
    scoresRaw,
    scores,
    tone,
    typeCode,
  };
}

/**
 * タイプコードから日本語ラベルへ変換
 */
export function getTypeLabel(typeCode: Big5Result["typeCode"]): string {
  const labels = {
    leader: "リーダーシップ型",
    supporter: "サポート型",
    creator: "クリエイター型",
    analyst: "アナリスト型",
    communicator: "コミュニケーター型",
    balanced: "バランス型",
  };
  return labels[typeCode];
}
