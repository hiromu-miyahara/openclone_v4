import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { motion } from "motion/react";
import Mic from "lucide-react/dist/esm/icons/mic";
import Square from "lucide-react/dist/esm/icons/square";
import { TypewriterText } from "../ui/TypewriterText";
import { api } from "../../lib/api";

const VOICE_SCENES = [
  {
    emoji: "🌅",
    title: "朝の場面",
    nav: "朝、仕事が始まるところを想像してください。チームに声をかけてみてください。",
    script: "おはようございます。\n今日もよろしくお願いします。",
    tone: "ニュートラル / 丁寧",
  },
  {
    emoji: "🎉",
    title: "驚きの場面",
    nav: "会議中、予想外にいいニュースが飛び込んできました！",
    script: "えっ、本当ですか？\nそれはすごいですね！",
    tone: "驚き / 高揚",
  },
  {
    emoji: "🤔",
    title: "考え込む場面",
    nav: "難しい判断を求められています。少し考える時間をもらいましょう。",
    script: "うーん、ちょっと\n考えさせてください。",
    tone: "思案 / 低トーン",
  },
  {
    emoji: "🙏",
    title: "感謝の場面",
    nav: "誰かがあなたをサポートしてくれました。お礼を伝えましょう。",
    script: "ありがとうございます。\nとても助かりました。",
    tone: "感謝 / 温かみ",
  },
];

export function OnboardingVoice() {
  const navigate = useNavigate();
  const [currentScene, setCurrentScene] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [navReady, setNavReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const scene = VOICE_SCENES[currentScene];
  const progress = ((currentScene + 1) / VOICE_SCENES.length) * 100;
  const lightSize = 100 + (currentScene / (VOICE_SCENES.length - 1)) * 150;

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
      setError("マイクへのアクセスが拒否されました");
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
      const ext = blob.type.includes("webm") ? "webm" : "mp4";
      const file = new File([blob], `scene_${currentScene + 1}.${ext}`, { type: blob.type });
      await api.onboarding.uploadAnswerAudio(file);
      setRecorded(true);
    } catch {
      setError("音声のアップロードに失敗しました");
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

  const handleNext = () => {
    if (currentScene < VOICE_SCENES.length - 1) {
      setCurrentScene(currentScene + 1);
    } else {
      navigate("/generating");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-6 relative overflow-hidden">
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
        style={{
          boxShadow: "0 0 80px rgba(217, 232, 255, 0.7), 0 0 160px rgba(217, 232, 255, 0.4)",
        }}
        animate={{ width: lightSize, height: lightSize, opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 max-w-md w-full space-y-4 mt-auto pb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-[#b8b8b8]">{scene.tone}</span>
              <span className="text-sm text-[#b8b8b8]">{currentScene + 1}/{VOICE_SCENES.length}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="bg-[#0d0d0d] border border-white/10 rounded-lg p-4 mb-3">
            <p className="text-sm text-[#b8b8b8]">
              <TypewriterText
                key={`nav-${currentScene}`}
                text={scene.nav}
                speed={35}
                delay={200}
                onComplete={() => setNavReady(true)}
              />
            </p>
          </div>

          {navReady && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="bg-[#111] border border-white/15 rounded-xl p-6 mb-4 text-center">
                <div className="text-2xl mb-3">{scene.emoji}</div>
                <p className="text-xs text-[#b8b8b8] mb-2">{scene.title}</p>
                <p className="text-white text-lg leading-relaxed whitespace-pre-line font-medium">
                  「{scene.script}」
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-center">
                  <button
                    onClick={handleRecord}
                    disabled={uploading || recorded}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all disabled:opacity-50 ${
                      isRecording
                        ? "bg-[#ff5c5c] hover:bg-[#ff5c5c]/90 animate-pulse"
                        : recorded
                        ? "bg-green-600"
                        : "bg-white hover:bg-white/90"
                    }`}
                  >
                    {isRecording ? (
                      <Square className="w-8 h-8 text-white" />
                    ) : (
                      <Mic className={`w-8 h-8 ${recorded ? "text-white" : "text-black"}`} />
                    )}
                  </button>
                </div>

                <p className="text-center text-sm text-[#b8b8b8]">
                  {uploading
                    ? "アップロード中..."
                    : isRecording
                    ? "🎙 録音中… もう一度押して停止"
                    : recorded
                    ? "録音完了！ 次へ進んでください"
                    : "マイクボタンを押して読んでください"}
                </p>

                {error && <p className="text-center text-sm text-red-400">{error}</p>}

                <Button
                  onClick={handleNext}
                  disabled={!recorded}
                  className="w-full bg-white text-black hover:bg-white/90 disabled:opacity-50"
                >
                  {currentScene < VOICE_SCENES.length - 1 ? "次の場面へ" : "録音完了"}
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
