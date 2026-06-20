import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { ArrowLeft, Question, Cards as CardsIcon, GameController, Stack, Brain } from "@phosphor-icons/react";
import Layout from "@/components/Layout";
import QuizMode from "@/components/QuizMode";
import Flashcards from "@/components/Flashcards";
import GamesMode from "@/components/GamesMode";
import SRSReview from "@/components/SRSReview";
import { useAuth } from "@/context/AuthContext";
import { makeStore } from "@/lib/store";

const MODES = [
  { id: "quiz", label: "퀴즈", icon: Question },
  { id: "flash", label: "플래시카드", icon: CardsIcon },
  { id: "game", label: "미니게임", icon: GameController },
  { id: "srs", label: "복습 (SRS)", icon: Brain },
];

export default function Study() {
  const [params] = useSearchParams();
  const ids = (params.get("ids") || "").split(",").filter(Boolean);
  const kind = params.get("kind") || "word";
  const isGlobalSrs = params.get("srs") === "all";
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [slots, setSlots] = useState([]);
  const [active, setActive] = useState(isGlobalSrs ? "srs" : "quiz");
  const [busy, setBusy] = useState(false);

  const store = useMemo(() => makeStore(!!user), [user]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      if (isGlobalSrs) {
        // Load BOTH word + sentence kinds for global review
        const [w, s] = await Promise.all([store.list("word"), store.list("sentence")]);
        setSlots([...(w.slots || []), ...(s.slots || [])]);
      } else {
        const { slots: all } = await store.list(kind);
        const selected = all.filter((s) => ids.includes(s.slot_id));
        setSlots(selected);
      }
    } finally { setBusy(false); }
  }, [store, kind, ids.join(","), isGlobalSrs]);

  useEffect(() => { load(); }, [load]);

  const merged = useMemo(() => slots.flatMap((s) => (s.items || []).map((it) => ({ ...it, _kind: s.kind }))), [slots]);
  const accent = kind === "word" ? "text-blue-600" : "text-purple-600";

  if (loading || busy) {
    return <Layout mode={kind}><div className="text-center py-20 text-slate-400">불러오는 중...</div></Layout>;
  }

  if (!slots.length) {
    return (
      <Layout mode={kind}>
        <div className="text-center py-20">
          <h2 className="font-heading text-2xl font-bold text-slate-700 mb-3">선택한 슬롯을 찾을 수 없어요</h2>
          <button onClick={() => navigate("/dashboard")} className="btn-push btn-push-primary px-5 py-2.5 text-sm">대시보드로</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout mode={kind}>
      <Toaster richColors position="top-right" />
      <button
        data-testid="back-to-dashboard"
        onClick={() => navigate("/dashboard")}
        className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft size={16} /> 대시보드
      </button>

      <header className="mb-6">
        <div className={`text-xs font-black uppercase tracking-widest ${accent} flex items-center gap-1`}>
          <Stack size={14} weight="duotone" /> {isGlobalSrs ? "전체 복습" : "합쳐서 학습"}
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-black text-slate-900 mt-1">
          {isGlobalSrs ? "오늘의 복습 카드" : `${slots.length}개 슬롯 · ${merged.length}개 항목`}
        </h1>
        {isGlobalSrs && (
          <p className="text-sm text-slate-500 mt-1">단어 + 문장 슬롯의 만료된 SRS 카드를 한 곳에서 복습하세요. ({merged.length}개 후보)</p>
        )}
        {!isGlobalSrs && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {slots.map((s) => (
              <span key={s.slot_id} className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${accent} bg-blue-50 border border-blue-100 font-kr`}>
                {s.name}
              </span>
            ))}
          </div>
        )}
      </header>

      <nav className="flex flex-wrap gap-2 mb-6" data-testid="study-mode-bar">
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = active === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setActive(m.id)}
              data-testid={`study-mode-${m.id}`}
              className={`btn-push px-3 py-2 text-xs flex items-center gap-1.5 ${isActive ? (kind === "word" ? "btn-push-primary" : "btn-push-sentence") : "hover:bg-slate-50"}`}
            >
              <Icon size={14} weight="bold" /> {m.label}
            </button>
          );
        })}
      </nav>

      {active === "quiz" && <QuizMode items={merged} kind={kind} accent={accent} />}
      {active === "flash" && <Flashcards items={merged} bookmarks={[]} kind={kind} accent={accent} />}
      {active === "game" && <GamesMode items={merged} kind={kind} accent={accent} />}
      {active === "srs" && (
        isGlobalSrs
          ? <SRSReview items={merged} kind="word" accent={accent} globalMode />
          : <SRSReview items={merged} kind={kind} accent={accent} />
      )}
    </Layout>
  );
}
