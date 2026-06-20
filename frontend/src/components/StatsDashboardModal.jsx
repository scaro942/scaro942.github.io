import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Fire, ChartLineUp, Trophy, Target, X } from "@phosphor-icons/react";
import { useProgressSummary } from "@/lib/useProgress";

export default function StatsDashboardModal({ open, onClose }) {
  const { data, loading } = useProgressSummary(open);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-2xl rounded-2xl border-2 max-h-[85vh] overflow-y-auto" data-testid="stats-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl flex items-center gap-2">
            <ChartLineUp weight="duotone" size={28} className="text-emerald-500" /> 학습 통계
          </DialogTitle>
          <DialogDescription className="text-slate-500">최근 학습 데이터를 한눈에 확인하세요.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : data ? (
          <div className="space-y-5 mt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat icon={Fire} color="text-orange-500" label="연속 학습" value={`${data.streak}일`} />
              <Stat icon={Target} color="text-blue-600" label="총 문제" value={data.total} />
              <Stat icon={Trophy} color="text-emerald-500" label="정답" value={data.correct} />
              <Stat icon={ChartLineUp} color="text-purple-600" label="정확도" value={`${data.accuracy}%`} />
            </div>

            {/* Daily bars */}
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">최근 14일</div>
              <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5" data-testid="stats-days">
                {fillLast14(data.days).map((d) => {
                  const acc = d.total ? d.correct / d.total : 0;
                  const intensity = Math.min(100, d.total * 8);
                  return (
                    <div key={d.date} className="flex flex-col items-center gap-1" title={`${d.date} · ${d.correct}/${d.total}`}>
                      <div className="w-full h-16 rounded-md bg-slate-100 relative overflow-hidden">
                        <div
                          className={`absolute bottom-0 left-0 right-0 ${acc >= 0.7 ? "bg-emerald-400" : acc > 0 ? "bg-amber-400" : "bg-slate-200"}`}
                          style={{ height: `${intensity}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold">{d.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top items */}
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">자주 학습한 항목</div>
              {data.items.length === 0 ? (
                <div className="text-sm text-slate-400 text-center py-4">아직 학습 기록이 없어요.</div>
              ) : (
                <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto" data-testid="stats-items">
                  {data.items.slice(0, 10).map((it) => {
                    const acc = it.total ? Math.round((it.correct / it.total) * 100) : 0;
                    return (
                      <li key={it.label} className="py-2 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-cn font-bold text-slate-900 truncate">{it.label}</div>
                          <div className="text-[10px] uppercase tracking-widest text-slate-400">{it.kind}</div>
                        </div>
                        <div className="text-xs text-slate-500"><b className={acc >= 70 ? "text-emerald-600" : "text-amber-600"}>{acc}%</b> · {it.correct}/{it.total}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon: Icon, color, label, value }) {
  return (
    <div className="card-push p-3">
      <Icon weight="duotone" size={22} className={color} />
      <div className="font-heading text-2xl font-black text-slate-900 mt-1 tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{label}</div>
    </div>
  );
}

function fillLast14(days) {
  const map = new Map(days.map((d) => [d.date, d]));
  const out = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push(map.get(key) || { date: key, total: 0, correct: 0 });
  }
  return out;
}
