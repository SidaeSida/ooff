import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import PrivacyControlsClient from "@/app/my/PrivacyControlsClient";
import DeleteAccountButton from "./DeleteAccountButton";
import ProfileForm from "./ProfileForm";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [user, p] = await Promise.all([
    prisma.user.findUnique({ 
      where: { id: userId },
      select: { 
        nickname: true, 
        bio: true, 
        // [수정] Letterboxd만 유지하고 나머지 삭제
        letterboxdId: true,
        email: true 
      }
    }),
    prisma.userPrivacy.findUnique({
      where: { userId },
      select: { ratingVisibility: true, reviewVisibility: true },
    })
  ]);

  if (!user) redirect("/login");

  const initialPrivacy = {
    ratingVisibility: p?.ratingVisibility ?? "public",
    reviewVisibility: p?.reviewVisibility ?? "public",
  };

  const initialProfile = {
    nickname: user.nickname ?? "",
    bio: user.bio ?? "",
    // [수정] Letterboxd만 유지
    letterboxdId: user.letterboxdId ?? "",
  };

  return (
    <main className="max-w-2xl mx-auto px-4 pt-6 pb-20 space-y-10">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <Link href="/my" className="text-gray-400 hover:text-gray-800 transition-colors">
           <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
           </svg>
        </Link>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* 1. Profile Settings */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <ProfileForm initial={initialProfile} />
        </div>
      </section>

      {/* 2. Privacy Section */}
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

      {/* 3. Account Info */}
      <section className="space-y-4 pt-6 border-t">
        <h2 className="text-lg font-semibold">Account</h2>
        <div className="space-y-3 px-1">
          <div className="flex justify-between items-center py-1">
            <span className="text-sm text-gray-600">Email</span>
            <span className="text-sm font-medium text-gray-900">{user.email}</span>
          </div>
        </div>
      </section>

      {/* 4. Danger Zone */}
      <section className="space-y-4 pt-6 border-t">
        <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
        <div className="bg-red-50 p-5 rounded-2xl border border-red-100 flex justify-between items-center">
          <div>
            <p className="text-sm font-bold text-red-900">Delete Account</p>
            <p className="text-xs text-red-700 mt-0.5">Permanently remove your data.</p>
          </div>
          <DeleteAccountButton />
        </div>
      </section>

      {/* Footer: Policies */}
      <footer className="pt-10 pb-6 text-center border-t border-dashed border-gray-200">
        <div className="flex justify-center gap-4 text-xs text-gray-500">
          <Link href="/policy/terms" className="hover:text-gray-900 underline">이용약관</Link>
          <span>|</span>
          <Link href="/policy/privacy" className="hover:text-gray-900 underline">개인정보처리방침</Link>
        </div>
        <p className="text-[10px] text-gray-400 mt-3">
          © 2025 OOFF. All rights reserved.
        </p>
      </footer>
    </main>
  );
}