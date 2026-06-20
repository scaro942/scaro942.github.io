import { useEffect, useRef } from "react";

/**
 * HanziWriter wrapper. Renders a single character's stroke animation/quiz.
 * `mode`: "animate" (auto loop) | "quiz" (user traces) | "static" (final form only)
 */
export default function HanziWriterCanvas({
  character,
  mode = "animate",
  size = 220,
  onQuizComplete,
}) {
  const targetRef = useRef(null);
  const writerRef = useRef(null);
  const idRef = useRef(`hw-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    if (!character || !window.HanziWriter || !targetRef.current) return;
    // Clear previous
    targetRef.current.innerHTML = "";

    const writer = window.HanziWriter.create(idRef.current, character, {
      width: size,
      height: size,
      padding: 8,
      strokeAnimationSpeed: 1.2,
      delayBetweenStrokes: 180,
      strokeColor: "#0f172a",
      radicalColor: "#2563eb",
      drawingColor: "#10b981",
      outlineColor: "#cbd5e1",
      showOutline: true,
      showCharacter: mode !== "quiz",
    });
    writerRef.current = writer;

    if (mode === "animate") {
      writer.loopCharacterAnimation();
    } else if (mode === "quiz") {
      writer.quiz({
        onComplete: ({ totalMistakes }) => onQuizComplete?.({ totalMistakes }),
      });
    }
    return () => {
      try { writer.cancelQuiz?.(); } catch { /* noop */ }
    };
  }, [character, mode, size, onQuizComplete]);

  if (!character) return null;
  return (
    <div className="inline-flex flex-col items-center">
      <div
        id={idRef.current}
        ref={targetRef}
        style={{ width: size, height: size }}
        className="rounded-2xl border-2 border-slate-200 bg-white"
      />
      <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">
        {mode === "quiz" ? "획순을 따라 써보세요" : "획순 애니메이션"}
      </span>
    </div>
  );
}
