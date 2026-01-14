// app/users/[userId]/page.tsx
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserProfile, getUserRatings } from "../actions"; 
import UserProfileClient from "./UserProfileClient";

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function UserProfilePage({ params }: Props) {
  const session = await auth();
  const { userId } = await params;

  if (!session?.user?.id) redirect(`/login?next=/users/${userId}`);

  // 내 페이지면 /my로 이동
  if (session.user.id === userId) {
    redirect("/my");
  }

  const user = await getUserProfile(userId);
  if (!user) notFound();

  const ratings = await getUserRatings(userId);

  // 차단 여부 확인
  const blockRecord = await prisma.block.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId: session.user.id,
        blockedId: userId,
      },
    },
  });
  const isBlocking = !!blockRecord;

  return (
    <main className="max-w-4xl mx-auto px-4 pt-6 pb-20">
      <UserProfileClient 
        user={user} 
        initialRatings={ratings} 
        myId={session.user.id}
        isBlocking={isBlocking}
      />
    </main>
  );
}