// app/my/page.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import PrivacyControlsInline from "./PrivacyControlsClient";
import MyRatingsClient from "./MyRatingsClient";

export default function MyPage() {
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      router.replace("/login?next=/my");
    },
  });

  if (status === "loading") {
    return (
      <main className="min-h-[60vh] grid place-items-center">
        <div className="w-full max-w-sm animate-pulse">
          <div className="h-5 w-36 rounded bg-gray-200 mb-2" />
          <div className="h-4 w-56 rounded bg-gray-200 mb-4" />
          <div className="h-8 w-24 rounded bg-gray-200" />
        </div>
      </main>
    );
  }

  const email = session?.user?.email ?? "Unknown";

  return (
    <main className="max-w-4xl mx-auto px-4 pt-1 pb-10">
      {/* 헤더와 본문 사이 간격을 절반 수준으로 축소 */}
      <p className="text-sm text-gray-600 mb-2">
        Signed in as <span className="font-medium">{email}</span>
      </p>

      {/* Sign out만 유지, 위 메뉴와 간격 최소화 */}
      <div className="mb-3">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
          aria-label="Sign out"
        >
          <span>Sign out</span>
        </button>
      </div>

      {/* 공개 범위 (인라인, 얇은 구분선만) */}
      <PrivacyControlsInline />

      {/* 나의 평가 (컴팩트 카드) */}
      <section className="mt-6">
        <h2 className="text-xl font-semibold mb-3">My Ratings</h2>
        <MyRatingsClient />
      </section>
    </main>
  );
}
