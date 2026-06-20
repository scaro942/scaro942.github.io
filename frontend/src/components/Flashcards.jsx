import { useState, useMemo, useEffect } from "react";
import { BookmarkSimple, ArrowLeft, ArrowRight, Cards as CardsIcon, ArrowsLeftRight, SpeakerHigh, PencilLine } from "@phosphor-icons/react";
import HanziWriterCanvas from "@/components/HanziWriterCanvas";
import AIPanel from "@/components/AIPanel";

function speak(text) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  u.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export default function Flashcards({ items, bookmarks = [], onToggleBookmark, kind, accent, onlyBookmarked = false }) {
  const isWord = kind === "word";
  const [order, setOrder] = useState("cn-first"); // cn-first | kr-first
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHanzi, setShowHanzi] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const cards = useMemo(() => {
    const base = items.map((it, i) => ({ ...it, _index: i }));
    if (onlyBookmarked) return base.filter((c) => bookmarks.includes(c._index));
    return base;
  }, [items, bookmarks, onlyBookmarked]);

  useEffect(() => { setIdx(0); setFlipped(false); }, [onlyBookmarked]);

  if (!cards.length) {
    return (
      <div className="card-push p-8 text-center text-slate-500">
        {onlyBookmarked ? "북마크한 항목이 없습니다. 플래시카드에서 북마크해보세요." : "항목이 비어있어요. 입력 탭에서 추가해보세요."}
      </div>
    );
  }

  const cur = cards[idx % cards.length];
  const isBookmarked = bookmarks.includes(cur._index);
  const front = order === "cn-first" ? cur.chinese : cur.korean;
  const back = order === "cn-first" ? `${cur.pinyin}\n${cur.korean}` : `${cur.chinese}\n${cur.pinyin}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" data-testid="flashcards-toolbar">
        <button
          data-testid="fc-order-toggle"
          onClick={() => { setOrder(order === "cn-first" ? "kr-first" : "cn-first"); setFlipped(false); }}
          className="btn-push px-3 py-2 text-xs flex items-center gap-1.5 hover:bg-slate-50"
        >
          <ArrowsLeftRight size={14} weight="bold" /> {order === "cn-first" ? "중국어 먼저" : "한국어 먼저"}
        </button>
        <button onClick={() => setShowHanzi((v) => !v)} data-testid="fc-hanzi-toggle" className="btn-push px-3 py-2 text-xs flex items-center gap-1.5 hover:bg-slate-50">
          <PencilLine size={14} weight="bold" /> {showHanzi ? "획순 숨기기" : "획순 보기"}
        </button>
        <button onClick={() => setShowAI((v) => !v)} data-testid="fc-ai-toggle" className="btn-push px-3 py-2 text-xs flex items-center gap-1.5 hover:bg-slate-50">
          AI {showAI ? "닫기" : "도우미"}
        </button>
        <div className="ml-auto text-xs text-slate-500 font-semibold">
          {idx + 1} / {cards.length}
        </div>
      </div>

      <div
        onClick={() => setFlipped((v) => !v)}
        data-testid="flashcard"
        className={`card-push p-10 sm:p-14 cursor-pointer select-none text-center min-h-[260px] flex flex-col items-center justify-center transition-all relative`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggleBookmark?.(cur._index); }}
          data-testid="fc-bookmark"
          className="absolute top-4 right-4"
          aria-label="bookmark"
          style={{ position: "absolute", top: "1rem", right: "1rem" }}
        >
          <BookmarkSimple weight={isBookmarked ? "fill" : "bold"} size={26} className={isBookmarked ? "text-amber-500" : "text-slate-300 hover:text-amber-400"} />
        </button>

        {!flipped ? (
          <div>
            <div className={`${order === "cn-first" ? "font-cn" : "font-kr"} text-5xl sm:text-7xl font-black ${accent} leading-tight`} data-testid="flashcard-front">
              {front}
            </div>
            <div className="text-sm text-slate-400 mt-4 uppercase tracking-widest font-bold">탭하여 뒤집기</div>
          </div>
        ) : (
          <div className="whitespace-pre-line">
            <div className={`${order === "cn-first" ? "font-kr" : "font-cn"} text-3xl sm:text-5xl font-bold text-slate-800 leading-tight`} data-testid="flashcard-back">
              {back}
            </div>
          </div>
        )}
      </div>

      {showHanzi && cur.chinese && (
        <div className="flex flex-wrap justify-center gap-3 card-push p-4">
          {Array.from(cur.chinese).slice(0, 6).map((c, i) => (
            <HanziWriterCanvas key={`${cur._index}-${c}-${i}`} character={c} mode="animate" size={140} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <button onClick={() => { setFlipped(false); setIdx((i) => (i - 1 + cards.length) % cards.length); }} data-testid="fc-prev" className="btn-push px-4 py-2 text-xs hover:bg-slate-50 flex items-center gap-1">
          <ArrowLeft size={14} weight="bold" /> 이전
        </button>
        <button onClick={() => speak(cur.chinese)} data-testid="fc-speak" className="btn-push px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-1.5">
          <SpeakerHigh size={14} weight="bold" /> 듣기
        </button>
        <button onClick={() => { setFlipped(false); setIdx((i) => (i + 1) % cards.length); }} data-testid="fc-next" className={`btn-push px-4 py-2 text-xs flex items-center gap-1 ${isWord ? "btn-push-primary" : "btn-push-sentence"}`}>
          다음 <ArrowRight size={14} weight="bold" />
        </button>
      </div>

      {showAI && <AIPanel chinese={cur.chinese} pinyin={cur.pinyin} korean={cur.korean} kind={kind} />}
    </div>
  );
}
