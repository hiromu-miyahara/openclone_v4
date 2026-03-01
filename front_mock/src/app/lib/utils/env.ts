/**
 * 環境変数ユーティリティ
 */
export const env = {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
  VITE_USE_API_MOCK: import.meta.env.VITE_USE_API_MOCK === "true",
  VITE_GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
};

/**
 * APIがモックモードかどうか
 */
export const isApiMock = (): boolean => env.VITE_USE_API_MOCK;
