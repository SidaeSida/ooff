// app/my/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type ActionState = {
  success: boolean;
  message?: string;
};

// [수정] 닉네임 + 프로필(Bio, SNS) 변경 통합
export async function updateProfile(formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const nickname = String(formData.get("nickname") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const instagramId = String(formData.get("instagramId") ?? "").trim();
  const twitterId = String(formData.get("twitterId") ?? "").trim();
  const letterboxdId = String(formData.get("letterboxdId") ?? "").trim();
  const threadsId = String(formData.get("threadsId") ?? "").trim(); // [추가]

  // 1. 닉네임 유효성 검사
  if (nickname.length < 2 || nickname.length > 20) {
    return { success: false, message: "Nickname must be between 2 and 20 characters." };
  }
  if (/[^a-zA-Z0-9가-힣._-]/.test(nickname)) {
     return { success: false, message: "Nickname: Only letters, numbers, ., -, _ allowed." };
  }

  // 2. SNS ID 간단 검사 (공백이나 특수문자 등)
  const snsRegex = /[^a-zA-Z0-9._]/;
  if ((instagramId && snsRegex.test(instagramId)) || 
      (twitterId && snsRegex.test(twitterId)) || 
      (letterboxdId && snsRegex.test(letterboxdId)) ||
      (threadsId && snsRegex.test(threadsId))) {
    return { success: false, message: "SNS ID: 영문, 숫자, ., _ 만 가능합니다." };
  }

  try {
    // 닉네임 중복 체크
    const existing = await prisma.user.findUnique({ where: { nickname } });
    if (existing && existing.id !== session.user.id) {
      return { success: false, message: "Nickname already taken." };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        nickname,
        bio: bio || null,
        instagramId: instagramId || null,
        twitterId: twitterId || null,
        letterboxdId: letterboxdId || null,
        threadsId: threadsId || null, // [추가]
      },
    });

    revalidatePath("/my");
    revalidatePath("/settings");
    revalidatePath(`/users/${session.user.id}`);
    
    return { success: true };
  } catch (e: any) {
    return { success: false, message: "Server error occurred." };
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

// 3. 유저 검색 (차단 필터링 적용)
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
      AND: [
        { blockedBy: { none: { blockerId: myId } } },
        { blocking: { none: { blockedId: myId } } }
      ]
    },
    select: {
      id: true,
      nickname: true,
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
  revalidatePath(`/users/${targetId}`);
  return !existing;
}

// 5. 차단 토글
export async function toggleBlock(targetId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const myId = session.user.id;
  if (myId === targetId) throw new Error("Cannot block yourself");

  const existing = await prisma.block.findUnique({
    where: {
      blockerId_blockedId: { blockerId: myId, blockedId: targetId },
    },
  });

  if (existing) {
    await prisma.block.delete({
      where: { blockerId_blockedId: { blockerId: myId, blockedId: targetId } },
    });
    revalidatePath("/my");
    return false;
  } else {
    await prisma.$transaction([
      prisma.block.create({
        data: { blockerId: myId, blockedId: targetId },
      }),
      prisma.follows.deleteMany({
        where: { followerId: myId, followingId: targetId },
      }),
      prisma.follows.deleteMany({
        where: { followerId: targetId, followingId: myId },
      }),
    ]);
    revalidatePath("/my");
    revalidatePath(`/users/${targetId}`);
    return true;
  }
}

// 6. 차단 목록 가져오기
export async function getBlockedUsers() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const myId = session.user.id;

  const blocks = await prisma.block.findMany({
    where: {
      blockerId: myId,
    },
    include: {
      blocked: {
        select: {
          id: true,
          nickname: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return blocks.map((b) => ({
    id: b.blocked.id,
    nickname: b.blocked.nickname,
    isFollowing: false,
  }));
}