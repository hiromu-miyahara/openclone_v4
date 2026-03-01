import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../ui/button";
import { motion } from "motion/react";
import { TypewriterText } from "../ui/TypewriterText";

export function OnboardingComplete() {
  const navigate = useNavigate();
  const [titleDone, setTitleDone] = useState(false);
  const [subtitleDone, setSubtitleDone] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center p-6 relative overflow-hidden">
      {/* 白い出口に到達 */}
      <motion.div
        className="absolute w-full h-full bg-white"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 0.2, scale: 2 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      />

      {/* 光のオーブ - absolute中央固定 */}
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-white rounded-full flex items-center justify-center"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.8, delay: 0.3, type: "spring" }}
        style={{
          boxShadow: "0 0 60px rgba(217, 232, 255, 0.9), 0 0 120px rgba(217, 232, 255, 0.6)",
        }}
      >
        <span className="text-4xl">&#x2728;</span>
      </motion.div>

      {/* テキス�� - 下部 */}
      <div className="relative z-10 max-w-md w-full text-center space-y-6 mt-auto pb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="space-y-6"
        >
          <h2>
            <TypewriterText
              text={"あなたの分身は、\nこの世界に生まれました"}
              speed={80}
              delay={800}
              onComplete={() => setTitleDone(true)}
            />
          </h2>

          {titleDone && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-[#b8b8b8]">
                <TypewriterText
                  text={"準備ができました。\n会話を始めましょう。"}
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
                onClick={() => navigate("/chat")}
                className="w-full max-w-xs mx-auto bg-white text-black hover:bg-white/90"
              >
                会話をはじめる
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}