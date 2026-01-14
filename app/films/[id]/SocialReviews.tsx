// app/films/[id]/SocialReviews.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toggleLike } from "../actions";

type SocialReview = {
  id: string;
  userId: string;
  nickname: string;
  shortReview: string;
  rating: number | null; // [추가] 평점
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
    // 좋아요 로직은 한줄평이 있을 때만 가능하도록 서버에서 막아뒀으므로(이전 합의),
    // UI에서도 리뷰가 없으면 좋아요 버튼을 숨기거나 비활성화할 수도 있습니다.
    // 하지만 현재 서버 로직(toggleLike)은 '리뷰가 없으면 에러'를 뱉으므로,
    // 여기서 리뷰가 빈 문자열이면 클릭을 막습니다.
    
    const target = reviews.find(r => r.id === entryId);
    if (!target || !target.shortReview) return; // 리뷰 없으면 좋아요 불가

    if (pendingIds.has(entryId)) return;

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
      await toggleLike(entryId);
      router.refresh();
    } catch (error) {
      console.error(error);
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
    return null;
  }

  return (
    <section className="mt-8 border-t pt-6">
      <h3 className="text-base font-bold mb-4">Reviews</h3>
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="flex items-start justify-between gap-3 group">
            {/* 왼쪽: 닉네임 + 평점 + 내용 */}
            <div className="flex-1 text-[13px] leading-relaxed break-words whitespace-pre-wrap">
              <div className="flex items-center gap-2 mb-0.5">
                {/* 닉네임 */}
                <Link 
                  href={`/users/${review.userId}`}
                  className="font-bold text-gray-900 hover:underline hover:text-blue-600 transition-colors"
                >
                  {review.nickname}
                </Link>

                {/* [추가] 평점 배지 (평점이 있을 때만) */}
                {review.rating !== null && (
                  <span className="inline-flex items-center justify-center bg-gray-900 text-white text-[10px] font-bold px-1.5 h-4 rounded-md">
                    {review.rating.toFixed(1)}
                  </span>
                )}
              </div>

              {/* 한줄평 (있을 때만) */}
              {review.shortReview && (
                <span className="text-gray-700 font-normal block mt-0.5">
                  {review.shortReview}
                </span>
              )}
            </div>

            {/* 오른쪽: 하트 버튼 (리뷰가 있을 때만 노출) */}
            {review.shortReview ? (
              <button
                onClick={() => handleLike(review.id)}
                disabled={pendingIds.has(review.id)}
                className="shrink-0 flex flex-col items-center gap-0.5 min-w-[24px] cursor-pointer hover:opacity-70 transition-opacity pt-1"
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
            ) : (
              // 리뷰가 없으면 빈 공간 차지 (레이아웃 유지용) 혹은 아예 렌더링 안 함
              <div className="min-w-[24px]" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}