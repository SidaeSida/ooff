// app/my/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import MyPageClient from "./MyPageClient";
import PageShowRefresh from "@/components/PageShowRefresh";

type Tab = "ratings" | "friends" | "feed";

export default async function MyPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/my");

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      nickname: true,
      bio: true,
      // [수정] Letterboxd만 유지
      letterboxdId: true,
      
      _count: {
        select: {
          followedBy: true,
          following: true,
        },
      },
    },
  });

  if (!user) redirect("/login");

  const emailPrefix = user.email?.split("@")[0].slice(0, 3) ?? "";
  const isDefaultNickname = new RegExp(`^${emailPrefix}[0-9]{4}$`).test(
    user.nickname ?? ""
  );

  const sp = searchParams ? await searchParams : undefined;
  const rawTab = String(sp?.tab ?? "").toLowerCase();
  const initialTab: Tab =
    rawTab === "friends" || rawTab === "feed" || rawTab === "ratings"
      ? (rawTab as Tab)
      : "ratings";

  return (
    <main className="max-w-4xl mx-auto px-4 pt-6 pb-20">
      <PageShowRefresh />
      <MyPageClient
        initialTab={initialTab}
        user={{
          id: user.id,
          email: user.email ?? "",
          nickname: user.nickname ?? emailPrefix,
          followers: user._count.followedBy,
          following: user._count.following,
          isDefaultNickname,
          bio: user.bio,
          // [수정] Letterboxd만 유지
          letterboxdId: user.letterboxdId,
        }}
      />
    </main>
  );
}