import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { SignOut, User, BookOpen, ChartLineUp } from "@phosphor-icons/react";
import StatsDashboardModal from "@/components/StatsDashboardModal";

export default function Layout({ children, mode = "word" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [statsOpen, setStatsOpen] = useState(false);

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

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              data-testid="nav-stats-btn"
              onClick={() => setStatsOpen(true)}
              className="btn-push px-3 py-2 text-xs flex items-center gap-1.5 hover:bg-slate-50"
              title="학습 통계"
            >
              <ChartLineUp size={14} weight="bold" /> 통계
            </button>
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200">
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
                  className="btn-push px-3 py-2 text-xs flex items-center gap-1.5 hover:bg-slate-50"
                >
                  <SignOut size={16} weight="bold" /> 로그아웃
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate("/login")}
                data-testid="login-cta"
                className="btn-push btn-push-primary px-4 py-2 text-sm"
              >
                로그인
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">{children}</main>
      <StatsDashboardModal open={statsOpen} onClose={() => setStatsOpen(false)} />
    </div>
  );
}
