// Lightweight SM-2 (simplified) for anonymous-mode SRS. Mirrors backend.
const KEY = "cnxue_srs_v1";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch { return {}; }
}
function write(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

export function localSrsReview({ kind, label, quality }) {
  const all = read();
  const key = `${kind}::${label}`;
  const prev = all[key] || { ef: 2.5, interval: 0, reps: 0 };
  let { ef, interval, reps } = prev;
  if (quality < 3) {
    reps = 0; interval = 1;
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 3;
    else interval = Math.round(interval * ef);
    reps += 1;
    ef = Math.max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  }
  const due_at = new Date(Date.now() + interval * 86400000).toISOString();
  all[key] = { ef: Math.round(ef * 100) / 100, interval, reps, due_at,
               kind, label, key, last_review: new Date().toISOString() };
  write(all);
  return all[key];
}

export function localSrsDue(kind) {
  const all = read();
  const now = new Date().toISOString();
  return Object.values(all).filter((x) => x.kind === kind && x.due_at <= now);
}
