import { useState } from "react";
import { PencilSimple, Trash, Plus } from "@phosphor-icons/react";

export default function ItemInput({ slot, mode, onUpdate, toast }) {
  const isWord = mode === "word";
  const [cn, setCn] = useState("");
  const [pinyin, setPinyin] = useState("");
  const [kr, setKr] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const items = slot.items || [];

  const addItem = async () => {
    if (!cn.trim()) { toast?.error(`${isWord ? "단어" : "문장"} (한자)를 입력하세요.`); return; }
    const item = { chinese: cn.trim(), pinyin: pinyin.trim(), korean: kr.trim() };
    await onUpdate({ items: [...items, item] });
    setCn(""); setPinyin(""); setKr("");
    toast?.success("추가했어요.");
  };

  const deleteItem = async (i) => {
    const next = items.filter((_, idx) => idx !== i);
    await onUpdate({ items: next });
  };

  const addBulk = async () => {
    // each line: chinese | pinyin | korean
    const lines = bulk.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const parsed = lines.map((l) => {
      const parts = l.split(/\s*[|;,]\s*/);
      return {
        chinese: parts[0] || "",
        pinyin: parts[1] || "",
        korean: parts[2] || "",
      };
    }).filter((it) => it.chinese);
    if (!parsed.length) { toast?.error("형식: 한자 | 병음 | 한국어"); return; }
    await onUpdate({ items: [...items, ...parsed] });
    setBulk("");
    toast?.success(`${parsed.length}개 추가했어요.`);
  };

  return (
    <div className="space-y-4">
      <div className="card-push p-5">
        <h3 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">
          <PencilSimple weight="duotone" size={20} className={isWord ? "text-blue-600" : "text-purple-600"} />
          새 {isWord ? "단어" : "문장"} 추가
        </h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <input
            data-testid="item-cn-input"
            placeholder={isWord ? "你好" : "你好,我叫王芳。"}
            value={cn}
            onChange={(e) => setCn(e.target.value)}
            className="px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none font-cn text-base"
          />
          <input
            data-testid="item-pinyin-input"
            placeholder="nǐ hǎo"
            value={pinyin}
            onChange={(e) => setPinyin(e.target.value)}
            className="px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none italic"
          />
          <input
            data-testid="item-kr-input"
            placeholder="안녕하세요"
            value={kr}
            onChange={(e) => setKr(e.target.value)}
            className="px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none font-kr"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            data-testid="item-add-btn"
            onClick={addItem}
            className={`btn-push px-4 py-2 text-xs flex items-center gap-1.5 ${isWord ? "btn-push-primary" : "btn-push-sentence"}`}
          >
            <Plus size={14} weight="bold" /> 추가
          </button>
          <button
            onClick={() => setShowBulk((v) => !v)}
            className="btn-push px-4 py-2 text-xs hover:bg-slate-50"
            data-testid="item-bulk-toggle"
          >
            {showBulk ? "한 줄씩 추가 닫기" : "한 줄씩 일괄 추가"}
          </button>
        </div>
        {showBulk && (
          <div className="mt-3 space-y-2">
            <textarea
              data-testid="item-bulk-textarea"
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={4}
              placeholder={"한자 | 병음 | 한국어\n你好 | nǐ hǎo | 안녕하세요"}
              className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-sm font-mono"
            />
            <button
              data-testid="item-bulk-add-btn"
              onClick={addBulk}
              className="btn-push btn-push-primary px-4 py-2 text-xs"
            >
              일괄 추가
            </button>
          </div>
        )}
      </div>

      <div className="card-push p-5">
        <h3 className="font-heading text-lg font-bold mb-4">목록 ({items.length})</h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">아직 항목이 없어요. 위에서 추가해보세요.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((it, i) => (
              <li key={i} className="py-3 flex items-center justify-between gap-3" data-testid={`item-row-${i}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-cn text-lg font-bold text-slate-900 truncate">{it.chinese}</div>
                  <div className="text-xs text-slate-500 italic truncate">{it.pinyin}</div>
                  <div className="text-sm text-slate-700 font-kr truncate">{it.korean}</div>
                </div>
                <button
                  data-testid={`item-delete-${i}`}
                  onClick={() => deleteItem(i)}
                  className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center"
                ><Trash size={16} weight="bold" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
