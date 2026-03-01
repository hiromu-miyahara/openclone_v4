/**
 * ベースHTTPクライアント
 * 認証ヘッダー付与、エラーハンドリング
 */
import { env } from "../utils/env";
import type { ErrorResponse } from "./types";

const API_BASE_URL = env.VITE_API_BASE_URL;

/**
 * ローカルストレージからJWTトークンを取得
 */
const getToken = (): string | null => {
  return localStorage.getItem("auth_token");
};

/**
 * JWTトークンを保存
 */
export const setToken = (token: string): void => {
  localStorage.setItem("auth_token", token);
};

/**
 * JWTトークンを削除
 */
export const removeToken = (): void => {
  localStorage.removeItem("auth_token");
};

/**
 * APIエラーを表すクラス
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public requestId: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * fetchのラッパー（認証ヘッダー付与、エラーハンドリング）
 */
async function fetchApi<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getToken();
  const url = `${API_BASE_URL}${path}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options?.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");
  const isJson = contentType?.includes("application/json");

  if (!response.ok) {
    let errorData: ErrorResponse;
    if (isJson) {
      errorData = await response.json();
    } else {
      errorData = {
        code: "internal_error",
        message: response.statusText || "APIエラーが発生しました",
        request_id: "",
      };
    }
    throw new ApiError(
      errorData.code,
      errorData.message,
      errorData.request_id,
      response.status
    );
  }

  if (isJson) {
    return response.json();
  }

  throw new ApiError(
    "internal_error",
    "予期しないレスポンス形式です",
    "",
    response.status
  );
}

/**
 * multipart/form-data用のPOST
 */
async function fetchUpload<T>(
  path: string,
  formData: FormData
): Promise<T> {
  const token = getToken();

  // トークンがない場合はエラー（Google認証が必要）
  if (!token) {
    throw new ApiError(
      "unauthorized",
      "Google認証が必要です。ログインしてください。",
      "",
      401
    );
  }

  const url = `${API_BASE_URL}${path}`;

  const headers: HeadersInit = {};
  headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData: ErrorResponse = await response.json();
    throw new ApiError(
      errorData.code,
      errorData.message,
      errorData.request_id,
      response.status
    );
  }

  return response.json();
}

// ========== Auth API ==========
export const authApi = {
  /**
   * ログイン
   */
  async login(loginToken: string) {
    return fetchApi<{
      user: { id: string; auth_provider: string; created_at: string };
      token: string;
      expires_in?: number;
      openclaw?: { status: string; instance_name: string | null };
    }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ login_token: loginToken }),
      }
    );
  },

  /**
   * ログアウト
   */
  async logout(): Promise<void> {
    return fetchApi("/api/auth/logout", { method: "POST" });
  },

  /**
   * 自分のユーザー情報
   */
  async me() {
    return fetchApi<{ user: { id: string; auth_provider: string; created_at: string } }>(
      "/api/auth/me"
    );
  },
};

export { fetchApi, fetchUpload };
