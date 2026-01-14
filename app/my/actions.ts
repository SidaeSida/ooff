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
      id: { not: myId }, // 나 자신 제외
      
      // [추가] 차단 로직: 서로 차단한 관계는 검색되지 않음
      AND: [
        // 1. 내가 차단한 사람 제외 (Target의 blockedBy 목록에 내가 없어야 함)
        {
          blockedBy: {
            none: { blockerId: myId }
          }
        },
        // 2. 나를 차단한 사람 제외 (Target의 blocking 목록에 내가 없어야 함)
        {
          blocking: {
            none: { blockedId: myId }
          }
        }
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
  revalidatePath(`/users/${targetId}`); // 상대방 페이지 갱신
  return !existing;
}

// 5. [신규] 차단 토글
export async function toggleBlock(targetId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const myId = session.user.id;
  if (myId === targetId) throw new Error("Cannot block yourself");

  // 이미 차단했는지 확인
  const existing = await prisma.block.findUnique({
    where: {
      blockerId_blockedId: { blockerId: myId, blockedId: targetId },
    },
  });

  if (existing) {
    // 차단 해제
    await prisma.block.delete({
      where: { blockerId_blockedId: { blockerId: myId, blockedId: targetId } },
    });
    
    // 차단 해제 시엔 별도 팔로우 복구 없음 (처음부터 다시 팔로우해야 함)
    revalidatePath("/my");
    return false; // 차단 풀림
  } else {
    // 차단 실행 (트랜잭션: 차단 생성 + 맞팔로우 관계 삭제)
    await prisma.$transaction([
      // 1. 차단 데이터 생성
      prisma.block.create({
        data: { blockerId: myId, blockedId: targetId },
      }),
      // 2. 내가 걔를 팔로우 중이면 삭제
      prisma.follows.deleteMany({
        where: { followerId: myId, followingId: targetId },
      }),
      // 3. 걔가 나를 팔로우 중이면 삭제
      prisma.follows.deleteMany({
        where: { followerId: targetId, followingId: myId },
      }),
    ]);
    
    revalidatePath("/my");
    revalidatePath(`/users/${targetId}`);
    return true; // 차단됨
  }
}