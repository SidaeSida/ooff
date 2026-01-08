// app/my/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 기존 deleteUserEntry 아래에 추가하세요.

export async function updateNickname(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const newNickname = String(formData.get("nickname") ?? "").trim();
  
  // 유효성 검사 (최소 2자, 최대 20자 등 규칙 추가 가능)
  if (newNickname.length < 2 || newNickname.length > 20) {
    throw new Error("Nickname must be between 2 and 20 characters.");
  }

  try {
    // 중복 검사
    const existing = await prisma.user.findUnique({
      where: { nickname: newNickname },
    });
    
    // 내 닉네임이 아닌데 이미 존재하면 에러
    if (existing && existing.id !== session.user.id) {
      throw new Error("This nickname is already taken.");
    }

    // 업데이트
    await prisma.user.update({
      where: { id: session.user.id },
      data: { nickname: newNickname },
    });

    revalidatePath("/my");
    revalidatePath("/settings"); // 닉네임 변경이 설정 페이지에도 영향 줄 수 있으므로
  } catch (e: any) {
    throw new Error(e.message || "Failed to update nickname.");
  }
}