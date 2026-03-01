import { HttpError } from "./http.js";

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

/**
 * Google OAuth access_token を使ってユーザー情報を取得・検証する。
 * フロントエンドの @react-oauth/google (implicit flow) が返す access_token を受け取り、
 * Google の userinfo エンドポイントでユーザー情報を取得する。
 */
export async function verifyGoogleAccessToken(accessToken: string): Promise<GoogleUserInfo> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new HttpError(401, "unauthorized", `Google userinfo 取得失敗: ${res.status} ${text.slice(0, 100)}`);
    }

    const data = (await res.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
      email_verified?: boolean;
    };

    if (!data.sub || !data.email) {
      throw new HttpError(401, "unauthorized", "Google userinfo のペイロードが不正です");
    }

    return {
      sub: data.sub,
      email: data.email,
      name: data.name ?? null,
      picture: data.picture ?? null,
    };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(401, "unauthorized", "Google アクセストークンの検証に失敗しました");
  }
}
