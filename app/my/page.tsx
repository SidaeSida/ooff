import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import MyPageClient from "./MyPageClient";
import PageShowRefresh from "@/components/PageShowRefresh";

export default async function MyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/my");

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      nickname: true,
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
  const isDefaultNickname = new RegExp(`^${emailPrefix}[0-9]{4}$`).test(user.nickname ?? "");

  return (
    <main className="max-w-4xl mx-auto px-4 pt-6 pb-20">
      <PageShowRefresh />
      <MyPageClient
        user={{
          id: user.id, // [추가] ID 전달
          email: user.email ?? "",
          nickname: user.nickname ?? emailPrefix,
          followers: user._count.followedBy,
          following: user._count.following,
          isDefaultNickname,
        }}
      />
    </main>
  );
}