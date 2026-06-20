import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Translate, ChatTeardropText, Lock, Database, Stack, X } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { makeStore } from "@/lib/store";
import Layout from "@/components/Layout";
import SlotCard from "@/components/SlotCard";
import NameSlotModal from "@/components/NameSlotModal";
import AdSimulationModal from "@/components/AdSimulationModal";
import InsufficientSlotsModal from "@/components/InsufficientSlotsModal";
import ExportImportBar from "@/components/ExportImportBar";

const MAX_SLOTS = 10;

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("word"); // word | sentence
  const [data, setData] = useState({ slots: [], capacity: null });
  const [busy, setBusy] = useState(false);

  // Modals
  const [createIdx, setCreateIdx] = useState(null);
  const [renameSlot, setRenameSlot] = useState(null);
  const [adIdx, setAdIdx] = useState(null);
  const [insuffInfo, setInsuffInfo] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const isAuth = !!user;
  const store = useMemo(() => makeStore(isAuth), [isAuth]);

  const reload = useCallback(async () => {
    try {
      setBusy(true);
      const res = await store.list(mode);
      setData(res);
    } finally {
      setBusy(false);
    }
  }, [store, mode]);

  useEffect(() => { reload(); }, [reload]);

  const capacity = data.capacity;
  const slotsByIdx = useMemo(() => {
    const m = {};
    (data.slots || []).forEach((s) => { m[s.slot_index] = s; });
    return m;
  }, [data.slots]);

  const premiumActiveByIdx = useMemo(() => {
    const m = {};
    (capacity?.premium_active || []).forEach((p) => { m[p.slot_index] = p.expires_at; });
    return m;
  }, [capacity]);

  // Handlers
  const handleCreate = async (name) => {
    try {
      await store.create({ kind: mode, name, slot_index: createIdx });
      toast.success("슬롯이 만들어졌어요.");
      await reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || "생성 실패");
    }
  };
  const handleRename = async (newName) => {
    try {
      await store.update(mode, renameSlot.slot_id, { name: newName });
      toast.success("이름을 변경했어요.");
      await reload();
    } catch (e) { toast.error("변경 실패"); }
  };
  const handleDelete = async (slot) => {
    if (!window.confirm(`'${slot.name}' 슬롯을 삭제할까요? 내부 데이터도 함께 삭제됩니다.`)) return;
    try {
      await store.remove(mode, slot.slot_id);
      toast.success("삭제했어요.");
      await reload();
    } catch (e) { toast.error("삭제 실패"); }
  };
  const handleOpen = (slot) => {
    if (multiSelect) {
      const next = new Set(selected);
      if (next.has(slot.slot_id)) next.delete(slot.slot_id);
      else next.add(slot.slot_id);
      setSelected(next);
      return;
    }
    navigate(`/slot/${slot.slot_id}?kind=${mode}`);
  };

  const startCombinedStudy = () => {
    if (selected.size < 1) { toast.info("학습할 슬롯을 1개 이상 선택하세요."); return; }
    const ids = Array.from(selected).join(",");
    navigate(`/study?kind=${mode}&ids=${ids}`);
  };

  const clearSelection = () => { setSelected(new Set()); setMultiSelect(false); };

  // Reset selection when switching mode
  useEffect(() => { clearSelection(); }, [mode]);

  const handleExportOne = async (slot) => {
    const blob = new Blob([JSON.stringify({
      version: 1, kind: mode, exported_at: new Date().toISOString(),
      slots: [{ name: slot.name, items: slot.items || [], bookmarks: slot.bookmarks || [] }]
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cnxue_${mode}_${slot.name}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("내보내기 완료");
  };

  const handleUnlockStart = (idx) => setAdIdx(idx);
  const handleUnlockComplete = async () => {
    try {
      await store.unlock(adIdx);
      toast.success(`슬롯 ${adIdx}이(가) 60일간 해제되었어요!`);
      await reload();
    } catch (e) { toast.error("해제 실패"); }
  };

  const handleImportResult = ({ info, slots }) => {
    setInsuffInfo(info);
    setPendingImport(slots);
  };
  const handleForceImport = async () => {
    try {
      const res = await store.importData({ kind: mode, slots: pendingImport, force: true });
      toast.success(`${res.imported}개 슬롯을 불러왔어요 (${res.skipped}개 건너뜀).`);
      setInsuffInfo(null); setPendingImport(null);
      await reload();
    } catch (e) { toast.error("불러오기 실패"); }
  };
  const handleWatchAdFromImport = () => {
    // find first locked premium idx
    const used = new Set((data.slots || []).map((s) => s.slot_index));
    const activeIdx = new Set((capacity?.premium_active || []).map((p) => p.slot_index));
    let target = null;
    for (let i = 4; i <= MAX_SLOTS; i++) {
      if (!activeIdx.has(i) && !used.has(i)) { target = i; break; }
    }
    setInsuffInfo(null);
    if (target) setAdIdx(target);
    else toast.info("모든 슬롯이 이미 해제되어 있어요.");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">불러오는 중...</div>;
  }

  const slotsGridNode = (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Database weight="duotone" size={28} className={mode === "word" ? "text-blue-600" : "text-purple-600"} />
            {mode === "word" ? "단어 슬롯" : "문장 슬롯"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            슬롯 1~3은 무료, 4~10은 광고 시청으로 60일간 해제할 수 있어요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {!multiSelect ? (
            <button
              data-testid="multi-select-toggle"
              onClick={() => setMultiSelect(true)}
              className="btn-push px-3 py-2 text-xs flex items-center gap-1.5 hover:bg-slate-50"
            >
              <Stack size={14} weight="bold" /> 합쳐서 학습
            </button>
          ) : (
            <>
              <span className="text-xs font-bold text-slate-600">{selected.size}개 선택됨</span>
              <button
                data-testid="combined-study-start"
                onClick={startCombinedStudy}
                disabled={selected.size === 0}
                className={`btn-push px-3 py-2 text-xs flex items-center gap-1.5 ${mode === "word" ? "btn-push-primary" : "btn-push-sentence"}`}
              >
                <Stack size={14} weight="bold" /> 학습 시작 ({selected.size})
              </button>
              <button
                data-testid="multi-select-cancel"
                onClick={clearSelection}
                className="btn-push px-2.5 py-2 text-xs hover:bg-slate-50"
                title="취소"
              ><X size={14} weight="bold" /></button>
            </>
          )}
          <ExportImportBar
            mode={mode}
            store={store}
            onImportResult={handleImportResult}
            onAfterImport={reload}
            toast={toast}
          />
        </div>
      </div>

      {busy ? (
        <div className="text-center py-12 text-slate-400">불러오는 중...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: MAX_SLOTS }, (_, i) => i + 1).map((idx) => {
            const isPremium = idx > 3;
            const isLocked = isPremium && !premiumActiveByIdx[idx];
            const slot = slotsByIdx[idx];
            const isSelected = slot && selected.has(slot.slot_id);
            return (
              <div key={idx} className={`relative ${isSelected ? "ring-4 ring-blue-400 rounded-2xl" : ""}`}>
                {multiSelect && slot && (
                  <div
                    data-testid={`slot-checkbox-${idx}`}
                    className={`absolute -top-2 -left-2 z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center font-bold text-xs ${
                      isSelected ? "bg-blue-600 text-white border-blue-700" : "bg-white text-slate-400 border-slate-300"
                    }`}
                  >
                    {isSelected ? "✓" : ""}
                  </div>
                )}
                <SlotCard
                  index={idx}
                  mode={mode}
                  slot={slot}
                  premiumExpiresAt={premiumActiveByIdx[idx]}
                  isLocked={isLocked}
                  onCreate={(i) => setCreateIdx(i)}
                  onOpen={handleOpen}
                  onRename={(s) => setRenameSlot(s)}
                  onDelete={handleDelete}
                  onExport={handleExportOne}
                  onUnlock={handleUnlockStart}
                />
              </div>
            );
          })}
        </div>
      )}

      {!isAuth && (
        <div className="mt-6 card-push p-4 flex items-center gap-3 bg-amber-50 border-amber-200">
          <Lock size={20} className="text-amber-600 shrink-0" />
          <div className="text-sm text-slate-700">
            <b>비로그인 모드</b>입니다. 데이터는 이 브라우저에만 저장됩니다.{" "}
            <button onClick={() => navigate("/login")} className="text-blue-600 underline font-semibold">
              로그인하기
            </button>
          </div>
        </div>
      )}
    </section>
  );

  return (
    <Layout mode={mode}>
      <Toaster richColors position="top-right" />

      {/* Hero stats */}
      <section className="mb-6 sm:mb-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label={mode === "word" ? "단어 슬롯" : "문장 슬롯"}
          value={`${(data.slots || []).length}`}
          sub={`/ 보유 ${capacity?.total_capacity || 3}개`}
          accent={mode === "word" ? "text-blue-600" : "text-purple-600"}
        />
        <StatCard label="무료 슬롯" value="3" sub="기본 제공" accent="text-slate-700" />
        <StatCard
          label="프리미엄 활성"
          value={`${capacity?.premium_active?.length || 0}`}
          sub="광고 시청 60일"
          accent="text-amber-600"
        />
        <StatCard
          label="총 항목"
          value={(data.slots || []).reduce((a, s) => a + (s.items?.length || 0), 0)}
          sub={mode === "word" ? "단어" : "문장"}
          accent="text-emerald-600"
        />
      </section>

      {/* Mode tabs */}
      <Tabs value={mode} onValueChange={setMode} className="mb-6">
        <TabsList className="bg-slate-100 p-1.5 rounded-2xl h-auto" data-testid="mode-tabs">
          <TabsTrigger
            value="word"
            data-testid="tab-word"
            className="rounded-xl px-5 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-heading font-bold transition-all"
          >
            <Translate size={18} weight="duotone" className="mr-2" /> 단어 학습
          </TabsTrigger>
          <TabsTrigger
            value="sentence"
            data-testid="tab-sentence"
            className="rounded-xl px-5 py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white font-heading font-bold transition-all"
          >
            <ChatTeardropText size={18} weight="duotone" className="mr-2" /> 문장 학습
          </TabsTrigger>
        </TabsList>

        <TabsContent value="word" forceMount className={mode === "word" ? "block mt-6" : "hidden"}>
          {slotsGridNode}
        </TabsContent>
        <TabsContent value="sentence" forceMount className={mode === "sentence" ? "block mt-6" : "hidden"}>
          {slotsGridNode}
        </TabsContent>
      </Tabs>

      <NameSlotModal
        open={createIdx !== null}
        onClose={() => setCreateIdx(null)}
        title={`슬롯 ${createIdx} 만들기`}
        onSubmit={handleCreate}
      />
      <NameSlotModal
        open={!!renameSlot}
        onClose={() => setRenameSlot(null)}
        title="슬롯 이름 변경"
        defaultName={renameSlot?.name || ""}
        onSubmit={handleRename}
      />
      <AdSimulationModal
        open={adIdx !== null}
        slotIndex={adIdx}
        onClose={() => setAdIdx(null)}
        onComplete={handleUnlockComplete}
      />
      <InsufficientSlotsModal
        open={!!insuffInfo}
        info={insuffInfo}
        onClose={() => { setInsuffInfo(null); setPendingImport(null); }}
        onForceImport={handleForceImport}
        onWatchAd={handleWatchAdFromImport}
      />
    </Layout>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card-push p-4">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{label}</div>
      <div className={`font-heading text-3xl font-black ${accent} mt-1 tabular-nums`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}
