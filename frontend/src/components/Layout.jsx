import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { SignOut, User, BookOpen, ChartLineUp, ChatCircleDots, GraduationCap, Bell, Brain } from "@phosphor-icons/react";
import StatsDashboardModal from "@/components/StatsDashboardModal";
import AIChatTutor from "@/components/AIChatTutor";
import NotificationSettings, { useDailyReminder } from "@/components/NotificationSettings";

export default function Layout({ children, mode = "word" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [statsOpen, setStatsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Run daily reminder check in background
  useDailyReminder();

  const accent = mode === "sentence" ? "text-purple-600" : "text-blue-600";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 glass-nav">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <button
            data-testid="nav-home-btn"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 group"
          >
            <div className={`w-9 h-9 rounded-xl ${mode === "sentence" ? "bg-purple-600" : "bg-blue-600"} flex items-center justify-center text-white shadow-md`}>
              <BookOpen size={20} weight="duotone" />
            </div>
            <div className="text-left">
              <div className="font-heading font-black text-slate-900 text-lg leading-none">CN学</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Chinese Slots</div>
            </div>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              data-testid="nav-grammar-btn"
              onClick={() => navigate("/grammar")}
              className="btn-push px-2.5 py-2 text-xs flex items-center gap-1.5 hover:bg-slate-50"
              title="문법"
            >
              <GraduationCap size={14} weight="bold" /> <span className="hidden sm:inline">문법</span>
            </button>
            <button
              data-testid="nav-global-srs-btn"
              onClick={() => navigate("/study?srs=all")}
              className="btn-push px-2.5 py-2 text-xs flex items-center gap-1.5 hover:bg-slate-50"
              title="전체 SRS 복습"
            >
              <Brain size={14} weight="bold" /> <span className="hidden sm:inline">복습</span>
            </button>
            <button
              data-testid="nav-chat-btn"
              onClick={() => setChatOpen(true)}
              className="btn-push px-2.5 py-2 text-xs flex items-center gap-1.5 hover:bg-slate-50"
              title="AI 튜터"
            >
              <ChatCircleDots size={14} weight="bold" /> <span className="hidden sm:inline">튜터</span>
            </button>
            <button
              data-testid="nav-notif-btn"
              onClick={() => setNotifOpen(true)}
              className="btn-push px-2.5 py-2 text-xs flex items-center gap-1.5 hover:bg-slate-50"
              title="알림 설정"
            >
              <Bell size={14} weight="bold" />
            </button>
            <button
              data-testid="nav-stats-btn"
              onClick={() => setStatsOpen(true)}
              className="btn-push px-2.5 py-2 text-xs flex items-center gap-1.5 hover:bg-slate-50"
              title="학습 통계"
            >
              <ChartLineUp size={14} weight="bold" /> <span className="hidden sm:inline">통계</span>
            </button>
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 ml-1">
                  {user.picture ? (
                    <img src={user.picture} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <User size={18} className={accent} />
                  )}
                  <span className="text-sm font-semibold text-slate-700" data-testid="user-nickname">
                    {user.nickname || user.name}
                  </span>
                </div>
                <button
                  onClick={async () => { await logout(); navigate("/login"); }}
                  data-testid="logout-btn"
                  className="btn-push px-2.5 py-2 text-xs flex items-center gap-1 hover:bg-slate-50"
                  title="로그아웃"
                >
                  <SignOut size={14} weight="bold" />
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate("/login")}
                data-testid="login-cta"
                className="btn-push btn-push-primary px-3 py-2 text-xs ml-1"
              >
                로그인
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">{children}</main>
      <StatsDashboardModal open={statsOpen} onClose={() => setStatsOpen(false)} />
      <AIChatTutor open={chatOpen} onClose={() => setChatOpen(false)} />
      <NotificationSettings open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
