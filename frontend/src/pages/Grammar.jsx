import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { BookOpen, MagnifyingGlass, Plus, Trash, Translate, Lightbulb } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const LEVELS = ["전체", "HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6", "기타"];

export default function GrammarPage() {
  const { user } = useAuth();
  const [defaults, setDefaults] = useState([]);
  const [custom, setCustom] = useState([]);
  const [level, setLevel] = useState("전체");
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const reload = async () => {
    try {
      const { data } = await api.get("/grammar");
      setDefaults(data.defaults || []);
      setCustom(data.custom || []);
    } catch { /* noop */ }
  };
  useEffect(() => { reload(); }, [user]);

  const merged = useMemo(() => {
    const list = [
      ...defaults.map((d) => ({ ...d, _kind: "default" })),
      ...custom.map((d) => ({ ...d, _kind: "custom" })),
    ];
    let out = list;
    if (level !== "전체") out = out.filter((x) => (x.level || "기타") === level || (level === "기타" && !x.level));
    if (q) {
      const s = q.toLowerCase();
      out = out.filter((x) =>
        (x.title || "").toLowerCase().includes(s) ||
        (x.explain || "").toLowerCase().includes(s) ||
        (x.formula || "").toLowerCase().includes(s) ||
        (x.examples || []).some((e) => e.toLowerCase().includes(s))
      );
    }
    return out;
  }, [defaults, custom, level, q]);

  const deleteCard = async (id) => {
    if (!window.confirm("이 문법 카드를 삭제할까요?")) return;
    try {
      await api.delete(`/grammar/${id}`);
      toast.success("삭제했어요.");
      reload();
    } catch { toast.error("삭제 실패"); }
  };

  return (
    <Layout mode="word">
      <Toaster richColors position="top-right" />
      <header className="mb-6">
        <h1 className="font-heading text-3xl sm:text-4xl font-black text-slate-900 flex items-center gap-2">
          <BookOpen weight="duotone" className="text-blue-600" size={36} /> 문법 치트시트
        </h1>
        <p className="text-sm text-slate-500 mt-1">HSK 핵심 문법 + 내가 추가한 노트</p>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            data-testid="grammar-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="문법, 예문, 설명 검색..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {LEVELS.map((lv) => (
            <button
              key={lv}
              data-testid={`grammar-level-${lv}`}
              onClick={() => setLevel(lv)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${level === lv ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {lv}
            </button>
          ))}
        </div>
        {user && (
          <button
            data-testid="grammar-add-btn"
            onClick={() => setShowCreate(true)}
            className="btn-push btn-push-primary px-3 py-2 text-xs flex items-center gap-1.5 ml-auto"
          >
            <Plus size={14} weight="bold" /> 카드 추가
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4" data-testid="grammar-grid">
        {merged.length === 0 ? (
          <div className="md:col-span-2 card-push p-10 text-center text-slate-400">
            검색 결과가 없어요.
          </div>
        ) : merged.map((g) => (
          <article key={g.id} className="card-push p-5" data-testid={`grammar-card-${g.id}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-heading text-xl font-bold text-slate-900 font-cn">{g.title}</h3>
                {g.level && <span className="text-[9px] uppercase font-black tracking-widest text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{g.level}</span>}
                {g._kind === "custom" && <span className="text-[9px] uppercase font-black tracking-widest text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">내 카드</span>}
              </div>
              {g._kind === "custom" && (
                <button
                  onClick={() => deleteCard(g.id)}
                  className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500"
                  title="삭제"
                ><Trash size={14} weight="bold" /></button>
              )}
            </div>
            {g.formula && (
              <div className="mb-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm font-mono text-slate-700">
                {g.formula}
              </div>
            )}
            {g.explain && (
              <p className="text-sm text-slate-600 leading-relaxed font-kr mb-3">{g.explain}</p>
            )}
            {g.examples?.length > 0 && (
              <ul className="space-y-1.5">
                {g.examples.map((ex, i) => (
                  <li key={i} className="text-sm text-slate-700 leading-relaxed pl-3 border-l-2 border-blue-200 font-cn">
                    <Lightbulb weight="duotone" size={14} className="inline text-amber-500 mr-1" />
                    {ex}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>

      <CreateGrammarModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={reload} />
    </Layout>
  );
}

function CreateGrammarModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ title: "", level: "", formula: "", explain: "", examplesText: "" });

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!form.title.trim()) { toast.error("제목을 입력하세요."); return; }
    const examples = form.examplesText.split("\n").map((s) => s.trim()).filter(Boolean);
    try {
      await api.post("/grammar", {
        title: form.title.trim(),
        level: form.level.trim(),
        formula: form.formula.trim(),
        explain: form.explain.trim(),
        examples,
      });
      toast.success("카드를 추가했어요.");
      setForm({ title: "", level: "", formula: "", explain: "", examplesText: "" });
      onCreated?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "저장 실패");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-lg rounded-2xl border-2" data-testid="grammar-create-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2"><Translate size={20} weight="duotone" className="text-blue-600" /> 문법 카드 추가</DialogTitle>
          <DialogDescription className="text-slate-500">자주 헷갈리는 문법을 정리해보세요.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-2">
          <input data-testid="grammar-title" placeholder="제목 (예: 把 처치문)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-base font-bold" />
          <div className="grid grid-cols-2 gap-2">
            <input data-testid="grammar-level" placeholder="레벨 (예: HSK3)" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}
              className="px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-sm" />
            <input data-testid="grammar-formula" placeholder="공식 (예: A + 比 + B + 형용사)" value={form.formula} onChange={(e) => setForm({ ...form, formula: e.target.value })}
              className="px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-sm font-mono" />
          </div>
          <textarea data-testid="grammar-explain" placeholder="설명" rows={3} value={form.explain} onChange={(e) => setForm({ ...form, explain: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-sm" />
          <textarea data-testid="grammar-examples" placeholder="예문 (한 줄에 하나씩)" rows={3} value={form.examplesText} onChange={(e) => setForm({ ...form, examplesText: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-sm font-cn" />
          <DialogFooter>
            <button type="button" onClick={onClose} className="btn-push px-4 py-2 text-xs hover:bg-slate-50">취소</button>
            <button data-testid="grammar-save" type="submit" className="btn-push btn-push-primary px-4 py-2 text-xs">저장</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
