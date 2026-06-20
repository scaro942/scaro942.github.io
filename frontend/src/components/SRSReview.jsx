import { useEffect, useMemo, useState } from "react";
import { Brain, CheckCircle, XCircle, Sparkle, ArrowsClockwise } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { localSrsDue, localSrsReview } from "@/lib/srs";
import { useProgress } from "@/lib/useProgress";

const QUALITY_LABELS = [
  { q: 0, label: "다시", color: "bg-red-500 text-white", desc: "전혀 모름" },
  { q: 2, label: "어려움", color: "bg-amber-500 text-white", desc: "겨우 떠올림" },
  { q: 4, label: "좋음", color: "bg-emerald-500 text-white", desc: "잘 기억함" },
  { q: 5, label: "쉬움", color: "bg-blue-600 text-white", desc: "완벽함" },
];

/**
 * SRS review queue. Shows due items (those whose due_at <= now).
 * If no SRS records exist yet, surface all items so user can seed the queue.
 */
export default function SRSReview({ items, kind, accent, globalMode = false }) {
  const { user } = useAuth();
  const [due, setDue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const { record } = useProgress();

  const loadDue = async () => {
    setLoading(true);
    try {
      if (user) {
        if (globalMode) {
          // Load due for both kinds
          const [w, s] = await Promise.all([
            api.get(`/srs/due`, { params: { kind: "word" } }),
            api.get(`/srs/due`, { params: { kind: "sentence" } }),
          ]);
          const dueLabels = {
            word: new Set((w.data.due || []).map((x) => x.label)),
            sentence: new Set((s.data.due || []).map((x) => x.label)),
          };
          let queue = items.filter((it) => {
            const k = it._kind || "word";
            return dueLabels[k]?.has(it.chinese);
          });
          if (queue.length === 0 && items.length > 0) queue = items.slice(0, 30);
          setDue(queue);
        } else {
          const { data } = await api.get(`/srs/due`, { params: { kind } });
          const dueLabels = new Set((data.due || []).map((x) => x.label));
          let queue = items.filter((it) => dueLabels.has(it.chinese));
          if (queue.length === 0 && items.length > 0) queue = items.slice(0, 20);
          setDue(queue);
        }
      } else {
        if (globalMode) {
          const dueLabels = {
            word: new Set(localSrsDue("word").map((x) => x.label)),
            sentence: new Set(localSrsDue("sentence").map((x) => x.label)),
          };
          let queue = items.filter((it) => {
            const k = it._kind || "word";
            return dueLabels[k]?.has(it.chinese);
          });
          if (queue.length === 0 && items.length > 0) queue = items.slice(0, 30);
          setDue(queue);
        } else {
          const dueAll = localSrsDue(kind);
          const dueLabels = new Set(dueAll.map((x) => x.label));
          let queue = items.filter((it) => dueLabels.has(it.chinese));
          if (queue.length === 0 && items.length > 0) queue = items.slice(0, 20);
          setDue(queue);
        }
      }
      setIdx(0); setFlipped(false);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadDue(); }, [items, kind, user, globalMode]);

  const current = due[idx];

  const rate = async (quality) => {
    if (!current || busy) return;
    setBusy(true);
    const itemKind = current._kind || kind;
    try {
      if (user) {
        await api.post("/srs/review", { kind: itemKind, label: current.chinese, quality });
      } else {
        localSrsReview({ kind: itemKind, label: current.chinese, quality });
      }
      record({ kind: itemKind, label: current.chinese, correct: quality >= 3, mode: "srs" });
    } catch { /* noop */ }
    finally {
      setBusy(false);
      setFlipped(false);
      if (idx + 1 >= due.length) {
        // session done
        setDue([]);
      } else {
        setIdx(idx + 1);
      }
    }
  };

  if (loading) return <div className="card-push p-8 text-center text-slate-400">불러오는 중...</div>;

  if (!items.length) {
    return <div className="card-push p-8 text-center text-slate-500">학습할 항목이 없어요.</div>;
  }
  if (!due.length) {
    return (
      <div className="card-push p-10 text-center space-y-3">
        <Sparkle weight="duotone" size={48} className="text-emerald-500 mx-auto" />
        <h3 className="font-heading text-2xl font-black text-slate-900">오늘 복습 완료!</h3>
        <p className="text-sm text-slate-500">모든 복습 카드를 마쳤어요. 새 항목을 추가하거나 내일 다시 만나요.</p>
        <button onClick={loadDue} className="btn-push px-4 py-2 text-xs hover:bg-slate-50 inline-flex items-center gap-1">
          <ArrowsClockwise size={14} weight="bold" /> 다시 불러오기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="srs-review">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500 flex items-center gap-1.5">
          <Brain weight="duotone" size={18} className="text-purple-500" />
          간격 반복 복습 · <b className="text-slate-900">{idx + 1} / {due.length}</b>
        </div>
        <div className="h-2 rounded-full bg-slate-100 w-32 overflow-hidden">
          <div className="h-full bg-purple-500 transition-all" style={{ width: `${((idx + 1) / due.length) * 100}%` }} />
        </div>
      </div>

      <div
        onClick={() => setFlipped((v) => !v)}
        data-testid="srs-card"
        className="card-push p-10 sm:p-14 cursor-pointer select-none text-center min-h-[240px] flex flex-col items-center justify-center"
      >
        {!flipped ? (
          <>
            <div className={`font-cn text-5xl sm:text-7xl font-black ${accent} leading-tight`}>{current.chinese}</div>
            <div className="text-xs text-slate-400 mt-3 uppercase tracking-widest font-bold">탭하여 답 보기</div>
          </>
        ) : (
          <>
            <div className="text-base italic text-slate-500 mb-2 font-cn">{current.pinyin}</div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-800 font-kr">{current.korean}</div>
          </>
        )}
      </div>

      {flipped ? (
        <div className="grid grid-cols-4 gap-2" data-testid="srs-quality">
          {QUALITY_LABELS.map((b) => (
            <button
              key={b.q}
              data-testid={`srs-rate-${b.q}`}
              disabled={busy}
              onClick={() => rate(b.q)}
              className={`btn-push py-3 ${b.color} flex flex-col items-center gap-0.5`}
            >
              <span className="font-heading font-black text-sm">{b.label}</span>
              <span className="text-[9px] uppercase tracking-widest opacity-90">{b.desc}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center text-xs text-slate-400">카드를 탭해 답을 본 뒤 평가하세요.</div>
      )}
    </div>
  );
}
