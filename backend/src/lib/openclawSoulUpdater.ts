/**
 * OpenClaw SOUL更新クライアント
 */
import { HttpError } from "./http.js";
import type { Big5Result } from "./big5Calculator.js";
import { generateSoulPrompt } from "./soulPromptGenerator.js";

/**
 * OpenClawのSOULを更新
 * @param userId ユーザーID
 * @param result Big5結果
 * @param endpoint OpenClawエンドポイント
 * @param authToken 認証トークン
 */
export async function updateOpenClawSoul(
  userId: string,
  result: Big5Result,
  endpoint: string,
  authToken: string,
): Promise<void> {
  const soulPrompt = generateSoulPrompt(result);

  try {
    const response = await fetch(`${endpoint}/v1/update-soul`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-openclaw-token": authToken,
      },
      body: JSON.stringify({
        soul: soulPrompt,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { error?: string };
      throw new Error(`SOUL update failed: ${response.status} ${errorData.error || ""}`);
    }

    const resultData = (await response.json()) as { success?: boolean };
    if (!resultData.success) {
      throw new Error("SOUL update returned failure");
    }

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        event: "openclaw_soul_updated",
        user_id: userId,
        type_code: result.typeCode,
      }),
    );
  } catch (err) {
    if (err instanceof Error) {
      throw new HttpError(502, "internal_error", `OpenClaw SOUL更新に失敗しました: ${err.message}`);
    }
    throw new HttpError(502, "internal_error", "OpenClaw SOUL更新に失敗しました");
  }
}
