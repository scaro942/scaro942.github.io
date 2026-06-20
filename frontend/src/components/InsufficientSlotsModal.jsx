import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Warning, ArrowsLeftRight, Coin } from "@phosphor-icons/react";

/**
 * Modal shown when imported slots > available capacity.
 * User can: abort, force import (partial), or unlock more slots (closes modal, opens ad flow externally).
 */
export default function InsufficientSlotsModal({ open, info, onClose, onForceImport, onWatchAd }) {
  const [loading, setLoading] = useState(false);
  if (!info) return null;
  const { incoming_count, available, missing, total_capacity } = info;

  const doForce = async () => {
    setLoading(true);
    await onForceImport?.();
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-md rounded-2xl border-2" data-testid="insufficient-slots-modal">
        <DialogHeader>
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mb-2">
            <Warning weight="duotone" size={32} className="text-amber-600" />
          </div>
          <DialogTitle className="font-heading text-2xl">슬롯이 부족합니다</DialogTitle>
          <DialogDescription className="text-slate-600">
            불러오려는 슬롯의 개수가 보유 슬롯보다 많아요. 슬롯 불러오기를 중단했습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="my-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="불러오기" value={incoming_count} color="text-slate-900" />
          <Stat label="현재 빈 슬롯" value={available} color="text-blue-600" />
          <Stat label="부족" value={missing} color="text-red-600" />
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 leading-relaxed">
          총 슬롯 용량: <b>{total_capacity}</b>개 · 부족한 <b className="text-red-600">{missing}</b>개를 광고 시청으로 해제하거나, 가능한 만큼만 불러올 수 있어요.
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-3">
          <button
            data-testid="insuff-cancel"
            onClick={onClose}
            className="btn-push px-4 py-2.5 text-xs hover:bg-slate-50 flex-1"
          >
            취소
          </button>
          <button
            data-testid="insuff-watch-ad"
            onClick={onWatchAd}
            className="btn-push btn-push-gold px-4 py-2.5 text-xs flex-1 flex items-center justify-center gap-1.5"
          >
            <Coin size={14} weight="fill" /> 광고로 슬롯 확보
          </button>
          <button
            data-testid="insuff-force-import"
            disabled={available === 0 || loading}
            onClick={doForce}
            className="btn-push btn-push-primary px-4 py-2.5 text-xs flex-1 flex items-center justify-center gap-1.5"
          >
            <ArrowsLeftRight size={14} weight="bold" /> {available}개만 불러오기
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const Stat = ({ label, value, color }) => (
  <div className="card-push py-3">
    <div className={`font-heading text-3xl font-black ${color} tabular-nums`}>{value}</div>
    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-0.5">{label}</div>
  </div>
);
