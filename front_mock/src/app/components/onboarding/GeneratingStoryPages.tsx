import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TypewriterText } from "../ui/TypewriterText";

interface GeneratingStoryPagesProps {
  onComplete: () => void;
  onSkip: () => void;
}

/* ════════════════════════════════════════════
   Page 1: 接続開始 — Gate + Silhouette
   ════════════════════════════════════════════ */
function Page1Art() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Gate (portal) */}
      <motion.div
        className="relative w-20 h-28 border-2 border-[#f0c040]/80 rounded-t-full flex items-end justify-center"
        animate={{ borderColor: ["rgba(240,192,64,0.5)", "rgba(240,192,64,0.9)", "rgba(240,192,64,0.5)"] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Gate inner glow */}
        <div className="absolute inset-1 rounded-t-full bg-[#f0c040]/5" />
        {/* Silhouette */}
        <div className="relative mb-1">
          {/* Head */}
          <div className="w-4 h-4 bg-[#333] rounded-sm mx-auto" />
          {/* Body */}
          <div className="w-5 h-6 bg-[#333] rounded-sm mx-auto mt-[1px]" />
          {/* Legs */}
          <div className="flex gap-[2px] justify-center mt-[1px]">
            <div className="w-2 h-3 bg-[#333] rounded-sm" />
            <div className="w-2 h-3 bg-[#333] rounded-sm" />
          </div>
        </div>
      </motion.div>

      {/* Distant stars */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-[2px] h-[2px] bg-white/40 rounded-full"
          style={{
            left: `${10 + (i * 37) % 80}%`,
            top: `${8 + (i * 23) % 70}%`,
          }}
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.3 }}
        />
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════
   Page 2: 声紋同期 — Waveform + Particles
   ════════════════════════════════════════════ */
function Page2Art() {
  const bars = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      height: 4 + Math.sin(i * 0.6) * 12 + Math.random() * 8,
      delay: i * 0.08,
    })),
  []);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Waveform */}
      <div className="flex items-center gap-[3px] h-16">
        {bars.map((bar, i) => (
          <motion.div
            key={i}
            className="w-[3px] bg-[#f0c040]/70 rounded-full"
            animate={{
              height: [bar.height, bar.height * 0.3, bar.height * 1.2, bar.height],
              opacity: [0.5, 0.9, 0.7, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: bar.delay,
              ease: "easeInOut",
            }}
            style={{ height: bar.height }}
          />
        ))}
      </div>

      {/* Scan line */}
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 w-[2px] h-20 bg-[#f0c040]/40"
        animate={{ left: ["10%", "90%", "10%"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Particles around center */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const r = 50 + Math.random() * 20;
        return (
          <motion.div
            key={i}
            className="absolute w-[3px] h-[3px] bg-white/50 rounded-full"
            style={{
              left: `calc(50% + ${Math.cos(angle) * r}px)`,
              top: `calc(50% + ${Math.sin(angle) * r}px)`,
            }}
            animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
          />
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════
   Page 3: 人格マップ — Grid + Nodes
   ════════════════════════════════════════════ */
function Page3Art() {
  const nodes = useMemo(() => [
    { x: 30, y: 25 }, { x: 70, y: 20 }, { x: 50, y: 45 },
    { x: 20, y: 60 }, { x: 75, y: 55 }, { x: 45, y: 70 },
    { x: 60, y: 35 }, { x: 35, y: 40 },
  ], []);

  const connections = useMemo(() => [
    [0, 2], [1, 2], [2, 4], [3, 5], [2, 6], [6, 7], [0, 7], [4, 1], [3, 7], [5, 4],
  ], []);

  return (
    <div className="relative w-full h-full">
      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Grid */}
        {[...Array(6)].map((_, i) => (
          <g key={i}>
            <line x1={i * 20} y1="0" x2={i * 20} y2="100" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            <line x1="0" y1={i * 20} x2="100" y2={i * 20} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
          </g>
        ))}

        {/* Connections */}
        {connections.map(([a, b], i) => (
          <motion.line
            key={`c-${i}`}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="0.5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 + i * 0.3 }}
          />
        ))}
      </svg>

      {/* Nodes */}
      {nodes.map((node, i) => (
        <motion.div
          key={i}
          className="absolute w-[6px] h-[6px] bg-white rounded-full"
          style={{ left: `${node.x}%`, top: `${node.y}%`, transform: "translate(-50%, -50%)" }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: i * 0.4 }}
        />
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════
   Page 4: アバター顔生成 — Face outline build
   ════════════════════════════════════════════ */
function Page4Art() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* 2-head body template (faded) */}
      <div className="relative">
        {/* Head outline */}
        <motion.div
          className="w-16 h-16 border-2 border-white/60 rounded-lg mx-auto relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
        >
          {/* Left eye */}
          <motion.div
            className="absolute top-5 left-3 w-3 h-3 border border-white/70 rounded-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
          />
          {/* Right eye */}
          <motion.div
            className="absolute top-5 right-3 w-3 h-3 border border-white/70 rounded-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.6 }}
          />
          {/* Mouth */}
          <motion.div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 w-5 h-[2px] bg-white/60 rounded"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.5, delay: 2.0 }}
          />
        </motion.div>

        {/* Body (template, dimmed) */}
        <motion.div
          className="w-12 h-16 border-2 border-white/20 rounded-lg mx-auto mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          {/* Arms */}
          <div className="absolute -left-2 top-[72px] w-4 h-8 border border-white/15 rounded-lg" />
          <div className="absolute -right-2 top-[72px] w-4 h-8 border border-white/15 rounded-lg" />
        </motion.div>

        {/* Scan effect over face */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-[2px] bg-white/30"
          animate={{ top: ["0px", "64px", "0px"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Page 5: 最終リンク — Bright gate + outlined avatar
   ════════════════════════════════════════════ */
function Page5Art() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Large bright gate */}
      <motion.div
        className="relative w-28 h-40 border-2 border-[#f0c040] rounded-t-full flex items-end justify-center overflow-hidden"
        animate={{ borderColor: ["rgba(240,192,64,0.7)", "rgba(240,192,64,1)", "rgba(240,192,64,0.7)"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Inner glow */}
        <motion.div
          className="absolute inset-0 rounded-t-full bg-[#f0c040]/10"
          animate={{ opacity: [0.05, 0.15, 0.05] }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Avatar silhouette with gold edge */}
        <div className="relative mb-2">
          {/* Head */}
          <div className="w-5 h-5 bg-[#0e0e24] border border-[#f0c040]/70 rounded-sm mx-auto" />
          {/* Body */}
          <div className="w-6 h-8 bg-[#0e0e24] border border-[#f0c040]/70 rounded-sm mx-auto mt-[1px]" />
          {/* Legs */}
          <div className="flex gap-[2px] justify-center mt-[1px]">
            <div className="w-2.5 h-4 bg-[#0e0e24] border border-[#f0c040]/70 rounded-sm" />
            <div className="w-2.5 h-4 bg-[#0e0e24] border border-[#f0c040]/70 rounded-sm" />
          </div>
        </div>
      </motion.div>

      {/* Screen brightness overlay */}
      <motion.div
        className="absolute inset-0 bg-white/0 pointer-events-none"
        animate={{ backgroundColor: ["rgba(255,255,255,0)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0)"] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </div>
  );
}

/* ════════════════════════════════════════════
   Page 6: READY — Idle standing avatar + stable gate
   ════════════════════════════════════════════ */
function Page6Art() {
  const [breathFrame, setBreathFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setBreathFrame((p) => (p + 1) % 2), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Stable gate glow */}
      <div className="absolute w-32 h-32 rounded-full bg-white/5 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      <motion.div
        className="absolute w-24 h-24 rounded-full bg-white/8 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={{ opacity: [0.06, 0.12, 0.06] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Standing 2-head avatar (slightly transparent) */}
      <motion.div
        className="relative opacity-60"
        animate={{ y: breathFrame === 0 ? 0 : -1 }}
        transition={{ duration: 1, ease: "easeInOut" }}
      >
        {/* Head */}
        <div className="w-8 h-8 bg-gradient-to-b from-[#ffd4a3]/60 to-[#ffb366]/60 rounded-sm mx-auto border border-white/30">
          <div className="absolute top-2.5 left-1.5 w-[3px] h-[3px] bg-black/60 rounded-full" />
          <div className="absolute top-2.5 right-1.5 w-[3px] h-[3px] bg-black/60 rounded-full" />
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-[1px] bg-black/40" />
        </div>
        {/* Body */}
        <div className="w-7 h-10 bg-[#4a90e2]/40 rounded-sm mx-auto mt-[1px] border border-white/20" />
        {/* Legs */}
        <div className="flex gap-[2px] justify-center mt-[1px]">
          <div className="w-3 h-4 bg-[#2e5c8a]/40 rounded-sm border border-white/15" />
          <div className="w-3 h-4 bg-[#2e5c8a]/40 rounded-sm border border-white/15" />
        </div>
      </motion.div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Story Pages Data
   ════════════════════════════════════════════ */
const STORY_PAGES = [
  {
    line1: "AGENT WORLD 接続中...",
    line2: "君のクローン生成を開始した",
    Art: Page1Art,
  },
  {
    line1: "VOICE SYNC 進行中",
    line2: "声の粒をコアに編み込んでいる",
    Art: Page2Art,
  },
  {
    line1: "PERSONA MAP 構築中",
    line2: "言葉の癖と判断軸を固定している",
    Art: Page3Art,
  },
  {
    line1: "AVATAR FACE COMPILE",
    line2: "君の面影を2等身ボディへ接続",
    Art: Page4Art,
  },
  {
    line1: "FINAL LINK...",
    line2: "起動まで、あと少し",
    Art: Page5Art,
  },
  {
    line1: "READY",
    line2: "生成完了で進行ボタンが表示される",
    Art: Page6Art,
  },
];

/* ════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════ */
export function GeneratingStoryPages({ onComplete, onSkip }: GeneratingStoryPagesProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Mock progress (60 seconds to 100%)
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsComplete(true);
          return 100;
        }
        // ~60 seconds: 100 / (60000 / 300) ≈ 0.5 per tick
        return Math.min(prev + 0.5, 100);
      });
    }, 300);
    return () => clearInterval(interval);
  }, []);

  // Page rotation: 10 seconds each
  useEffect(() => {
    if (isComplete) return;
    const interval = setInterval(() => {
      setPageIndex((prev) => (prev + 1) % STORY_PAGES.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [isComplete]);

  // Allow skip after 20 seconds
  useEffect(() => {
    const timer = setTimeout(() => setCanSkip(true), 20000);
    return () => clearTimeout(timer);
  }, []);

  const currentPage = STORY_PAGES[pageIndex];

  return (
    <div className="absolute inset-0 bg-[#08081a] flex flex-col z-20">
      {/* ─── Pixel Art Scene (takes up main space) ─── */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={pageIndex}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <currentPage.Art />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ─── Bottom Panel: Text + Progress + Buttons ─── */}
      <div className="shrink-0 px-6 pb-8 pt-4 space-y-5">
        {/* Story text with DQ-style frame */}
        <div className="dq-window p-4 min-h-[80px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={pageIndex}
              className="relative z-10 space-y-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <p className="text-[#f0c040] text-sm tracking-wider font-pixel-accent">
                <TypewriterText key={`l1-${pageIndex}`} text={currentPage.line1} speed={40} delay={300} />
              </p>
              <p className="text-[#e8e0d4] text-sm">
                <TypewriterText key={`l2-${pageIndex}`} text={currentPage.line2} speed={35} delay={1200} />
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress bar — HP bar style */}
        <div className="space-y-2">
          <div className="hp-bar">
            <motion.div
              className="hp-bar-fill"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "linear" }}
            />
          </div>
          <div className="flex justify-between text-xs text-[#9a9080]">
            <span>生成中</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* CTA Buttons */}
        {isComplete ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <button
              onClick={onComplete}
              className="rpg-btn-primary w-full py-3 text-sm font-medium"
            >
              ▶ せかいにいく
            </button>
          </motion.div>
        ) : canSkip ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <button
              onClick={onSkip}
              className="rpg-btn w-full py-3 text-sm text-[#9a9080] hover:text-[#f0c040]"
            >
              先にはじめる
            </button>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
