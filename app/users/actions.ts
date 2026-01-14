// app/users/actions.ts
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 1. 특정 유저의 공개 정보 조회
export async function getUserProfile(userId: string) {
  const session = await auth();
  const myId = session?.user?.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nickname: true,
      bio: true,
      instagramId: true,
      twitterId: true,
      letterboxdId: true,
      threadsId: true, // [추가]
      
      _count: {
        select: {
          followedBy: true,
          following: true,
        },
      },
      followedBy: myId ? {
        where: { followerId: myId },
        select: { followerId: true }
      } : undefined,
    },
  });

  if (!user) return null;

  return {
    ...user,
    isFollowing: user.followedBy ? user.followedBy.length > 0 : false,
  };
}

// 2. 평점 기록 조회
export async function getUserRatings(userId: string) {
  const entries = await prisma.userEntry.findMany({
    where: { 
      userId,
      rating: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return entries.map(entry => ({
    ...entry,
    rating: entry.rating ? Number(entry.rating) : null,
  }));
}

// 3. 팔로워/팔로잉 명단 조회
export async function getFollowList(userId: string, type: "followers" | "following") {
  const session = await auth();
  const myId = session?.user?.id;

  if (type === "followers") {
    const list = await prisma.follows.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: { id: true, nickname: true } 
        }
      }
    });
    
    return Promise.all(list.map(async (item) => {
      const isFollowing = myId ? (await prisma.follows.findUnique({
        where: { followerId_followingId: { followerId: myId, followingId: item.followerId } }
      })) !== null : false;
      
      return {
        id: item.follower.id,
        nickname: item.follower.nickname,
        isFollowing,
        isMe: item.follower.id === myId
      };
    }));
  } else {
    const list = await prisma.follows.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: { id: true, nickname: true }
        }
      }
    });
    
    return Promise.all(list.map(async (item) => {
      const isFollowing = myId ? (await prisma.follows.findUnique({
        where: { followerId_followingId: { followerId: myId, followingId: item.followingId } }
      })) !== null : false;

      return {
        id: item.following.id,
        nickname: item.following.nickname,
        isFollowing,
        isMe: item.following.id === myId
      };
    }));
  }
}