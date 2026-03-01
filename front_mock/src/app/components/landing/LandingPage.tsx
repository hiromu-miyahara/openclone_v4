import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { useGoogleLogin } from "@react-oauth/google";
import { motion } from "motion/react";
import { TypewriterText } from "../ui/TypewriterText";
import { api } from "../../lib/api";
import { setToken } from "../../lib/api/client";
import { env } from "../../lib/utils/env";

const hasGoogleClientId = !!env.VITE_GOOGLE_CLIENT_ID;

function useAuth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendTokenToBackend = useCallback(async (accessToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.auth.login(accessToken);
      setToken(result.token);
      navigate("/onboarding");
    } catch {
      setError("ログインに失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  return { loading, error, setError, sendTokenToBackend };
}

/** Google OAuth Provider が有効な場合のログインボタン */
function GoogleLoginButton({ loading, onError, onToken }: {
  loading: boolean;
  onError: (msg: string) => void;
  onToken: (token: string) => void;
}) {
  const googleLogin = useGoogleLogin({
    flow: "implicit",
    onSuccess: (tokenResponse) => {
      onToken(tokenResponse.access_token);
    },
    onError: () => {
      onError("Googleログインがキャンセルされました。");
    },
  });

  return (
    <RPGLoginButton
      loading={loading}
      onClick={() => {
        onError("");
        googleLogin();
      }}
    />
  );
}

/** Google Client ID未設定時のフォールバック（テスト・開発用） */
function FallbackLoginButton({ loading, onClick }: {
  loading: boolean;
  onClick: () => void;
}) {
  return <RPGLoginButton loading={loading} onClick={onClick} />;
}

function RPGLoginButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="rpg-btn-primary w-full px-6 py-3 flex items-center justify-center gap-3 disabled:opacity-40"
    >
      <span className="rpg-cursor text-sm">▶</span>
      <span>{loading ? "ログイン中..." : "はじめる"}</span>
    </button>
  );
}

/** 星空背景パーティクル */
function StarField() {
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        x: (i * 37 + 13) % 100,
        y: (i * 23 + 7) % 100,
        size: 1 + (i % 3),
        delay: (i * 0.4) % 4,
        duration: 2 + (i % 3),
      })),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((star, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-[#e8e0d4]"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
          }}
          animate={{ opacity: [0.15, 0.7, 0.15] }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export function LandingPage() {
  const { loading, error, setError, sendTokenToBackend } = useAuth();
  const [taglineDone, setTaglineDone] = useState(false);

  return (
    <div className="min-h-screen bg-[#08081a] text-[#e8e0d4] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* 星空背景 */}
      <StarField />

      {/* 中央のぼんやりした光 */}
      <motion.div
        className="absolute left-1/2 rounded-full pointer-events-none"
        style={{
          top: "35%",
          x: "-50%",
          y: "-50%",
          background: "radial-gradient(circle, rgba(240,192,64,0.15) 0%, transparent 70%)",
        }}
        animate={{
          width: [120, 160, 120],
          height: [120, 160, 120],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* メインコンテンツ */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-sm w-full">
        {/* タイトル */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
        >
          <h1 className="text-4xl font-bold tracking-widest title-glow">
            OpenClone
          </h1>
        </motion.div>

        {/* サブタイトル — DQウィンドウスタイル */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.2 }}
          className="w-full"
        >
          <div className="dq-window px-5 py-4">
            <p className="text-[#9a9080] text-sm leading-relaxed">
              <TypewriterText
                text="あなたの分身を、この世界に。"
                speed={60}
                delay={1400}
                onComplete={() => setTaglineDone(true)}
              />
            </p>
          </div>
        </motion.div>

        {/* ログインボタン */}
        {!taglineDone && (
          <motion.p
            className="text-xs text-[#f0c040] press-start-blink"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5 }}
          >
            ─ PRESS START ─
          </motion.p>
        )}

        {taglineDone && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full space-y-4"
          >
            {hasGoogleClientId ? (
              <GoogleLoginButton
                loading={loading}
                onError={setError}
                onToken={sendTokenToBackend}
              />
            ) : (
              <FallbackLoginButton
                loading={loading}
                onClick={() => sendTokenToBackend("dev-fallback-token")}
              />
            )}

            {error && (
              <p className="text-sm text-[#ff4444] text-center">{error}</p>
            )}

            <p className="text-xs text-[#9a9080] mt-4">
              ログインすることで、あなた専用のAIクローン環境が自動的に構築されます。
            </p>
          </motion.div>
        )}
      </div>

      {/* 下部バージョン表記 */}
      <div className="absolute bottom-4 text-[10px] text-[#9a9080]/50 font-pixel-accent">
        v0.1
      </div>
    </div>
  );
}
