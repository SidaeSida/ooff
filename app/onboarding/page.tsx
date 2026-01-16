"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation"; // [추가] 라우터 사용
import { agreeToTerms } from "./actions";

export default function OnboardingPage() {
  const router = useRouter(); // [추가]
  const [loading, setLoading] = useState(false);

  const handleAgree = async () => {
    setLoading(true);
    try {
      // 1. 서버 액션 호출
      await agreeToTerms();
      
      // 2. [핵심] 성공 시 클라이언트에서 세션 갱신 및 페이지 이동
      // refresh()를 해야 미들웨어/가드(Guard)가 업데이트된 세션(약관동의O)을 인지함
      router.refresh(); 
      router.replace("/my"); 
    } catch (error) {
      console.error(error);
      alert("오류가 발생했습니다. 다시 시도해주세요.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-start pt-32 bg-white px-4">
      <div className="max-w-md w-full space-y-8 text-center animate-in fade-in duration-500">
        
        {/* 로고 또는 타이틀 */}
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Welcome to OOFF
          </h1>
          <p className="text-gray-500 text-sm">
            영화 취향을 기록하고, 조용하게 연결되세요.
          </p>
        </div>

        {/* 약관 안내 박스 */}
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-left space-y-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="font-bold text-gray-900">서비스 시작하기</h2>
            <p className="text-xs text-gray-500">
              계속하려면 아래 약관에 동의해야 합니다.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-gray-400 transition-colors">
              <div className="shrink-0 pt-0.5">
                <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="text-xs text-gray-600 leading-relaxed">
                <span className="font-bold text-gray-900">필수 동의</span><br/>
                <Link href="/policy/terms" target="_blank" className="underline hover:text-black">이용약관</Link> 및 <Link href="/policy/privacy" target="_blank" className="underline hover:text-black">개인정보처리방침</Link>을 확인하였으며, 이에 동의합니다.
              </div>
            </label>
          </div>
        </div>

        {/* 동의 버튼 */}
        <button
          onClick={handleAgree}
          disabled={loading}
          className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl text-base hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform active:scale-[0.98]"
        >
          {loading ? "시작하는 중..." : "동의하고 시작하기"}
        </button>

        <p className="text-[10px] text-gray-400">
          * 만 14세 이상만 가입 가능합니다.
        </p>
      </div>
    </main>
  );
}