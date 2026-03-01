import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../ui/button";
import { motion } from "motion/react";
import { TypewriterText } from "../ui/TypewriterText";

export function OnboardingIntro() {
  const navigate = useNavigate();
  const [titleDone, setTitleDone] = useState(false);
  const [subtitleDone, setSubtitleDone] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center p-6 relative overflow-hidden">
      {/* 遠方中央の小さな光点 - absolute固定 */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white"
        style={{
          boxShadow: "0 0 30px rgba(217, 232, 255, 0.8), 0 0 60px rgba(217, 232, 255, 0.4)",
        }}
        animate={{
          opacity: [0.5, 1, 0.5],
          scale: [0.8, 1.2, 0.8],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* 下側テキストエリア */}
      <div className="mt-auto pb-12 w-full max-w-md">
        <div className="text-center space-y-6 w-full">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <h1 className="mb-4 tracking-wide">
              <TypewriterText
                text={"暗闇の先で、\nあなたの分身が目覚めます"}
                speed={80}
                delay={800}
                onComplete={() => setTitleDone(true)}
              />
            </h1>
          </motion.div>

          {titleDone && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-[#b8b8b8]">
                <TypewriterText
                  text="ここから、あなたの分身を生み出します"
                  speed={50}
                  delay={200}
                  onComplete={() => setSubtitleDone(true)}
                />
              </p>
            </motion.div>
          )}

          {subtitleDone && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Button
                onClick={() => navigate("/profile")}
                className="w-full max-w-xs mx-auto bg-white text-black hover:bg-white/90"
              >
                はじめる
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
