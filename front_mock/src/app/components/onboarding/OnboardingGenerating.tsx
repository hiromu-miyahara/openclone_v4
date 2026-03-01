import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { Button } from "../ui/button";
import { TypewriterText } from "../ui/TypewriterText";

const STORY_LINES = [
  "暗闇の中で、かすかな光が揺れはじめる...",
  "あなたの声が、形を持ち始めている...",
  "記憶の断片が、ひとつの意志に集まっていく...",
  "もうすぐ、あなたの分身がこの世界に現れます...",
];

export function OnboardingGenerating() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [canSkip, setCanSkip] = useState(false);

  // Progress bar (mock: completes in ~3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => navigate("/complete"), 500);
          return 100;
        }
        return prev + 2;
      });
    }, 60);

    return () => clearInterval(interval);
  }, [navigate]);

  // Story loop while waiting
  useEffect(() => {
    const interval = setInterval(() => {
      setStoryIndex((prev) => (prev + 1) % STORY_LINES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Allow skip after 20 seconds
  useEffect(() => {
    const timer = setTimeout(() => setCanSkip(true), 20000);
    return () => clearTimeout(timer);
  }, []);

  const lightSize = 300;

  return (
    <div className="min-h-screen flex flex-col items-center p-6 relative overflow-hidden">
      {/* 光 - absolute中央固定 */}
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
        style={{
          width: lightSize,
          height: lightSize,
          boxShadow: "0 0 120px rgba(217, 232, 255, 0.8), 0 0 240px rgba(217, 232, 255, 0.5)",
        }}
        animate={{
          opacity: [0.6, 1, 0.6],
          scale: [0.95, 1.05, 0.95],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* テキスト - 下部 */}
      <div className="relative z-10 max-w-md w-full text-center space-y-6 mt-auto pb-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-white" />

          <h2 className="mb-4">
            <TypewriterText
              text={"いま、あなたの分身が\n声と姿を得ています"}
              speed={80}
              delay={300}
            />
          </h2>

          <div className="max-w-sm mx-auto">
            <div className="bg-[#0d0d0d] border border-white/10 rounded-lg p-4">
              <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white"
                  style={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-sm text-[#b8b8b8] mt-3">{progress}%</p>
            </div>
          </div>

          {/* 誕生ストーリー演出ループ */}
          <div className="mt-6 h-12">
            <motion.p
              key={storyIndex}
              className="text-sm text-[#b8b8b8]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <TypewriterText
                key={storyIndex}
                text={STORY_LINES[storyIndex]}
                speed={40}
                delay={200}
              />
            </motion.p>
          </div>

          {/* 20秒経過後のスキップ */}
          {canSkip && progress < 100 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mt-4"
            >
              <Button
                onClick={() => navigate("/complete")}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                先にはじめる
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}