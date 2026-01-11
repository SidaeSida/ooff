"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type ActionState = {
  success: boolean;
  message?: string;
};

// 1. 닉네임 변경
export async function updateNickname(formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const newNickname = String(formData.get("nickname") ?? "").trim();
  
  if (newNickname.length < 2 || newNickname.length > 20) {
    return { success: false, message: "닉네임은 2~20자 사이여야 합니다." };
  }

  if (/[^a-zA-Z0-9가-힣._-]/.test(newNickname)) {
     return { success: false, message: "영문, 한글, 숫자, ., -, _ 만 사용 가능합니다." };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { nickname: newNickname } });
    if (existing && existing.id !== session.user.id) {
      return { success: false, message: "이미 사용 중인 닉네임입니다." };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { nickname: newNickname },
    });

    revalidatePath("/my");
    revalidatePath("/settings");
    
    return { success: true };
  } catch (e: any) {
    return { success: false, message: "서버 오류가 발생했습니다." };
  }
}

// 2. 회원 탈퇴
export async function deleteAccount() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  try {
    await prisma.user.delete({ where: { id: session.user.id } });
    return { success: true };
  } catch (error) {
    console.error("Delete account error:", error);
    throw new Error("Failed to delete account");
  }
}

// 3. 유저 검색 (이메일 제거)
export async function searchUsers(query: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const myId = session.user.id;

  if (!query || query.trim().length < 1) return [];

  const users = await prisma.user.findMany({
    where: {
      nickname: {
        contains: query,
        mode: "insensitive",
      },
      id: { not: myId },
    },
    select: {
      id: true,
      nickname: true,
      // email 제거
      followedBy: {
        where: { followerId: myId },
        select: { followerId: true },
      },
    },
    take: 10,
  });

  return users.map((u) => ({
    id: u.id,
    nickname: u.nickname,
    isFollowing: u.followedBy.length > 0,
  }));
}

// 4. 팔로우 토글
export async function toggleFollow(targetId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const myId = session.user.id;
  if (myId === targetId) throw new Error("Cannot follow yourself");

  const existing = await prisma.follows.findUnique({
    where: {
      followerId_followingId: { followerId: myId, followingId: targetId },
    },
  });

  if (existing) {
    await prisma.follows.delete({
      where: { followerId_followingId: { followerId: myId, followingId: targetId } },
    });
  } else {
    await prisma.follows.create({
      data: { followerId: myId, followingId: targetId },
    });
  }

  revalidatePath("/my");
  return !existing;
}