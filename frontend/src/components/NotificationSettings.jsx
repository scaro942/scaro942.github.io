import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Bell, BellSlash, CheckCircle, Clock, Warning } from "@phosphor-icons/react";
import { Switch } from "@/components/ui/switch";

const LS_PREF = "cnxue_notif_pref";
const LS_LAST_FIRED = "cnxue_notif_last_fired";

function readPref() {
  try {
    return JSON.parse(localStorage.getItem(LS_PREF) || "null") || {
      enabled: false,
      hour: 20,
      minute: 0,
    };
  } catch {
    return { enabled: false, hour: 20, minute: 0 };
  }
}
function writePref(p) { localStorage.setItem(LS_PREF, JSON.stringify(p)); }

function studiedToday() {
  try {
    const p = JSON.parse(localStorage.getItem("cnxue_progress_v1") || "null");
    if (!p) return false;
    const today = new Date().toISOString().slice(0, 10);
    return (p.days?.[today]?.total || 0) > 0;
  } catch { return false; }
}

/**
 * Reminder check: runs in background after permission granted.
 * Fires once per day at user's scheduled time if they haven't studied today.
 */
export function useDailyReminder() {
  const fire = useCallback(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (studiedToday()) return;
    const today = new Date().toISOString().slice(0, 10);
    const lastFired = localStorage.getItem(LS_LAST_FIRED);
    if (lastFired === today) return;
    try {
      new Notification("📚 오늘의 중국어 학습 시간이에요!", {
        body: "스트릭을 유지하려면 잠깐이라도 복습해보세요. 5분이면 충분해요.",
        icon: "/favicon.ico",
        tag: "cnxue-daily",
      });
      localStorage.setItem(LS_LAST_FIRED, today);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    const pref = readPref();
    if (!pref.enabled) return;

    const check = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const reachedTime = hour > pref.hour || (hour === pref.hour && minute >= pref.minute);
      if (reachedTime) fire();
    };
    check(); // Check on mount
    const id = setInterval(check, 5 * 60 * 1000); // Every 5 min
    return () => clearInterval(id);
  }, [fire]);
}

export default function NotificationSettings({ open, onClose }) {
  const [pref, setPref] = useState(readPref);
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPref(readPref());
    setPerm(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  }, [open]);

  const requestPerm = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPerm(result);
  };

  const save = (next) => { setPref(next); writePref(next); };

  const sendTest = () => {
    if (perm !== "granted") return;
    setTesting(true);
    try {
      new Notification("🧪 알림 테스트", {
        body: "이런 식으로 매일 학습 알림이 표시됩니다.",
        icon: "/favicon.ico",
      });
    } catch { /* noop */ }
    setTimeout(() => setTesting(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-md rounded-2xl border-2" data-testid="notif-settings-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl flex items-center gap-2">
            <Bell weight="duotone" size={28} className="text-amber-500" /> 일일 학습 알림
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            매일 정해진 시간에 학습 리마인더를 받아보세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Permission */}
          {perm === "unsupported" && (
            <div className="card-push p-3 flex items-start gap-2 bg-red-50 border-red-200">
              <Warning size={18} className="text-red-500 mt-0.5" />
              <p className="text-xs text-red-700">이 브라우저는 알림을 지원하지 않습니다.</p>
            </div>
          )}
          {perm === "default" && (
            <div className="card-push p-4 space-y-2 bg-amber-50 border-amber-200">
              <p className="text-sm text-slate-700">먼저 브라우저 알림 권한을 허용해주세요.</p>
              <button
                data-testid="notif-request-perm"
                onClick={requestPerm}
                className="btn-push btn-push-gold px-4 py-2 text-xs"
              >알림 권한 요청</button>
            </div>
          )}
          {perm === "denied" && (
            <div className="card-push p-3 flex items-start gap-2 bg-red-50 border-red-200">
              <BellSlash size={18} className="text-red-500 mt-0.5" />
              <p className="text-xs text-red-700">알림이 차단되어 있어요. 브라우저 주소창의 자물쇠 아이콘 → 사이트 설정 → 알림을 &quot;허용&quot;으로 변경하세요.</p>
            </div>
          )}
          {perm === "granted" && (
            <div className="card-push p-3 flex items-center gap-2 bg-emerald-50 border-emerald-200">
              <CheckCircle size={18} weight="fill" className="text-emerald-500" />
              <p className="text-xs text-emerald-700 font-bold">알림 권한 허용됨</p>
            </div>
          )}

          {/* Toggle */}
          <div className="card-push p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-heading font-bold text-slate-900">일일 알림 켜기</div>
              <p className="text-xs text-slate-500 mt-0.5">오늘 학습하지 않았을 때만 표시</p>
            </div>
            <Switch
              data-testid="notif-toggle"
              checked={pref.enabled}
              disabled={perm !== "granted"}
              onCheckedChange={(v) => save({ ...pref, enabled: v })}
            />
          </div>

          {/* Time picker */}
          {pref.enabled && (
            <div className="card-push p-4 space-y-2">
              <label className="text-xs uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                <Clock size={12} weight="bold" /> 알림 시간
              </label>
              <div className="flex items-center gap-2">
                <select
                  data-testid="notif-hour"
                  value={pref.hour}
                  onChange={(e) => save({ ...pref, hour: parseInt(e.target.value) })}
                  className="flex-1 px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-amber-500 outline-none font-mono"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, "0")}시</option>
                  ))}
                </select>
                <select
                  data-testid="notif-minute"
                  value={pref.minute}
                  onChange={(e) => save({ ...pref, minute: parseInt(e.target.value) })}
                  className="flex-1 px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-amber-500 outline-none font-mono"
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option key={m} value={m}>{String(m).padStart(2, "0")}분</option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-slate-400">매일 이 시간 이후, 아직 학습하지 않았다면 알림이 한 번 표시됩니다.</p>
            </div>
          )}

          {/* Test */}
          {perm === "granted" && (
            <button
              data-testid="notif-test"
              onClick={sendTest}
              disabled={testing}
              className="btn-push w-full py-2 text-xs hover:bg-slate-50"
            >
              {testing ? "전송 완료!" : "테스트 알림 보내기"}
            </button>
          )}
        </div>

        <DialogFooter>
          <button onClick={onClose} className="btn-push px-4 py-2 text-xs hover:bg-slate-50">닫기</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
