// app/my/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import PrivacyControlsClient from "./PrivacyControlsClient";
import MyRatingsClient from "./MyRatingsClient";
import SignOutButton from "./SignOutButton";
import PageShowRefresh from "@/components/PageShowRefresh";

export default async function MyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/my");

  const userId = session.user.id as string;
  const email = session.user.email ?? "Unknown";

  let p:
    | {
        ratingVisibility: "private" | "friends" | "public";
        reviewVisibility: "private" | "friends" | "public";
      }
    | null = null;

  try {
    p = await prisma.userPrivacy.findUnique({
      where: { userId },
      select: { ratingVisibility: true, reviewVisibility: true },
    });
  } catch {
    // 테이블 미존재(P2021) 등 초기화 전에도 페이지가 뜨도록 폴백
  }

  const initialPrivacy = {
    ratingVisibility: (p?.ratingVisibility ?? "private") as
      | "private"
      | "friends"
      | "public",
    reviewVisibility: (p?.reviewVisibility ?? "private") as
      | "private"
      | "friends"
      | "public",
  };

  return (
    <main className="max-w-4xl mx-auto px-4 pt-1 pb-10">
      {/* BFCache 복원 시 router.refresh() */}
      <PageShowRefresh />
      <p className="text-sm text-gray-600 mb-2">
        Signed in as <span className="font-medium">{email}</span>
      </p>
      <div className="mb-3">
        <SignOutButton />
      </div>
      <PrivacyControlsClient initial={initialPrivacy} />
      <section className="mt-6">
        <h2 className="text-xl font-semibold mb-3">My Ratings</h2>
        <MyRatingsClient />
      </section>
    </main>
  );
}
