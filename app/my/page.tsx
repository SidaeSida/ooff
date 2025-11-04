// app/my/page.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

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
          <div className="h-6 w-40 rounded bg-gray-200 mb-3" />
          <div className="h-4 w-64 rounded bg-gray-200 mb-6" />
          <div className="h-10 w-24 rounded bg-gray-200" />
        </div>
      </main>
    );
  }

  const email = session?.user?.email ?? "Unknown";
  const actionClass =
  "px-3 py-2 text-sm rounded-lg border cursor-pointer select-none " +
  "hover:bg-gray-50 hover:underline focus:outline-none focus:ring-2 focus:ring-gray-300";

    return (
    <main className="min-h-[60vh]">
        <h1 className="text-lg font-semibold mb-2">My</h1>
        <p className="text-sm text-gray-600 mb-6">
        Signed in as <span className="font-medium">{email}</span>
        </p>

        <div className="flex items-center gap-3">
        <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className={actionClass}
            aria-label="Sign out"
        >
            Sign out
        </button>

        <a href="/timetable" className={actionClass} aria-label="Go to Timetable">
            Go to Timetable
        </a>

        <a href="/films" className={actionClass} aria-label="Go to Films">
            Go to Films
        </a>
        </div>
    </main>
    );
}
