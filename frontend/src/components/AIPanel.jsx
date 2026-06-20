import { useState } from "react";
import { Sparkle, Translate, Brain, Lightbulb, Spinner } from "@phosphor-icons/react";
import { api } from "@/lib/api";

const ACTIONS = [
  { id: "example", label: "예문", icon: Lightbulb, desc: "예문 3개 생성" },
  { id: "analyze", label: "분석", icon: Brain, desc: "의미·문법 분석" },
  { id: "translate", label: "번역", icon: Translate, desc: "자연 번역" },
];

export default function AIPanel({ chinese, pinyin, korean, kind = "word" }) {
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState("");
  const [active, setActive] = useState(null);

  const run = async (type) => {
    setBusy(type); setActive(type); setResult("");
    try {
      const { data } = await api.post("/ai/query", {
        type, chinese, pinyin, korean, kind,
      });
      setResult(data.result || "");
    } catch (e) {
      setResult(`오류: ${e?.response?.data?.detail || e.message}`);
    } finally {
      setBusy(null);
    }
  };

  if (!chinese) return null;

  return (
    <div className="card-push p-5" data-testid="ai-panel">
      <div className="flex items-center gap-2 mb-3">
        <Sparkle weight="fill" className="text-purple-500" size={20} />
        <h3 className="font-heading text-lg font-bold">AI 도우미 <span className="text-xs font-normal text-slate-400">Claude Sonnet 4.5</span></h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          const isBusy = busy === a.id;
          const isActive = active === a.id;
          return (
            <button
              key={a.id}
              data-testid={`ai-${a.id}`}
              onClick={() => run(a.id)}
              disabled={!!busy}
              className={`btn-push px-3 py-2 text-xs flex items-center gap-1.5 ${isActive ? "btn-push-primary" : "hover:bg-slate-50"}`}
              title={a.desc}
            >
              {isBusy ? <Spinner size={14} className="animate-spin" weight="bold" /> : <Icon size={14} weight="bold" />} {a.label}
            </button>
          );
        })}
      </div>
      {result && (
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 font-kr" data-testid="ai-result">
          {result}
        </div>
      )}
      {busy && !result && (
        <div className="mt-4 text-xs text-slate-400 flex items-center gap-2">
          <Spinner size={14} className="animate-spin" />
          AI가 답변을 작성 중이에요...
        </div>
      )}
    </div>
  );
}
