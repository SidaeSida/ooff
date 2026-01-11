import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserProfile, getUserRatings } from "../actions"; 
import UserProfileClient from "./UserProfileClient";

// [수정] params를 Promise로 처리
interface Props {
  params: Promise<{ userId: string }>;
}

export default async function UserProfilePage({ params }: Props) {
  const session = await auth();
  
  // [수정] params를 await로 풀어서 userId 추출 (이게 없어서 에러 났던 것)
  const { userId } = await params;

  if (!session?.user?.id) redirect(`/login?next=/users/${userId}`);

  if (session.user.id === userId) {
    redirect("/my");
  }

  const user = await getUserProfile(userId);
  if (!user) notFound();

  // Decimal 문제는 actions.ts에서 해결됨
  const ratings = await getUserRatings(userId);

  return (
    <main className="max-w-4xl mx-auto px-4 pt-6 pb-20">
      <UserProfileClient 
        user={user} 
        initialRatings={ratings} 
        myId={session.user.id}
      />
    </main>
  );
}