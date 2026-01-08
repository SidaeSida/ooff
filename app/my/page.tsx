// app/my/page.tsx
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

  // 닉네임이 Default 패턴(이메일앞3자리+숫자4개)인지 확인하는 로직 (Client에 힌트 전달)
  const emailPrefix = user.email?.split("@")[0].slice(0, 3) ?? "";
  // 예: kss1234 패턴이면 true
  const isDefaultNickname = new RegExp(`^${emailPrefix}[0-9]{4}$`).test(user.nickname ?? "");

  return (
    <main className="max-w-4xl mx-auto px-4 pt-6 pb-20">
      <PageShowRefresh />
      <MyPageClient
        user={{
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