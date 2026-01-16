"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

interface Props {
  session: any; // Session type
}

export default function OnboardingGuard({ session }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 1. 로그인 안 했으면 통과 (미들웨어나 페이지 레벨에서 처리)
    if (!session?.user) return;

    // 2. 약관 동의 여부 확인 (auth.ts에서 넣어준 값)
    const hasAgreed = !!session.user.termsAcceptedAt;

    // 3. 예외 경로 (온보딩 페이지 자체, 정책 페이지, 로그아웃 등)
    const isSafePath = 
      pathname === "/onboarding" || 
      pathname.startsWith("/policy") || 
      pathname.startsWith("/api");

    // [납치 로직] 미동의자 + 위험 경로 진입 시 -> 온보딩으로 이동
    if (!hasAgreed && !isSafePath) {
      router.replace("/onboarding");
    }

    // [역납치 로직] 이미 동의한 사람이 온보딩 페이지 오면 -> 홈으로 이동
    if (hasAgreed && pathname === "/onboarding") {
      router.replace("/my");
    }

  }, [session, pathname, router]);

  return null; // 화면에 아무것도 그리지 않음 (기능만 수행)
}