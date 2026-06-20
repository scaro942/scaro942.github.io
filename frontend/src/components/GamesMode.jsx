import { useEffect, useMemo, useState } from "react";
import { GameController, SpeakerHigh, CheckCircle, XCircle, ArrowsClockwise } from "@phosphor-icons/react";
import { useProgress } from "@/lib/useProgress";

const WORD_GAMES = [
  { id: "match", label: "단어연결" },
  { id: "fill", label: "빈칸채우기" },
];
const SENT_GAMES = [
  { id: "match", label: "문장연결" },
  { id: "listen", label: "듣고찾기" },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function speak(text) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  u.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export default function GamesMode({ items, kind, accent }) {
  const isWord = kind === "word";
  const games = isWord ? WORD_GAMES : SENT_GAMES;
  const [active, setActive] = useState(games[0].id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" data-testid="game-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            data-testid={`game-${g.id}`}
            onClick={() => setActive(g.id)}
            className={`btn-push px-3 py-2 text-xs ${active === g.id ? (isWord ? "btn-push-primary" : "btn-push-sentence") : "hover:bg-slate-50"}`}
          >
            <GameController size={14} weight="bold" className="inline mr-1" /> {g.label}
          </button>
        ))}
      </div>

      {active === "match" && <MatchGame items={items} kind={kind} accent={accent} />}
      {active === "fill" && <FillGame items={items} kind={kind} accent={accent} />}
      {active === "listen" && <ListenGame items={items} kind={kind} accent={accent} />}
    </div>
  );
}

function MatchGame({ items, kind, accent }) {
  const [seed, setSeed] = useState(0);
  const pairs = useMemo(() => shuffle(items.filter((x) => x.chinese && x.korean)).slice(0, 5), [items, seed]);
  const [lefts] = useMemo(() => [pairs], [pairs]);
  const rights = useMemo(() => shuffle(pairs), [pairs]);

  const [pickedLeft, setPickedLeft] = useState(null);
  const [matched, setMatched] = useState({});
  const [wrong, setWrong] = useState(null);
  const { record } = useProgress();

  const onLeft = (i) => { if (matched[`L${i}`]) return; setPickedLeft(i); setWrong(null); };
  const onRight = (j) => {
    if (pickedLeft === null || matched[`R${j}`]) return;
    if (lefts[pickedLeft].chinese === rights[j].chinese) {
      setMatched((m) => ({ ...m, [`L${pickedLeft}`]: true, [`R${j}`]: true }));
      record({ kind, label: lefts[pickedLeft].chinese, correct: true, mode: "game" });
      setPickedLeft(null);
    } else {
      setWrong({ L: pickedLeft, R: j });
      record({ kind, label: lefts[pickedLeft].chinese, correct: false, mode: "game" });
      setTimeout(() => { setWrong(null); setPickedLeft(null); }, 800);
    }
  };

  const completed = Object.keys(matched).length / 2 >= pairs.length;

  if (!pairs.length) return <div className="card-push p-8 text-center text-slate-500">최소 2개 항목이 필요해요.</div>;

  return (
    <div className="card-push p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-500 font-kr">중국어와 한국어 뜻을 짝지으세요</div>
        <button onClick={() => { setMatched({}); setPickedLeft(null); setSeed((s) => s + 1); }} className="btn-push px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-1" data-testid="match-restart">
          <ArrowsClockwise size={12} weight="bold" /> 다시
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3" data-testid="match-board">
        <div className="space-y-2">
          {lefts.map((p, i) => {
            const isMatched = matched[`L${i}`];
            const isPicked = pickedLeft === i;
            const isWrong = wrong?.L === i;
            return (
              <button
                key={i}
                data-testid={`match-left-${i}`}
                disabled={isMatched}
                onClick={() => onLeft(i)}
                className={`btn-push w-full py-3 font-cn text-xl text-left px-4 ${isMatched ? "opacity-50 line-through" : isPicked ? "btn-push-primary" : isWrong ? "btn-push-danger" : "hover:bg-slate-50"}`}
              >
                {p.chinese}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {rights.map((p, j) => {
            const isMatched = matched[`R${j}`];
            const isWrong = wrong?.R === j;
            return (
              <button
                key={j}
                data-testid={`match-right-${j}`}
                disabled={isMatched}
                onClick={() => onRight(j)}
                className={`btn-push w-full py-3 font-kr text-base text-left px-4 ${isMatched ? "opacity-50 line-through" : isWrong ? "btn-push-danger" : "hover:bg-slate-50"}`}
              >
                {p.korean}
              </button>
            );
          })}
        </div>
      </div>
      {completed && <div className="text-center mt-4 text-emerald-600 font-bold"><CheckCircle weight="fill" className="inline mr-1" /> 모두 맞췄어요!</div>}
    </div>
  );
}

function FillGame({ items, kind, accent }) {
  const [seed, setSeed] = useState(0);
  const pool = useMemo(() => shuffle(items.filter((x) => x.chinese && x.korean)), [items, seed]);
  const cur = pool[0];
  const wrongs = useMemo(() => shuffle(items.filter((x) => x !== cur)).slice(0, 3).map((x) => x.chinese), [cur, items]);
  const choices = useMemo(() => cur ? shuffle([cur.chinese, ...wrongs]) : [], [cur, wrongs]);
  const [picked, setPicked] = useState(null);
  const { record } = useProgress();

  const onPick = (c) => {
    setPicked(c);
    const ok = c === cur.chinese;
    record({ kind, label: cur.chinese, correct: ok, mode: "game" });
    setTimeout(() => { setSeed((s) => s + 1); setPicked(null); }, 1000);
  };

  if (!cur) return <div className="card-push p-8 text-center text-slate-500">최소 4개 항목이 필요해요.</div>;

  return (
    <div className="card-push p-6 space-y-5">
      <div className="text-center">
        <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">이 뜻에 해당하는 한자는?</div>
        <div className="text-2xl font-bold text-slate-800 font-kr">{cur.korean}</div>
        <div className="text-sm italic text-slate-500 mt-1 font-cn">{cur.pinyin}</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-2" data-testid="fill-choices">
        {choices.map((c, i) => {
          const isPicked = picked === c;
          const isCorrect = picked && c === cur.chinese;
          const isWrong = isPicked && c !== cur.chinese;
          return (
            <button key={i} data-testid={`fill-choice-${i}`} disabled={!!picked} onClick={() => onPick(c)}
              className={`btn-push py-3 text-xl font-cn ${isCorrect ? "btn-push-primary" : isWrong ? "btn-push-danger" : "hover:bg-slate-50"}`}>
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListenGame({ items, kind, accent }) {
  const [seed, setSeed] = useState(0);
  const pool = useMemo(() => shuffle(items.filter((x) => x.chinese)), [items, seed]);
  const cur = pool[0];
  const wrongs = useMemo(() => shuffle(items.filter((x) => x !== cur)).slice(0, 3).map((x) => x.chinese), [cur, items]);
  const choices = useMemo(() => cur ? shuffle([cur.chinese, ...wrongs]) : [], [cur, wrongs]);
  const [picked, setPicked] = useState(null);
  const { record } = useProgress();

  useEffect(() => {
    if (cur) {
      const t = setTimeout(() => speak(cur.chinese), 300);
      return () => clearTimeout(t);
    }
  }, [cur]);

  if (!cur) return <div className="card-push p-8 text-center text-slate-500">최소 4개 항목이 필요해요.</div>;

  const onPick = (c) => {
    setPicked(c);
    const ok = c === cur.chinese;
    record({ kind, label: cur.chinese, correct: ok, mode: "game" });
    setTimeout(() => { setSeed((s) => s + 1); setPicked(null); }, 1200);
  };

  return (
    <div className="card-push p-6 space-y-5">
      <div className="text-center">
        <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">들은 문장을 고르세요</div>
        <button onClick={() => speak(cur.chinese)} data-testid="listen-play" className="btn-push btn-push-sentence px-5 py-3 inline-flex items-center gap-2 text-sm">
          <SpeakerHigh size={18} weight="bold" /> 다시 듣기
        </button>
      </div>
      <div className="grid gap-2" data-testid="listen-choices">
        {choices.map((c, i) => {
          const isPicked = picked === c;
          const isCorrect = picked && c === cur.chinese;
          const isWrong = isPicked && c !== cur.chinese;
          return (
            <button key={i} data-testid={`listen-choice-${i}`} disabled={!!picked} onClick={() => onPick(c)}
              className={`btn-push py-3 text-lg font-cn text-left px-4 ${isCorrect ? "btn-push-sentence" : isWrong ? "btn-push-danger" : "hover:bg-slate-50"}`}>
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}
