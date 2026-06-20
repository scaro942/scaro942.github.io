import { useEffect, useState, useMemo, useCallback } from "react";
import { CheckCircle, XCircle, ArrowsClockwise, Question, Cards as CardsIcon, PencilSimpleLine } from "@phosphor-icons/react";
import HanziWriterCanvas from "@/components/HanziWriterCanvas";
import AIPanel from "@/components/AIPanel";
import { useProgress } from "@/lib/useProgress";

const MODES = [
  { id: "choice", label: "4지선다", icon: Question },
  { id: "assemble", label: "조립", icon: CardsIcon },
  { id: "hand", label: "필기", icon: PencilSimpleLine },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeChoices(items, correctItem, field) {
  const others = items.filter((x) => x[field] && x[field] !== correctItem[field]);
  const distractors = shuffle(others).slice(0, 3).map((o) => o[field]);
  return shuffle([correctItem[field], ...distractors.length >= 3 ? distractors : [...distractors, "—", "—", "—"].slice(0, 3)]);
}

export default function QuizMode({ items, kind, accent }) {
  const isWord = kind === "word";
  const [mode, setMode] = useState("choice");
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState({ total: 0, correct: 0 });
  const [feedback, setFeedback] = useState(null); // "ok" | "ng" | null
  const [picked, setPicked] = useState(null);
  const { record } = useProgress();

  const pool = useMemo(() => shuffle(items.filter((x) => x.chinese && x.korean)), [items]);
  const current = pool[idx % pool.length];

  const choices = useMemo(
    () => current ? makeChoices(items, current, "korean") : [],
    [current, items]
  );

  const next = useCallback(() => {
    setIdx((i) => i + 1);
    setFeedback(null);
    setPicked(null);
  }, []);

  const grade = useCallback((isCorrect) => {
    setFeedback(isCorrect ? "ok" : "ng");
    setScore((s) => ({ total: s.total + 1, correct: s.correct + (isCorrect ? 1 : 0) }));
    record({ kind, label: current.chinese, correct: isCorrect, mode: "quiz" });
    setTimeout(next, 1200);
  }, [current, kind, record, next]);

  if (!pool.length) {
    return <div className="card-push p-8 text-center text-slate-500">퀴즈를 시작하려면 항목을 2개 이상 추가하세요.</div>;
  }

  const accuracy = score.total ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Mode bar */}
      <div className="flex flex-wrap gap-2" data-testid="quiz-mode-bar">
        {MODES.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              data-testid={`quiz-mode-${m.id}`}
              onClick={() => { setMode(m.id); setFeedback(null); setPicked(null); }}
              className={`btn-push px-3 py-2 text-xs flex items-center gap-1.5 ${mode === m.id ? (isWord ? "btn-push-primary" : "btn-push-sentence") : "hover:bg-slate-50"}`}
            >
              <Icon size={14} weight="bold" /> {m.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-slate-500">점수 <b className="text-slate-900 font-heading">{score.correct}/{score.total}</b></span>
          <span className="text-slate-500">정확도 <b className={`font-heading ${accuracy >= 70 ? "text-emerald-600" : "text-amber-600"}`}>{accuracy}%</b></span>
        </div>
      </div>

      {/* Question card */}
      <div className="card-push p-8" data-testid="quiz-card">
        {mode === "choice" && (
          <ChoiceQuiz current={current} choices={choices} feedback={feedback} picked={picked}
            onPick={(c) => { setPicked(c); grade(c === current.korean); }} kind={kind} accent={accent} />
        )}
        {mode === "assemble" && (
          <AssembleQuiz current={current} feedback={feedback} onSubmit={(ok) => grade(ok)} accent={accent} />
        )}
        {mode === "hand" && (
          <HandQuiz current={current} onResult={({ totalMistakes }) => grade(totalMistakes <= 2)} />
        )}
      </div>

      <div className="flex gap-2 justify-center">
        <button onClick={next} className="btn-push px-4 py-2 text-xs flex items-center gap-1.5 hover:bg-slate-50" data-testid="quiz-skip">
          <ArrowsClockwise size={14} weight="bold" /> 건너뛰기
        </button>
      </div>

      {current && <AIPanel chinese={current.chinese} pinyin={current.pinyin} korean={current.korean} kind={kind} />}
    </div>
  );
}

function ChoiceQuiz({ current, choices, feedback, picked, onPick, kind, accent }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className={`font-cn text-6xl sm:text-7xl font-black ${accent} mb-2`} data-testid="quiz-question">{current.chinese}</div>
        <div className="text-base italic text-slate-500 font-cn">{current.pinyin}</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3" data-testid="quiz-choices">
        {choices.map((c, i) => {
          const isPicked = picked === c;
          const isCorrect = feedback && c === current.korean;
          const isWrong = isPicked && feedback === "ng";
          return (
            <button
              key={i}
              data-testid={`quiz-choice-${i}`}
              onClick={() => !feedback && onPick(c)}
              disabled={!!feedback}
              className={`btn-push px-4 py-4 text-base font-kr text-left transition-all ${
                isCorrect ? "btn-push-primary" : isWrong ? "btn-push-danger" : "hover:bg-slate-50"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
      {feedback && (
        <div className={`text-center text-sm font-bold ${feedback === "ok" ? "text-emerald-600" : "text-red-600"}`}>
          {feedback === "ok" ? <><CheckCircle size={18} weight="fill" className="inline mr-1" /> 정답!</> :
            <><XCircle size={18} weight="fill" className="inline mr-1" /> 정답: {current.korean}</>}
        </div>
      )}
    </div>
  );
}

function AssembleQuiz({ current, feedback, onSubmit, accent }) {
  // For words: split into chars; for sentences: split into chars too, user reassembles
  const target = current.chinese;
  const tiles = useMemo(() => shuffle(target.split("")), [target]);
  const [picked, setPicked] = useState([]);
  const [pool, setPool] = useState(tiles);

  useEffect(() => { setPicked([]); setPool(tiles); }, [tiles]);

  const onTile = (t, i) => {
    if (feedback) return;
    setPicked([...picked, t]);
    setPool(pool.filter((_, idx) => idx !== i));
  };
  const onPicked = (i) => {
    if (feedback) return;
    const t = picked[i];
    setPool([...pool, t]);
    setPicked(picked.filter((_, idx) => idx !== i));
  };
  const submit = () => onSubmit(picked.join("") === target);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-sm text-slate-500 mb-1 font-kr">다음 한국어 뜻에 맞는 중국어를 조립하세요</div>
        <div className="text-2xl font-bold text-slate-800 font-kr">{current.korean}</div>
        <div className="text-sm italic text-slate-400 mt-1 font-cn">{current.pinyin}</div>
      </div>

      <div className="min-h-[64px] flex flex-wrap gap-2 justify-center p-3 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200" data-testid="assemble-picked">
        {picked.length === 0 && <span className="text-slate-300 text-xs self-center">여기에 글자가 모입니다</span>}
        {picked.map((t, i) => (
          <button key={i} onClick={() => onPicked(i)} className={`btn-push px-3 py-2 font-cn text-2xl ${accent}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 justify-center" data-testid="assemble-pool">
        {pool.map((t, i) => (
          <button key={i} onClick={() => onTile(t, i)} data-testid={`assemble-tile-${i}`} className="btn-push px-3 py-2 font-cn text-2xl text-slate-700 hover:bg-slate-50">
            {t}
          </button>
        ))}
      </div>

      <div className="text-center">
        <button data-testid="assemble-submit" disabled={pool.length > 0 || feedback} onClick={submit}
          className="btn-push btn-push-primary px-6 py-2.5 text-sm">제출</button>
      </div>
      {feedback && (
        <div className={`text-center text-sm font-bold ${feedback === "ok" ? "text-emerald-600" : "text-red-600"}`}>
          {feedback === "ok" ? "정답!" : `정답: ${target}`}
        </div>
      )}
    </div>
  );
}

function HandQuiz({ current, onResult }) {
  // Use first char for sentences; words can be multi-char so do first char
  const ch = current.chinese[0];
  const [doneFor, setDoneFor] = useState(null);

  if (current.chinese.length > 1) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-sm text-slate-500 mb-1 font-kr">아래 한자의 획순을 따라 써보세요 (단어 첫 글자)</div>
          <div className="text-sm italic text-slate-400 font-cn">{current.pinyin}</div>
          <div className="text-sm font-bold text-slate-700 font-kr">{current.korean}</div>
        </div>
        <div className="flex justify-center">
          <HanziWriterCanvas
            key={`${current.chinese}-${doneFor}`}
            character={ch}
            mode="quiz"
            size={260}
            onQuizComplete={(r) => { setDoneFor(current.chinese); onResult(r); }}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-sm text-slate-500 mb-1 font-kr">아래 한자의 획순을 따라 써보세요</div>
        <div className="text-sm italic text-slate-400 font-cn">{current.pinyin}</div>
        <div className="text-sm font-bold text-slate-700 font-kr">{current.korean}</div>
      </div>
      <div className="flex justify-center">
        <HanziWriterCanvas
          key={`${ch}-${doneFor}`}
          character={ch}
          mode="quiz"
          size={260}
          onQuizComplete={(r) => { setDoneFor(ch); onResult(r); }}
        />
      </div>
    </div>
  );
}
