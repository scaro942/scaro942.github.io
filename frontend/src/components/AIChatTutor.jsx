import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChatCircleDots, PaperPlaneTilt, Sparkle, Spinner, Plus } from "@phosphor-icons/react";
import { api } from "@/lib/api";

const LS_KEY = "cnxue_chat_session";

export default function AIChatTutor({ open, onClose }) {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const sid = localStorage.getItem(LS_KEY);
    if (sid) {
      setSessionId(sid);
      loadHistory(sid);
    } else {
      setSessionId(null);
      setMessages([]);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const loadHistory = async (sid) => {
    try {
      const { data } = await api.get(`/ai/chat/${sid}`);
      setMessages(data.messages || []);
    } catch { /* noop */ }
  };

  const newSession = () => {
    localStorage.removeItem(LS_KEY);
    setSessionId(null);
    setMessages([]);
  };

  const send = async (e) => {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    const optimistic = { role: "user", content: text, created_at: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    try {
      const { data } = await api.post("/ai/chat", { message: text, session_id: sessionId });
      if (!sessionId) {
        setSessionId(data.session_id);
        localStorage.setItem(LS_KEY, data.session_id);
      }
      setMessages((m) => [...m, { role: "assistant", content: data.reply, created_at: new Date().toISOString() }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `오류: ${err?.response?.data?.detail || err.message}`, created_at: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  };

  const SUGGESTIONS = [
    "HSK3에서 자주 나오는 把 문장 패턴 알려줘",
    "'了'와 '过'의 차이를 예문으로 설명해줘",
    "중국어 발음에서 한국인이 자주 틀리는 부분은?",
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-2xl rounded-2xl border-2 max-h-[85vh] flex flex-col" data-testid="chat-tutor-modal">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <DialogTitle className="font-heading text-2xl flex items-center gap-2">
                <ChatCircleDots weight="duotone" size={28} className="text-purple-500" /> AI 채팅 튜터
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-xs">Claude Sonnet 4.5 · 대화는 자동 저장됩니다</DialogDescription>
            </div>
            <button
              data-testid="chat-new-session"
              onClick={newSession}
              className="btn-push px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-1"
              title="새 대화 시작"
            ><Plus size={12} weight="bold" /> 새 대화</button>
          </div>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3 my-3 min-h-[300px] max-h-[460px]" data-testid="chat-messages">
          {messages.length === 0 && !busy && (
            <div className="py-6 text-center text-slate-400 text-sm space-y-3">
              <Sparkle weight="duotone" size={36} className="text-purple-400 mx-auto" />
              <p>중국어 학습에 관해 무엇이든 물어보세요!</p>
              <div className="flex flex-col gap-2 max-w-md mx-auto pt-2">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => setInput(s)} className="text-xs text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`chat-msg-${m.role}-${i}`}>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl whitespace-pre-wrap text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-purple-600 text-white rounded-br-md"
                  : "bg-slate-100 text-slate-800 rounded-bl-md font-kr"
              }`}>{m.content}</div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-500 text-sm rounded-bl-md flex items-center gap-2">
                <Spinner size={14} className="animate-spin" /> 답변 작성 중...
              </div>
            </div>
          )}
        </div>

        <form onSubmit={send} className="shrink-0 flex gap-2">
          <input
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="중국어 학습 질문..."
            disabled={busy}
            className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-500 outline-none text-sm font-kr"
          />
          <button
            data-testid="chat-send"
            type="submit"
            disabled={!input.trim() || busy}
            className="btn-push btn-push-sentence px-4 py-3 text-sm flex items-center gap-1.5"
          >
            <PaperPlaneTilt size={16} weight="bold" />
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
