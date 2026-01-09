// app/my/actions.ts
"use server";

import { revalidatePath } from "next/cache";
// [수정 1] signOut import 제거 (여기서는 사용하지 않습니다)
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 응답 타입 정의
type ActionState = {
  success: boolean;
  message?: string;
};

export async function updateNickname(formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const newNickname = String(formData.get("nickname") ?? "").trim();
  
  // 유효성 검사
  if (newNickname.length < 2 || newNickname.length > 20) {
    return { success: false, message: "닉네임은 2~20자 사이여야 합니다." };
  }

  // 특수문자 제한
  if (/[^a-zA-Z0-9가-힣._-]/.test(newNickname)) {
     return { success: false, message: "영문, 한글, 숫자, ., -, _ 만 사용 가능합니다." };
  }

  try {
    // 중복 검사
    const existing = await prisma.user.findUnique({
      where: { nickname: newNickname },
    });
    
    if (existing && existing.id !== session.user.id) {
      return { success: false, message: "이미 사용 중인 닉네임입니다." };
    }

    // 업데이트
    await prisma.user.update({
      where: { id: session.user.id },
      data: { nickname: newNickname },
    });

    revalidatePath("/my");
    revalidatePath("/settings");
    
    return { success: true };
  } catch (e: any) {
    return { success: false, message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." };
  }
}

// [수정 2] 회원 탈퇴 액션 변경
export async function deleteAccount() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  try {
    // DB에서 삭제 (Cascade 설정 덕분에 관련 데이터 모두 삭제됨)
    await prisma.user.delete({
      where: { id: session.user.id },
    });
    
    // [핵심 변경] 여기서 signOut을 호출하지 않고 성공 신호만 반환합니다.
    // (클라이언트가 이 신호를 받고나서 로그아웃을 수행합니다)
    return { success: true };

  } catch (error) {
    console.error("Delete account error:", error);
    throw new Error("Failed to delete account");
  }
}