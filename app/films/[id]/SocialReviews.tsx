// app/films/[id]/SocialReviews.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleLike } from "../actions"; // Step 3에서 만든 액션

type SocialReview = {
  id: string; // entryId
  userId: string;
  nickname: string;
  shortReview: string;
  likeCount: number;
  isLiked: boolean;
};

export default function SocialReviews({
  initialReviews,
}: {
  initialReviews: SocialReview[];
}) {
  const router = useRouter();
  const [reviews, setReviews] = useState<SocialReview[]>(initialReviews);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const handleLike = async (entryId: string) => {
    // 1. Pending 체크
    if (pendingIds.has(entryId)) return;

    // 2. Optimistic Update (즉시 UI 반영)
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id !== entryId) return r;
        const nextLiked = !r.isLiked;
        return {
          ...r,
          isLiked: nextLiked,
          likeCount: nextLiked ? r.likeCount + 1 : r.likeCount - 1,
        };
      })
    );
    setPendingIds((prev) => new Set(prev).add(entryId));

    try {
      // 3. Server Action 호출
      await toggleLike(entryId);
      router.refresh(); // 데이터 동기화
    } catch (error) {
      // 실패 시 롤백 (생략 가능하지만 안전을 위해)
      console.error(error);
      setReviews((prev) =>
        prev.map((r) => {
          if (r.id !== entryId) return r;
          const nextLiked = !r.isLiked; // 원래대로 복구
          return {
            ...r,
            isLiked: nextLiked,
            likeCount: nextLiked ? r.likeCount + 1 : r.likeCount - 1,
          };
        })
      );
      alert("Failed to like review.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
    }
  };

  if (reviews.length === 0) {
    return null; // 리뷰가 없으면 아예 안 그림
  }

  return (
    <section className="mt-8 border-t pt-6">
      <h3 className="text-base font-bold mb-4">Reviews</h3>
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="flex items-start justify-between gap-3 group">
            {/* 왼쪽: 닉네임 + 내용 */}
            <div className="flex-1 text-[13px] leading-relaxed break-words whitespace-pre-wrap">
              <span className="font-bold mr-2 text-gray-900">
                {review.nickname}
              </span>
              <span className="text-gray-700 font-normal">
                {review.shortReview}
              </span>
            </div>

            {/* 오른쪽: 하트 버튼 + 숫자 */}
            <button
              onClick={() => handleLike(review.id)}
              disabled={pendingIds.has(review.id)}
              className="shrink-0 flex flex-col items-center gap-0.5 min-w-[24px] cursor-pointer hover:opacity-70 transition-opacity"
            >
              <span
                className={`text-[16px] leading-none transition-colors ${
                  review.isLiked ? "text-red-500" : "text-gray-300"
                }`}
              >
                {review.isLiked ? "♥" : "♡"}
              </span>
              {review.likeCount > 0 && (
                <span className="text-[10px] text-gray-400 font-medium tabular-nums">
                  {review.likeCount}
                </span>
              )}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}