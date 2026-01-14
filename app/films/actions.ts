"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 좋아요 토글 (한줄평 전용)
export async function toggleLike(entryId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const myId = session.user.id;

  // 1. 엔트리 확인 (존재 여부 및 한줄평 유무 체크)
  const entry = await prisma.userEntry.findUnique({
    where: { id: entryId },
    select: { id: true, shortReview: true, userId: true },
  });

  if (!entry) throw new Error("Entry not found");
  
  // [옵션 2 적용] 한줄평이 없으면 좋아요 불가
  if (!entry.shortReview || entry.shortReview.trim() === "") {
    throw new Error("Cannot like an entry without a review");
  }

  // 2. 이미 좋아요 눌렀는지 확인
  const existing = await prisma.like.findUnique({
    where: {
      userId_userEntryId: { userId: myId, userEntryId: entryId },
    },
  });

  if (existing) {
    // 좋아요 취소 (삭제 + 카운트 감소)
    await prisma.$transaction([
      prisma.like.delete({
        where: { userId_userEntryId: { userId: myId, userEntryId: entryId } },
      }),
      prisma.userEntry.update({
        where: { id: entryId },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);
    
    return false; // 좋아요 취소됨
  } else {
    // 좋아요 추가 (생성 + 카운트 증가)
    await prisma.$transaction([
      prisma.like.create({
        data: { userId: myId, userEntryId: entryId },
      }),
      prisma.userEntry.update({
        where: { id: entryId },
        data: { likeCount: { increment: 1 } },
      }),
    ]);
    
    return true; // 좋아요 됨
  }
}