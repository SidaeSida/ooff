// app/settings/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import PrivacyControlsClient from "@/app/my/PrivacyControlsClient";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // 공개범위 설정 조회
  let p = await prisma.userPrivacy.findUnique({
    where: { userId },
    select: { ratingVisibility: true, reviewVisibility: true },
  });

  const initialPrivacy = {
    ratingVisibility: p?.ratingVisibility ?? "public",
    reviewVisibility: p?.reviewVisibility ?? "public",
  };

  return (
    <main className="max-w-2xl mx-auto px-4 pt-6 pb-20 space-y-8">
      <div className="flex items-center gap-2 border-b pb-4">
        <Link href="/my" className="text-gray-400 hover:text-gray-800">
           <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
           </svg>
        </Link>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* 1. Privacy Section */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
           <h2 className="text-lg font-semibold">Privacy Controls</h2>
        </div>
        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
          <PrivacyControlsClient initial={initialPrivacy as any} />
        </div>
        <p className="text-xs text-gray-500 px-1">
          Control who can see your ratings and reviews.
        </p>
      </section>

      {/* 2. Account Section */}
      <section className="space-y-4 pt-6 border-t">
        <h2 className="text-lg font-semibold">Account</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-1">
            <span className="text-sm text-gray-600">Email</span>
            <span className="text-sm font-medium text-gray-900">{session.user.email}</span>
          </div>
          {/* SignOut is now on My Page, but kept here as backup or removed as per request. Removed for clean UI. */}
        </div>
      </section>

      {/* 3. Account Management (구 Danger Zone) */}
      <section className="space-y-4 pt-6 border-t">
        {/* 제목은 건조하게 검은색으로 변경 */}
        <h2 className="text-lg font-semibold text-gray-900">Account Management</h2>
        
        {/* 박스는 여전히 위험함을 알리기 위해 Red 톤 유지 */}
        <div className="bg-red-50 p-5 rounded-2xl border border-red-100 flex justify-between items-center">
          <div>
            <p className="text-sm font-bold text-red-900">Delete Account</p>
            <p className="text-xs text-red-700 mt-0.5">Permanently remove your data.</p>
          </div>
          <button className="px-4 py-2 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-xl hover:bg-red-50 transition-colors">
            Delete
          </button>
        </div>
      </section>
    </main>
  );
}