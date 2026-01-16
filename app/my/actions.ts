"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type ActionState = {
  success: boolean;
  message?: string;
};

type FeedCursor = {
  updatedAt: string;
  id: string;
};

// 1. 프로필 업데이트
export async function updateProfile(formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "Unauthorized" };

  const nickname = String(formData.get("nickname") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const letterboxdId = String(formData.get("letterboxdId") ?? "").trim();

  // 1. 닉네임 유효성 검사
  if (nickname.length < 2 || nickname.length > 20) {
    return { success: false, message: "Nickname must be between 2 and 20 characters." };
  }
  if (/[^a-zA-Z0-9가-힣._-]/.test(nickname)) {
    return { success: false, message: "Nickname: Only letters, numbers, ., -, _ allowed." };
  }

  // 2. SNS ID 간단 검사 (Letterboxd)
  const snsRegex = /[^a-zA-Z0-9._]/;
  if (letterboxdId && snsRegex.test(letterboxdId)) {
    return { success: false, message: "Letterboxd ID: 영문, 숫자, ., _ 만 가능합니다." };
  }

  try {
    // 닉네임 중복 체크 (저장 직전 최종 확인)
    const existing = await prisma.user.findUnique({ where: { nickname } });
    if (existing && existing.id !== session.user.id) {
      return { success: false, message: "Nickname already taken." };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        nickname,
        bio: bio || null,
        letterboxdId: letterboxdId || null,
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

// 3. 유저 검색
export async function searchUsers(query: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const myId = session.user.id;
  if (!query || query.trim().length < 1) return [];

  const users = await prisma.user.findMany({
    where: {
      nickname: { contains: query, mode: "insensitive" },
      id: { not: myId },
      AND: [
        { blockedBy: { none: { blockerId: myId } } },
        { blocking: { none: { blockedId: myId } } },
      ],
    },
    select: {
      id: true,
      nickname: true,
      followedBy: {
        where: { followerId: myId },
        select: { followerId: true },
      },
      // [수정] 검색 시에도 평점 개수 표시를 위해 카운트 포함
      _count: {
        select: {
          UserEntry: { where: { rating: { not: null } } }
        }
      }
    },
    take: 10,
  });

  return users.map((u) => ({
    id: u.id,
    nickname: u.nickname,
    isFollowing: u.followedBy.length > 0,
    ratingCount: u._count.UserEntry, // 평점 개수 반환
  }));
}

// 4. 팔로우 토글
export async function toggleFollow(targetId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const myId = session.user.id;
  if (myId === targetId) throw new Error("Cannot follow yourself");

  const existing = await prisma.follows.findUnique({
    where: { followerId_followingId: { followerId: myId, followingId: targetId } },
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
    where: { blockerId_blockedId: { blockerId: myId, blockedId: targetId } },
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
    where: { blockerId: myId },
    include: {
      blocked: { select: { id: true, nickname: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return blocks.map((b) => ({
    id: b.blocked.id,
    nickname: b.blocked.nickname,
    isFollowing: false,
    ratingCount: 0, // 차단 목록엔 표시 안 함
  }));
}

// 7. 피드 데이터 가져오기
export async function getFeed(cursor?: FeedCursor) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const myId = session.user.id;
  const limit = 20;

  const following = await prisma.follows.findMany({
    where: { followerId: myId },
    select: { followingId: true },
  });
  const followingIds = following.map((f) => f.followingId);
  if (followingIds.length === 0) return [];

  const reverse = await prisma.follows.findMany({
    where: {
      followerId: { in: followingIds },
      followingId: myId,
    },
    select: { followerId: true },
  });
  const mutualSet = new Set(reverse.map((r) => r.followerId));

  const cursorAt = cursor?.updatedAt ? new Date(cursor.updatedAt) : null;
  const cursorId = cursor?.id ?? null;

  const rawEntries = await prisma.userEntry.findMany({
    where: {
      userId: { in: followingIds },
      OR: [
        { rating: { not: null } },
        {
          AND: [
            { shortReview: { not: null } },
            { shortReview: { not: "" } },
          ],
        },
      ],
      user: {
        blockedBy: { none: { blockerId: myId } },
        blocking: { none: { blockedId: myId } },
      },
      ...(cursorAt && cursorId
        ? {
            OR: [
              { updatedAt: { lt: cursorAt } },
              { AND: [{ updatedAt: cursorAt }, { id: { lt: cursorId } }] },
            ],
          }
        : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          UserPrivacy: true,
        },
      },
      likes: {
        where: { userId: myId },
        select: { userId: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit,
  });

  const feedItems = rawEntries
    .map((entry) => {
      const privacy: any = entry.user.UserPrivacy;
      const isMutual = mutualSet.has(entry.user.id);

      let visibleRating = entry.rating !== null ? Number(entry.rating) : null;
      const ratingVis = privacy?.ratingVisibility as string | undefined;
      if (ratingVis === "private") visibleRating = null;
      if (ratingVis === "friends" && !isMutual) visibleRating = null;

      let visibleReview: string | null = entry.shortReview ?? null;
      const reviewVis = privacy?.reviewVisibility as string | undefined;
      if (reviewVis === "private") visibleReview = null;
      if (reviewVis === "friends" && !isMutual) visibleReview = null;

      if (visibleReview && visibleReview.trim() === "") visibleReview = null;

      if (visibleRating === null && visibleReview === null) return null;

      return {
        id: entry.id,
        filmId: entry.filmId,
        user: {
          id: entry.user.id,
          nickname: entry.user.nickname || "User",
        },
        rating: visibleRating,
        shortReview: visibleReview,
        likeCount: entry.likeCount,
        isLiked: entry.likes.length > 0,
        updatedAt: entry.updatedAt.toISOString(),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return feedItems;
}

// 8. 닉네임 중복 확인
export async function checkNickname(nickname: string) {
  const session = await auth();
  if (!session?.user?.id) return { available: false, message: "Unauthorized" };

  const cleanNickname = nickname.trim();

  if (cleanNickname.length < 2 || cleanNickname.length > 20) {
    return { available: false, message: "2-20 characters required." };
  }
  if (/[^a-zA-Z0-9가-힣._-]/.test(cleanNickname)) {
    return { available: false, message: "Invalid characters." };
  }

  const existing = await prisma.user.findUnique({
    where: { nickname: cleanNickname },
  });

  if (existing && existing.id !== session.user.id) {
    return { available: false, message: "Username already taken." };
  }

  return { available: true, message: "Available." };
}

// 9. [신규] 전체 유저 추천 목록 (리뷰 많은 순)
export async function getTopUsers() {
  const session = await auth();
  const myId = session?.user?.id;

  const users = await prisma.user.findMany({
    take: 20,
    orderBy: {
      UserEntry: {
        _count: 'desc'
      }
    },
    where: {
        AND: [
            { id: { not: myId } }, // 나 제외
            // 나를 차단했거나 내가 차단한 유저 제외 (로그인 시)
            ...(myId ? [{ blockedBy: { none: { blockerId: myId } } }, { blocking: { none: { blockedId: myId } } }] : [])
        ]
    },
    select: {
      id: true,
      nickname: true,
      _count: {
        select: {
          // 실제 rating이 있는 개수만 카운트
          UserEntry: { where: { rating: { not: null } } }
        }
      },
      followedBy: myId ? {
        where: { followerId: myId },
        select: { followerId: true }
      } : undefined
    }
  });

  return users.map((u) => ({
    id: u.id,
    nickname: u.nickname,
    ratingCount: u._count.UserEntry,
    isFollowing: u.followedBy ? u.followedBy.length > 0 : false
  }));
}