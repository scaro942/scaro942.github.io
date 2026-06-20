import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

const PROG_KEY = "cnxue_progress_v1";

function localProgress() {
  try { return JSON.parse(localStorage.getItem(PROG_KEY) || "null"); }
  catch { return null; }
}
function saveLocalProgress(p) {
  localStorage.setItem(PROG_KEY, JSON.stringify(p));
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function recordLocal({ kind, label, correct }) {
  const p = localProgress() || { days: {}, items: {} };
  const d = todayStr();
  p.days[d] = p.days[d] || { date: d, total: 0, correct: 0 };
  p.days[d].total += 1;
  if (correct) p.days[d].correct += 1;
  const key = `${kind}::${label}`;
  p.items[key] = p.items[key] || { kind, label, total: 0, correct: 0 };
  p.items[key].total += 1;
  if (correct) p.items[key].correct += 1;
  p.items[key].last_seen = new Date().toISOString();
  saveLocalProgress(p);
}

function readLocalSummary() {
  const p = localProgress() || { days: {}, items: {} };
  const days = Object.values(p.days).sort((a, b) => b.date.localeCompare(a.date));
  const items = Object.values(p.items).sort((a, b) => b.total - a.total);
  const daySet = new Set(days.filter((d) => d.total > 0).map((d) => d.date));
  let streak = 0;
  let cur = new Date();
  while (daySet.has(cur.toISOString().slice(0, 10))) {
    streak += 1;
    cur.setDate(cur.getDate() - 1);
  }
  const total = days.reduce((a, d) => a + d.total, 0);
  const correct = days.reduce((a, d) => a + d.correct, 0);
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  return { days, items, streak, total, correct, accuracy };
}

export function useProgress() {
  const { user } = useAuth();
  const isAuth = !!user;

  const record = useMemo(() => async ({ kind, label, correct, mode }) => {
    if (isAuth) {
      try { await api.post("/progress/record", { kind, label, correct, mode }); } catch { /* noop */ }
    } else {
      recordLocal({ kind, label, correct });
    }
  }, [isAuth]);

  return { record, isAuth };
}

export function useProgressSummary() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (user) {
          const { data: d } = await api.get("/progress");
          setData(d);
        } else {
          setData(readLocalSummary());
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  return { data, loading };
}
