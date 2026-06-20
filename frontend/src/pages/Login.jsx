import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { GoogleLogo, Translate, Sparkle, Lightning } from "@phosphor-icons/react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  const handleGoogleLogin = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleAnonymous = () => navigate("/dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-5xl w-full grid md:grid-cols-2 gap-10 items-center">
        {/* Left: Hero */}
        <div className="space-y-6 float-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold tracking-widest uppercase">
            <Sparkle size={14} weight="fill" /> 중국어 학습의 새로운 시작
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-tight">
            한자 한 글자부터<br />
            <span className="text-blue-600">문장</span>까지,<br />
            <span className="text-purple-600">슬롯</span>으로 정복하자
          </h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-md">
            교재별·챕터별로 단어와 문장을 정리하고, 퀴즈·플래시카드·미니게임으로
            재미있게 학습하세요. <strong>3개 슬롯 무료</strong>로 시작!
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Translate weight="duotone" size={20} className="text-blue-600" />
              단어 + 문장 학습
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Lightning weight="duotone" size={20} className="text-amber-500" />
              슬롯 3개 무료
            </div>
          </div>
        </div>

        {/* Right: Login card */}
        <div className="card-push p-8 sm:p-10 space-y-6 float-in" style={{ animationDelay: "120ms" }}>
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">시작하기</h2>
            <p className="text-sm text-slate-500 mt-2">
              Google로 로그인하면 학습 진도와 슬롯이 클라우드에 저장됩니다.
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            data-testid="google-login-btn"
            className="btn-push w-full py-4 px-5 text-base flex items-center justify-center gap-3 hover:bg-slate-50"
          >
            <GoogleLogo size={22} weight="bold" />
            Google 계정으로 로그인
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">또는</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          <button
            onClick={handleAnonymous}
            data-testid="anonymous-login-btn"
            className="btn-push w-full py-3 px-5 text-sm text-slate-600 hover:bg-slate-50"
          >
            로그인 없이 둘러보기 (로컬 저장)
          </button>

          <p className="text-xs text-slate-400 text-center leading-relaxed">
            로그인 시 닉네임, 학습 통계, 슬롯이 동기화됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
