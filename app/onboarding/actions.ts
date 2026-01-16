"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function agreeToTerms() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // DB 업데이트: 현재 시간 기록
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      termsAcceptedAt: new Date(),
    },
  });

  // 세션 정보 갱신을 위해 모든 레이아웃 재검증
  revalidatePath("/", "layout");
  
  // [중요] 서버에서 redirect하지 않고 성공 신호만 보냄
  return { success: true };
}