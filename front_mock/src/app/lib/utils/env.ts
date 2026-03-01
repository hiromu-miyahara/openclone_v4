/**
 * 環境変数ユーティリティ
 * デモ・ハッカソン用: 未設定時はモック（バックエンド未接続）で動作
 */
export const env = {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
  /** true = モック（フロントのみ）, false = 実API接続。未設定時は true（デモ用） */
  VITE_USE_API_MOCK: import.meta.env.VITE_USE_API_MOCK !== "false",
  VITE_GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
};

/**
 * APIがモックモードかどうか（バックエンドに接続しない）
 */
export const isApiMock = (): boolean => env.VITE_USE_API_MOCK;
