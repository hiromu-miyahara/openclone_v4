import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Progress } from "../ui/progress";
import { motion, AnimatePresence } from "motion/react";
import Mic from "lucide-react/dist/esm/icons/mic";
import Square from "lucide-react/dist/esm/icons/square";
import Upload from "lucide-react/dist/esm/icons/upload";
import { TypewriterText } from "../ui/TypewriterText";
import { GeneratingStoryPages } from "./GeneratingStoryPages";
import { Big5Questions, type Answer as Big5Answer } from "./Big5Questions";
import { Big5Result } from "./Big5Result";
import { PixelAvatar, loadPixelAssets } from "../chat/PixelAvatar";
import { api } from "../../lib/api";
import { isApiMock } from "../../lib/utils/env";
import { showError, showInfo } from "../../lib/utils/toast";
import { useLanguage } from "../../lib/i18n";
import type { TranslationKey } from "../../lib/i18n";

type Stage = "intro" | "profile" | "voice" | "big5" | "big5Result" | "generating" | "complete";

const VOICE_SCENE_KEYS: { emoji: string; titleKey: TranslationKey; navKey: TranslationKey; scriptKey: TranslationKey; toneKey: TranslationKey }[] = [
  { emoji: "🌅", titleKey: "voice.scene1.title", navKey: "voice.scene1.nav", scriptKey: "voice.scene1.script", toneKey: "voice.scene1.tone" },
  { emoji: "🎉", titleKey: "voice.scene2.title", navKey: "voice.scene2.nav", scriptKey: "voice.scene2.script", toneKey: "voice.scene2.tone" },
  { emoji: "🤔", titleKey: "voice.scene3.title", navKey: "voice.scene3.nav", scriptKey: "voice.scene3.script", toneKey: "voice.scene3.tone" },
  { emoji: "🙏", titleKey: "voice.scene4.title", navKey: "voice.scene4.nav", scriptKey: "voice.scene4.script", toneKey: "voice.scene4.tone" },
];

function getStageLabel(stage: Stage, t: (key: TranslationKey) => string): string {
  switch (stage) {
    case "intro": return "PROLOGUE";
    case "profile": return t("onboarding.stageProfile");
    case "big5": return t("onboarding.stageBig5");
    case "big5Result": return "RESULT";
    case "voice": return t("onboarding.stageVoice");
    case "generating": return "GENERATING";
    case "complete": return "COMPLETE";
  }
}

function getGlowSize(stage: Stage, sceneIndex: number): number {
  switch (stage) {
    case "intro": return 16;
    case "profile": return 60;
    case "big5": return 70;
    case "big5Result": return 80;
    case "voice": return 80 + (sceneIndex / (VOICE_SCENE_KEYS.length - 1)) * 160;
    case "generating": return 280;
    case "complete": return 340;
  }
}

/* ─── Intro ─── */
function IntroContent({ onNext }: { onNext: () => void }) {
  const { t, lang } = useLanguage();
  const [titleDone, setTitleDone] = useState(false);
  const [subtitleDone, setSubtitleDone] = useState(false);

  return (
    <div className="text-center space-y-6 w-full">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.5 }}>
        <h1 className="mb-4 tracking-wide text-[#e8e0d4]">
          <TypewriterText
            key={`intro-title-${lang}`}
            text={t("onboarding.introTitle")}
            speed={80}
            delay={800}
            onComplete={() => setTitleDone(true)}
          />
        </h1>
      </motion.div>

      {titleDone && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <p className="text-[#9a9080]">
            <TypewriterText
              key={`intro-sub-${lang}`}
              text={t("onboarding.introSubtitle")}
              speed={50}
              delay={200}
              onComplete={() => setSubtitleDone(true)}
            />
          </p>
        </motion.div>
      )}

      {subtitleDone && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <Button onClick={onNext} className="w-full max-w-xs mx-auto">
            {t("onboarding.introStart")}
          </Button>
        </motion.div>
      )}
    </div>
  );
}

/* ─── Profile ─── */
function ProfileContent({ onNext }: { onNext: (photoFile: File) => void }) {
  const { t, lang } = useLanguage();
  const [name, setName] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [titleDone, setTitleDone] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleNext = () => {
    if (isApiMock()) {
      localStorage.setItem("onboarding_name", name || t("onboarding.testUser"));
      onNext(photoFile ?? new File([], "mock.png", { type: "image/png" }));
      return;
    }
    if (name && photoPreview && photoFile) {
      localStorage.setItem("onboarding_name", name);
      localStorage.setItem("onboarding_photo", photoPreview);
      onNext(photoFile);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
      <h2 className="mb-6 text-center text-[#e8e0d4]">
        <TypewriterText key={`profile-title-${lang}`} text={t("onboarding.profileTitle")} speed={80} delay={300} onComplete={() => setTitleDone(true)} />
      </h2>

      {titleDone && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-[#f0c040]">{t("onboarding.nameLabel")}</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("onboarding.namePlaceholder")}
              className="rpg-input rounded-sm px-3 py-2"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#f0c040]">{t("onboarding.photoLabel")}</Label>
            <div className="dq-window-sm rounded-sm p-8 text-center hover:border-[#f0c040] transition-colors cursor-pointer">
              {photoPreview ? (
                <div className="space-y-4">
                  <img src={photoPreview} alt="Preview" className="w-32 h-32 object-cover rounded-sm mx-auto border-2 border-[#6a5c3e]" />
                  <label htmlFor="photo-upload" className="cursor-pointer text-sm text-[#9a9080] hover:text-[#f0c040]">
                    {t("onboarding.photoChange")}
                  </label>
                </div>
              ) : (
                <label htmlFor="photo-upload" className="cursor-pointer block">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-[#9a9080]" />
                  <p className="text-[#9a9080]">{t("onboarding.photoUpload")}</p>
                </label>
              )}
              <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </div>
            <p className="text-sm text-[#9a9080]">{t("onboarding.photoHint")}</p>
          </div>

          <Button
            onClick={handleNext}
            disabled={isApiMock() ? false : (!name || !photoPreview || !photoFile)}
            className="w-full mt-8"
          >
            {t("onboarding.next")}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ─── Voice（4シーン個別録音カラオケ方式）─── */
function VoiceContent({
  currentScene,
  onSceneComplete,
}: {
  currentScene: number;
  onSceneComplete: () => void;
}) {
  const { t, lang } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [navReady, setNavReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const sceneKeys = VOICE_SCENE_KEYS[currentScene];

  useEffect(() => {
    setIsRecording(false);
    setRecorded(false);
    setUploading(false);
    setNavReady(false);
    setError(null);
  }, [currentScene]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleStartRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start();
      setIsRecording(true);
    } catch {
      setError(t("voice.micError"));
    }
  };

  const handleStopRecording = async () => {
    const mr = mediaRecorderRef.current;
    if (!mr || !isRecording) return;

    const blob = await new Promise<Blob>((resolve) => {
      mr.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: mr.mimeType }));
        chunksRef.current = [];
      };
      mr.stop();
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setIsRecording(false);

    setUploading(true);
    try {
      if (isApiMock()) {
        setRecorded(true);
      } else {
        const ext = blob.type.includes("webm") ? "webm" : "mp4";
        const file = new File([blob], `scene_${currentScene + 1}.${ext}`, { type: blob.type });
        await api.onboarding.uploadAnswerAudio(file);
        setRecorded(true);
      }
    } catch {
      setError(t("voice.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const handleRecord = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  const progress = ((currentScene + 1) / VOICE_SCENE_KEYS.length) * 100;

  return (
    <motion.div
      key={`voice-${currentScene}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-[#9a9080]">{t(sceneKeys.toneKey)}</span>
          <span className="text-sm text-[#f0c040] font-pixel-accent" style={{ fontSize: '10px' }}>
            {currentScene + 1}/{VOICE_SCENE_KEYS.length}
          </span>
        </div>
        {/* HPバー風プログレス */}
        <div className="hp-bar">
          <div className="hp-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* ナビゲーター — DQウィンドウ */}
      <div className="dq-window-sm rounded-sm p-4 mb-3">
        <p className="text-sm text-[#9a9080]">
          <TypewriterText
            key={`nav-${currentScene}-${lang}`}
            text={t(sceneKeys.navKey)}
            speed={35}
            delay={200}
            onComplete={() => setNavReady(true)}
          />
        </p>
      </div>

      {/* セリフカード — DQウィンドウ */}
      {navReady && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="dq-window rounded-sm p-6 mb-4 text-center">
            <div className="text-2xl mb-3">{sceneKeys.emoji}</div>
            <p className="text-xs text-[#9a9080] mb-2">{t(sceneKeys.titleKey)}</p>
            <p className="text-[#e8e0d4] text-lg leading-relaxed whitespace-pre-line font-medium">
              「{t(sceneKeys.scriptKey)}」
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-center">
              <button
                onClick={handleRecord}
                disabled={uploading || recorded}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all disabled:opacity-40 border-2 ${
                  isRecording
                    ? "bg-[#ff4444] border-[#ff6666] animate-pulse"
                    : recorded
                    ? "bg-[#44cc44] border-[#66ee66]"
                    : "bg-[#0e0e24] border-[#6a5c3e] hover:border-[#f0c040]"
                }`}
              >
                {isRecording ? (
                  <Square className="w-8 h-8 text-[#e8e0d4]" />
                ) : (
                  <Mic className={`w-8 h-8 ${recorded ? "text-[#e8e0d4]" : "text-[#f0c040]"}`} />
                )}
              </button>
            </div>

            <p className="text-center text-sm text-[#9a9080]">
              {uploading
                ? t("voice.uploading")
                : isRecording
                ? t("voice.recording")
                : recorded
                ? t("voice.recorded")
                : t("voice.instruction")}
            </p>

            {error && <p className="text-center text-sm text-[#ff4444]">{error}</p>}

            <Button
              onClick={onSceneComplete}
              disabled={isApiMock() ? false : !recorded}
              className="w-full"
            >
              {currentScene < VOICE_SCENE_KEYS.length - 1 ? t("voice.nextScene") : t("voice.complete")}
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ─── Complete（アバター登場）─── */
function CompleteContent({ onStart }: { onStart: () => void }) {
  const { t, lang } = useLanguage();
  const [avatarReady, setAvatarReady] = useState(false);
  const [titleDone, setTitleDone] = useState(false);
  const [subtitleDone, setSubtitleDone] = useState(false);
  // localStorageからアセットURLを取得（この時点で保存済みのはず）
  const [pixelAssets] = useState(() => loadPixelAssets());

  useEffect(() => {
    const timer = setTimeout(() => setAvatarReady(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.3, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
        className="mb-8"
      >
        <PixelAvatar action="celebrate" assetUrls={pixelAssets} />
      </motion.div>

      {avatarReady && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-4"
        >
          <h2 className="text-[#e8e0d4]">
            <TypewriterText
              key={`complete-title-${lang}`}
              text={t("onboarding.completeTitle")}
              speed={80}
              delay={300}
              onComplete={() => setTitleDone(true)}
            />
          </h2>

          {titleDone && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              <p className="text-[#9a9080]">
                <TypewriterText
                  key={`complete-sub-${lang}`}
                  text={t("onboarding.completeSubtitle")}
                  speed={50}
                  delay={200}
                  onComplete={() => setSubtitleDone(true)}
                />
              </p>
            </motion.div>
          )}

          {subtitleDone && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              <Button onClick={onStart} className="w-full max-w-xs mx-auto mt-4">
                {t("onboarding.startChat")}
              </Button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

/* ═══ Main Flow ═══ */
export function OnboardingFlow() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [stage, setStage] = useState<Stage>("intro");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [big5Answers, setBig5Answers] = useState<Big5Answer[]>([]);
  const [onboardingSessionId, setOnboardingSessionId] = useState<string | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [backendReady, setBackendReady] = useState(false);
  const [backendStarted, setBackendStarted] = useState(false);

  const glowSize = getGlowSize(stage, sceneIndex);

  useEffect(() => {
    localStorage.removeItem("onboarding_chat_access");
  }, []);

  const pollPixelCompleted = useCallback(async (jobId: string): Promise<void> => {
    for (let i = 0; i < 120; i += 1) {
      const status = await api.onboarding.getPixelartStatus(jobId);
      if (status.status === "completed") {
        // アセットURLをlocalStorageに永続化
        if (status.asset_urls) {
          localStorage.setItem("pixel_asset_urls", JSON.stringify(status.asset_urls));
        }
        return;
      }
      if (status.status === "failed") {
        throw new Error(status.error_message ?? "Pixel animation generation failed");
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    throw new Error("Pixel animation generation timed out");
  }, []);

  const pollVoiceCloneReady = useCallback(async (jobId: string): Promise<void> => {
    for (let i = 0; i < 120; i += 1) {
      const status = await api.onboarding.getVoiceCloneStatus(jobId);
      if (status.status === "ready") return;
      if (status.status === "failed") {
        throw new Error(status.error_message ?? "Voice Clone creation failed");
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    throw new Error("Voice Clone creation timed out");
  }, []);

  useEffect(() => {
    if (stage !== "generating" || backendStarted) return;
    if (isApiMock()) {
      // モックモード: デモ用GIFアセットをlocalStorageにセット
      const gif = "/mock-avatar/memo.gif";
      const mockAssets = {
        base_fullbody_png: gif,
        motion_gif_urls: {
          walk_wander: gif,
          speaking: gif,
          thinking: gif,
          joy: gif,
          surprise: gif,
          anger: gif,
          melancholy: gif,
          fun: gif,
          study_note: gif,
          futon_sleep: gif,
          futon_out: gif,
        },
      };
      localStorage.setItem("pixel_asset_urls", JSON.stringify(mockAssets));
      setBackendStarted(true);
      setBackendReady(true);
      return;
    }
    if (!onboardingSessionId || !profilePhotoFile) return;
    setBackendStarted(true);
    setBackendReady(false);

    void (async () => {
      try {
        const [pixelJob, voiceJob] = await Promise.all([
          api.onboarding.uploadPhoto(profilePhotoFile),
          api.onboarding.startVoiceClone({ onboarding_session_id: onboardingSessionId }),
        ]);

        await Promise.all([
          pollPixelCompleted(pixelJob.job_id),
          pollVoiceCloneReady(voiceJob.job_id),
        ]);

        const completeAnswers = big5Answers.map((a) => ({
          question_id: a.question_id,
          choice_value: a.value,
        }));

        await api.onboarding.complete({
          onboarding_session_id: onboardingSessionId,
          big5_answers: completeAnswers,
        });

        setBackendReady(true);
      } catch (error: unknown) {
        showError(error as Error);
      }
    })();
  }, [stage, backendStarted, onboardingSessionId, profilePhotoFile, pollPixelCompleted, pollVoiceCloneReady, big5Answers]);

  const handleSceneComplete = useCallback(() => {
    if (sceneIndex < VOICE_SCENE_KEYS.length - 1) {
      setSceneIndex((prev) => prev + 1);
    } else {
      setStage("big5");
    }
  }, [sceneIndex]);

  const handleGeneratingComplete = useCallback(() => {
    if (!backendReady) {
      showInfo(t("onboarding.generating"));
      return;
    }
    setStage("complete");
  }, [backendReady, t]);

  const handleBig5Complete = useCallback((answers: Big5Answer[]) => {
    setBig5Answers(answers);
    setStage("big5Result");
  }, []);

  const handleBig5ResultComplete = useCallback(() => {
    setStage("generating");
  }, []);

  const handleVoiceComplete = useCallback(() => {
    setStage("big5");
  }, []);

  const handleProfileNext = useCallback(async (photoFile: File) => {
    if (isApiMock()) {
      setProfilePhotoFile(photoFile);
      setStage("voice");
      return;
    }
    try {
      const started = await api.onboarding.start();
      setOnboardingSessionId(started.onboarding_session_id);
      setProfilePhotoFile(photoFile);
      setStage("voice");
    } catch (error: unknown) {
      showError(error as Error);
    }
  }, []);

  const handleStartChat = useCallback(() => {
    localStorage.setItem("onboarding_chat_access", "granted");
    navigate("/chat");
  }, [navigate]);

  return (
    <div className="min-h-[100dvh] bg-black text-[#e8e0d4] flex flex-col items-center p-6 relative overflow-hidden">
      {/* ── ステータスバー（Quest名表示・セーフエリアで下にずらす） ── */}
      {stage !== "generating" && (
        <motion.div
          className="absolute top-0 left-0 right-0 z-20"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="dq-window-sm mx-4 mt-3 px-4 py-2.5 min-h-[2.75rem] flex items-center justify-between">
            <span className="text-[10px] font-pixel-accent text-[#f0c040] leading-normal">
              {getStageLabel(stage, t)}
            </span>
            <span className="text-xs text-[#9a9080] leading-normal">OpenClone</span>
          </div>
        </motion.div>
      )}

      {/* ── ゴールドグロー（光の演出） ── */}
      {stage !== "generating" && (
        <motion.div
          className="absolute left-1/2 rounded-full pointer-events-none"
          style={{
            top: "30%",
            x: "-50%",
            y: "-50%",
            background: "radial-gradient(circle, rgba(240,192,64,0.12) 0%, transparent 70%)",
          }}
          animate={{
            width: glowSize,
            height: glowSize,
            opacity: 0.85,
          }}
          transition={{
            duration: 1.2,
            ease: "easeInOut",
          }}
        />
      )}

      {/* 完了時のフラッシュ（背景を純黒に保つため無効化） */}

      {/* ── 生成待ち全画面ストーリーページ ── */}
      {stage === "generating" && (
        <GeneratingStoryPages
          onComplete={handleGeneratingComplete}
          onSkip={handleGeneratingComplete}
        />
      )}

      {/* ── コンテンツ（intro/profile は中央、QUEST3 声の収集以降は上揃え・ヘッダーとの間隔確保） ── */}
      <div
        className={`relative z-10 max-w-md w-full flex-1 flex flex-col pb-8 ${
          stage === "intro" || stage === "profile"
            ? "justify-center"
            : "justify-start"
        }`}
        style={
          stage !== "intro" && stage !== "profile"
            ? {
                paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)",
              }
            : undefined
        }
      >
        <AnimatePresence mode="wait">
          {stage === "intro" && (
            <motion.div key="intro" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <IntroContent onNext={() => setStage("profile")} />
            </motion.div>
          )}

          {stage === "profile" && (
            <motion.div key="profile" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <ProfileContent onNext={handleProfileNext} />
            </motion.div>
          )}

          {stage === "big5" && (
            <motion.div key="big5" exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="-mx-6">
              <Big5Questions onComplete={handleBig5Complete} />
            </motion.div>
          )}

          {stage === "big5Result" && (
            <motion.div key="big5Result" exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="-mx-6">
              <Big5Result answers={big5Answers} onComplete={handleBig5ResultComplete} />
            </motion.div>
          )}

          {stage === "voice" && (
            <motion.div key={`voice-wrapper`} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <VoiceContent currentScene={sceneIndex} onSceneComplete={handleSceneComplete} />
            </motion.div>
          )}

          {stage === "complete" && (
            <motion.div key="complete" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <CompleteContent onStart={handleStartChat} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
