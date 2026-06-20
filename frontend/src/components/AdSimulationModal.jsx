import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlayCircle, Coin, CheckCircle } from "@phosphor-icons/react";

/**
 * Mock "watched ad" experience. 5-second countdown then unlocks the slot.
 * Replace internals with real ad SDK (AdSense rewarded etc.) later.
 */
export default function AdSimulationModal({ open, onClose, onComplete, slotIndex }) {
  const [phase, setPhase] = useState("idle"); // idle | playing | done
  const [secs, setSecs] = useState(5);

  useEffect(() => {
    if (!open) { setPhase("idle"); setSecs(5); }
  }, [open]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (secs <= 0) { setPhase("done"); return; }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, secs]);

  const handleStart = () => { setPhase("playing"); setSecs(5); };
  const handleClaim = async () => {
    await onComplete?.();
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-md rounded-2xl border-2" data-testid="ad-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl flex items-center gap-2">
            <Coin weight="duotone" className="text-amber-500" size={28} />
            슬롯 {slotIndex} 해제
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            광고를 시청하면 이 슬롯을 <strong className="text-amber-600">60일간</strong> 사용할 수 있어요.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex flex-col items-center gap-4">
          {phase === "idle" && (
            <>
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-amber-100 to-yellow-200 flex items-center justify-center">
                <PlayCircle weight="fill" size={72} className="text-amber-500" />
              </div>
              <p className="text-sm text-slate-500 text-center">
                5초 광고를 시청하고 슬롯을 잠금 해제하세요.
              </p>
              <button
                data-testid="ad-start-btn"
                onClick={handleStart}
                className="btn-push btn-push-gold w-full py-3 px-5 text-sm"
              >
                광고 시청 시작
              </button>
            </>
          )}
          {phase === "playing" && (
            <>
              <div className="w-32 h-32 rounded-2xl bg-slate-900 flex items-center justify-center relative overflow-hidden">
                <div className="text-white font-heading text-5xl font-black tabular-nums">{secs}</div>
                <div className="absolute bottom-2 left-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">광고 재생 중</div>
              </div>
              <p className="text-sm text-slate-500 text-center">곧 잠금이 해제됩니다...</p>
            </>
          )}
          {phase === "done" && (
            <>
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-emerald-100 to-green-200 flex items-center justify-center">
                <CheckCircle weight="fill" size={72} className="text-emerald-500" />
              </div>
              <p className="text-sm text-emerald-700 font-semibold text-center">
                광고 시청 완료! 60일 동안 슬롯을 사용할 수 있어요.
              </p>
              <button
                data-testid="ad-claim-btn"
                onClick={handleClaim}
                className="btn-push btn-push-primary w-full py-3 px-5 text-sm"
              >
                슬롯 잠금 해제하기
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
