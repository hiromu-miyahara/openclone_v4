import { SignJWT, jwtVerify } from "jose";
import { HttpError } from "./http.js";

const alg = "HS256";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new HttpError(500, "internal_error", "JWT_SECRET が未設定です");
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(userId: string): Promise<string> {
  const key = getJwtSecret();
  return await new SignJWT({ user_id: userId })
    .setProtectedHeader({ alg })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(key);
}

export async function verifyAccessToken(token: string): Promise<string> {
  const key = getJwtSecret();
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: [alg] });
    const sub = payload.sub;
    if (!sub || typeof sub !== "string") {
      throw new HttpError(401, "unauthorized", "トークンの subject が不正です");
    }
    return sub;
  } catch {
    throw new HttpError(401, "unauthorized", "トークンの検証に失敗しました");
  }
}
