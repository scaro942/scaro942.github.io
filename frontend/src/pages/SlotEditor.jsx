import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { ArrowLeft, Question, Cards, BookmarkSimple, GameController, GearSix, Sparkle } from "@phosphor-icons/react";
import Layout from "@/components/Layout";
import ItemInput from "@/components/ItemInput";
import { useAuth } from "@/context/AuthContext";
import { makeStore } from "@/lib/store";

const MODES = [
  { id: "input", label: "입력", icon: GearSix, ready: true },
  { id: "quiz", label: "퀴즈", icon: Question, ready: false },
  { id: "flash", label: "플래시카드", icon: Cards, ready: false },
  { id: "bookmark", label: "북마크", icon: BookmarkSimple, ready: false },
  { id: "game", label: "미니게임", icon: GameController, ready: false },
];

export default function SlotEditor() {
  const { slot_id } = useParams();
  const [searchParams] = useSearchParams();
  const kind = searchParams.get("kind") || "word";
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [slot, setSlot] = useState(null);
  const [active, setActive] = useState("input");
  const [busy, setBusy] = useState(false);

  const isAuth = !!user;
  const store = useMemo(() => makeStore(isAuth), [isAuth]);

  const load = useCallback(async () => {
    try {
      setBusy(true);
      const { slots } = await store.list(kind);
      const found = slots.find((s) => s.slot_id === slot_id);
      setSlot(found || null);
    } finally {
      setBusy(false);
    }
  }, [store, kind, slot_id]);

  useEffect(() => { load(); }, [load]);

  const updateSlot = async (patch) => {
    const updated = await store.update(kind, slot_id, patch);
    setSlot(updated);
  };

  const isWord = kind === "word";
  const accent = isWord ? "text-blue-600" : "text-purple-600";
  const accentBg = isWord ? "bg-blue-600" : "bg-purple-600";

  if (loading || busy) {
    return (
      <Layout mode={kind}>
        <div className="text-center py-20 text-slate-400">불러오는 중...</div>
      </Layout>
    );
  }
  if (!slot) {
    return (
      <Layout mode={kind}>
        <div className="text-center py-20">
          <h2 className="font-heading text-2xl font-bold text-slate-700 mb-3">슬롯을 찾을 수 없어요</h2>
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
        <div className="flex items-baseline gap-2">
          <span className={`text-xs font-black uppercase tracking-widest ${accent}`}>Slot {slot.slot_index}</span>
          {slot.is_premium && (
            <span className="text-[9px] uppercase font-black tracking-widest text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Premium</span>
          )}
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-black text-slate-900 mt-1" data-testid="slot-title">
          {slot.name}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isWord ? "단어" : "문장"} · {slot.items?.length || 0}개 항목
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 mb-6" data-testid="mode-bar">
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = active === m.id;
          return (
            <button
              key={m.id}
              onClick={() => m.ready ? setActive(m.id) : toast.info("이 기능은 곧 추가됩니다 🛠️")}
              data-testid={`mode-${m.id}`}
              className={`btn-push px-3 py-2 text-xs flex items-center gap-1.5 ${isActive ? (isWord ? "btn-push-primary" : "btn-push-sentence") : "hover:bg-slate-50"} ${!m.ready ? "opacity-60" : ""}`}
            >
              <Icon size={14} weight="bold" /> {m.label}
              {!m.ready && <span className="ml-1 text-[9px] uppercase font-black">soon</span>}
            </button>
          );
        })}
      </nav>

      {active === "input" && (
        <ItemInput slot={slot} mode={kind} onUpdate={updateSlot} toast={toast} />
      )}

      {active !== "input" && (
        <div className="card-push p-8 text-center">
          <Sparkle weight="duotone" size={48} className={`${accent} mx-auto mb-3`} />
          <h3 className="font-heading text-xl font-bold text-slate-800 mb-1">곧 만나요!</h3>
          <p className="text-sm text-slate-500">퀴즈/플래시카드/게임은 다음 단계에서 추가됩니다.</p>
        </div>
      )}
    </Layout>
  );
}
