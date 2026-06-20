import { Lock, Coin, CalendarBlank, Trash, Pencil, DotsThree } from "@phosphor-icons/react";
import { useMemo } from "react";

function daysUntil(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function SlotCard({
  index,
  mode,
  slot,
  premiumExpiresAt,
  isLocked,
  onCreate,
  onOpen,
  onRename,
  onDelete,
  onExport,
  onUnlock,
}) {
  const isWord = mode === "word";
  const accent = isWord ? "text-blue-600" : "text-purple-600";
  const accentBg = isWord ? "bg-blue-50" : "bg-purple-50";
  const accentBorder = isWord ? "border-blue-200" : "border-purple-200";

  const expiresDays = useMemo(() => daysUntil(slot?.expires_at || premiumExpiresAt), [slot, premiumExpiresAt]);
  const isPremium = index > 3;
  const itemCount = slot?.items?.length ?? 0;

  // Locked premium slot (no unlock)
  if (isPremium && isLocked) {
    return (
      <div className="card-push slot-card-locked p-5 relative" data-testid={`slot-card-${index}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Slot {index}</div>
          <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center">
            <Lock weight="duotone" size={20} className="text-slate-500" />
          </div>
        </div>
        <div className="font-heading text-lg font-bold text-slate-500 mb-1">잠긴 슬롯</div>
        <p className="text-xs text-slate-500 mb-4">광고 시청으로 60일간 잠금을 해제하세요.</p>
        <button
          data-testid={`slot-unlock-${index}`}
          onClick={() => onUnlock?.(index)}
          className="btn-push btn-push-gold w-full py-2.5 text-xs flex items-center justify-center gap-1.5"
        >
          <Coin size={14} weight="fill" /> 광고 시청해 해제
        </button>
      </div>
    );
  }

  // Empty unlocked slot
  if (!slot) {
    return (
      <div className={`card-push p-5 ${isPremium ? "slot-card-premium-active" : "slot-card-free"}`} data-testid={`slot-card-${index}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Slot {index}</div>
            {isPremium && (
              <span className="text-[9px] uppercase font-black tracking-widest text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Premium</span>
            )}
          </div>
          {isPremium && expiresDays !== null && (
            <div className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
              <CalendarBlank size={12} weight="bold" />
              {expiresDays}일 남음
            </div>
          )}
        </div>
        <div className="font-heading text-lg font-bold text-slate-700 mb-1">빈 슬롯</div>
        <p className="text-xs text-slate-500 mb-4">새 단어/문장 묶음을 만들어보세요.</p>
        <button
          data-testid={`slot-create-${index}`}
          onClick={() => onCreate?.(index)}
          className={`btn-push w-full py-2.5 text-xs ${isWord ? "btn-push-primary" : "btn-push-sentence"}`}
        >
          + 슬롯 만들기
        </button>
      </div>
    );
  }

  // Active slot with data
  return (
    <div
      className={`card-push p-5 cursor-pointer ${isPremium ? "slot-card-premium-active" : "slot-card-free"}`}
      data-testid={`slot-card-${index}`}
      onClick={() => onOpen?.(slot)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${accent} ${accentBg} border ${accentBorder}`}>
            Slot {index}
          </div>
          {isPremium && (
            <span className="text-[9px] uppercase font-black tracking-widest text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Premium</span>
          )}
        </div>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            data-testid={`slot-rename-${index}`}
            onClick={() => onRename?.(slot)}
            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
            title="이름 변경"
          ><Pencil size={14} weight="bold" /></button>
          <button
            data-testid={`slot-export-${index}`}
            onClick={() => onExport?.(slot)}
            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
            title="내보내기"
          ><DotsThree size={16} weight="bold" /></button>
          <button
            data-testid={`slot-delete-${index}`}
            onClick={() => onDelete?.(slot)}
            className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500"
            title="삭제"
          ><Trash size={14} weight="bold" /></button>
        </div>
      </div>

      <h3 className={`font-heading font-bold text-xl text-slate-900 mb-1 truncate`} title={slot.name}>
        {slot.name}
      </h3>
      <div className="text-sm text-slate-500 mb-4">
        {itemCount}개 항목 · {slot.bookmarks?.length || 0} 북마크
      </div>

      {isPremium && expiresDays !== null && (
        <div className={`text-[10px] font-bold ${expiresDays <= 7 ? "text-red-600 pulse-soft" : "text-amber-600"} flex items-center gap-1 mb-2`}>
          <CalendarBlank size={12} weight="bold" />
          만료까지 {expiresDays}일
        </div>
      )}

      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full ${isWord ? "bg-blue-500" : "bg-purple-500"} transition-all duration-500`}
          style={{ width: `${Math.min(100, itemCount * 5)}%` }}
        />
      </div>
    </div>
  );
}
