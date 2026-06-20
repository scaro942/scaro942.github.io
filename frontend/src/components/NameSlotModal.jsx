import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export default function NameSlotModal({ open, onClose, defaultName = "", onSubmit, title = "슬롯 이름" }) {
  const [name, setName] = useState(defaultName);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!name.trim()) return;
    await onSubmit?.(name.trim());
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); else setName(defaultName); }}>
      <DialogContent className="max-w-sm rounded-2xl border-2" data-testid="name-slot-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{title}</DialogTitle>
          <DialogDescription className="text-slate-500">슬롯에 사용할 이름을 입력해주세요.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <input
            autoFocus
            data-testid="slot-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: HSK 4급 1과"
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-base font-semibold font-kr"
          />
          <DialogFooter className="gap-2">
            <button type="button" onClick={onClose} className="btn-push px-4 py-2 text-xs hover:bg-slate-50">취소</button>
            <button data-testid="slot-name-submit" type="submit" className="btn-push btn-push-primary px-4 py-2 text-xs">저장</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
