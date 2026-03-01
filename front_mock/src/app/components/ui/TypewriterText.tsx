import { useState, useEffect } from "react";

interface TypewriterTextProps {
  text: string;
  speed?: number; // ms per character
  delay?: number; // initial delay before starting
  className?: string;
  onComplete?: () => void;
}

export function TypewriterText({
  text,
  speed = 60,
  delay = 0,
  className = "",
  onComplete,
}: TypewriterTextProps) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setDisplayedLength(0);
    setStarted(false);
    const delayTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(delayTimer);
  }, [text, delay]);

  useEffect(() => {
    if (!started) return;

    if (displayedLength < text.length) {
      const timer = setTimeout(() => {
        setDisplayedLength((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timer);
    } else {
      onComplete?.();
    }
  }, [started, displayedLength, text, speed, onComplete]);

  // Split text into segments preserving <br /> as line breaks
  const renderText = () => {
    const displayed = text.slice(0, displayedLength);
    const parts = displayed.split("\n");
    return parts.map((part, i) => (
      <span key={i}>
        {part}
        {i < parts.length - 1 && <br />}
      </span>
    ));
  };

  return (
    <span className={className}>
      {renderText()}
      {displayedLength < text.length && (
        <span className="animate-pulse">▮</span>
      )}
    </span>
  );
}
