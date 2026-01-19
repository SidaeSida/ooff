"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import filmsData from "@/data/films.json";
import { getFeed } from "./actions";
import { toggleLike } from "@/app/films/actions";

type FeedCursor = {
  updatedAt: string;
  id: string;
};

type FeedItem = {
  id: string; // entryId
  filmId: string;
  user: {
    id: string;
    nickname: string;
  };
  rating: number | null;
  shortReview: string | null;
  likeCount: number;
  isLiked: boolean;
  updatedAt: string;
  myRating?: number | null; // 나의 평가 정보
};

export default function FeedTab() {
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const filmMap = useMemo(() => {
    const map = new Map<string, any>();
    (filmsData as any[]).forEach((f) => map.set(f.id, f));
    return map;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const initialData = await getFeed();
        if (mounted) {
          setItems(initialData);
          if (initialData.length < 20) setHasMore(false);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || items.length === 0) return;

    setLoadingMore(true);
    const lastItem = items[items.length - 1];
    const cursor: FeedCursor = { updatedAt: lastItem.updatedAt, id: lastItem.id };

    try {
      const nextData = await getFeed(cursor);
      if (nextData.length === 0) {
        setHasMore(false);
      } else {
        setItems((prev) => [...prev, ...nextData]);
        if (nextData.length < 20) setHasMore(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, items]);

  useEffect(() => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { rootMargin: "300px 0px" }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [loading, hasMore, loadMore]);

  const handleLike = async (entryId: string, hasReview: boolean) => {
    if (!hasReview) return;
    if (pendingIds.has(entryId)) return;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== entryId) return item;
        const nextLiked = !item.isLiked;
        return {
          ...item,
          isLiked: nextLiked,
          likeCount: nextLiked ? item.likeCount + 1 : item.likeCount - 1,
        };
      })
    );

    setPendingIds((prev) => new Set(prev).add(entryId));

    try {
      await toggleLike(entryId);
      router.refresh();
    } catch (e) {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== entryId) return item;
          const nextLiked = !item.isLiked;
          return {
            ...item,
            isLiked: nextLiked,
            likeCount: nextLiked ? item.likeCount + 1 : item.likeCount - 1,
          };
        })
      );
      alert("Failed to like.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${d.getMonth() + 1}.${d.getDate()}`;
  };

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-50 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
        <p className="text-sm text-gray-500 font-medium">Your feed is empty.</p>
        <p className="text-xs text-gray-400 mt-2 mb-6">Follow friends to see their activities.</p>
        <Link
          href="/my?tab=friends"
          className="px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-black transition-colors"
          style={{ color: '#ffffff' }}
        >
          Find Friends
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {items.map((item) => {
        const film = filmMap.get(item.filmId);
        const title = film?.title_ko || film?.title || item.filmId;
        const year = film?.year ? `(${film.year})` : "";
        const hasReview = !!(item.shortReview && item.shortReview.trim().length > 0);

        // [내 평가 여부 확인]
        const isRated = item.myRating !== null && item.myRating !== undefined;
        
        // [스타일 변수: FilmListCard와 동일하게 맞춤]
        // Unrated일 때도 var(--bg-unrated)를 사용하여 필름 카드와 일관성 유지
        const bg = isRated ? 'var(--bg-rated)' : 'var(--bg-unrated)';
        const bd = isRated ? 'var(--bd-rated)' : 'var(--bd-unrated)';

        // 텍스트 색상
        const titleClass = isRated ? "text-white" : "text-gray-900";
        const metaClass = isRated ? "text-white/80" : "text-gray-500";
        const reviewClass = isRated ? "text-white/95" : "text-gray-700";
        const badgeClass = isRated ? "bg-white text-black" : "bg-gray-900 text-white";
        const likeColor = isRated 
          ? (item.isLiked ? "text-red-400 hover:text-red-300" : "text-white/60 hover:text-white")
          : (item.isLiked ? "text-red-500" : "text-gray-500 hover:text-red-500");
        const likeIconColor = item.isLiked 
          ? (isRated ? "text-red-400" : "text-red-500") 
          : (isRated ? "text-white/60" : "text-gray-300");

        return (
          <article
            key={item.id}
            className="rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500 transition-colors"
            style={{ background: bg, border: `1px solid ${bd}` }}
          >
            {/* Header: User & Date */}
            <div className="flex items-center justify-between mb-3">
              <Link href={`/users/${item.user.id}`} className={`font-bold text-sm hover:underline ${titleClass}`}>
                {item.user.nickname}
              </Link>
              <span className={`text-xs font-medium ${metaClass}`}>{formatDate(item.updatedAt)}</span>
            </div>

            {/* Content: Poster + Info */}
            <div className="flex gap-4">
              {/* Poster (Left) */}
              {/* [수정] aspect-[2/3], object-cover 적용 및 테두리 제거 */}
              <Link href={`/films/${item.filmId}`} className="shrink-0 w-[60px] block">
                {film?.posters && film.posters.length > 0 ? (
                  <img
                    src={`/${film.posters[0]}`}
                    alt={title}
                    className="w-full h-auto rounded-md shadow-sm object-cover aspect-[2/3]"
                    loading="lazy"
                  />
                ) : (
                  <div className={`w-full aspect-[2/3] rounded-md border flex items-center justify-center text-[9px] ${isRated ? 'bg-white/10 border-white/20 text-white/50' : 'bg-gray-100 border-gray-100 text-gray-400'}`}>
                    No Img
                  </div>
                )}
              </Link>

              {/* Text Info (Right) */}
              <div className="flex-1 min-w-0 pt-0.5">
                <Link href={`/films/${item.filmId}`} className="block mb-1">
                  <h3 className={`text-sm font-bold truncate leading-tight ${titleClass}`}>
                    {title} <span className={`font-normal text-xs ml-0.5 ${metaClass}`}>{year}</span>
                  </h3>
                </Link>

                {item.rating !== null && (
                  <div className="mb-2">
                    <span className={`inline-flex items-center justify-center text-[11px] font-bold px-1.5 h-5 rounded-md tabular-nums ${badgeClass}`}>
                      {item.rating.toFixed(1)}
                    </span>
                  </div>
                )}

                {item.shortReview && item.shortReview.trim().length > 0 && (
                  <p className={`text-[13px] leading-relaxed break-words whitespace-pre-wrap ${reviewClass}`}>
                    {item.shortReview}
                  </p>
                )}
              </div>
            </div>

            {/* Like Button (Review가 있을 때만) */}
            {hasReview && (
              <div className={`mt-3 pt-3 border-t flex justify-end ${isRated ? 'border-white/20' : 'border-gray-50'}`}>
                <button
                  onClick={() => handleLike(item.id, true)}
                  disabled={pendingIds.has(item.id)}
                  aria-pressed={item.isLiked}
                  aria-label={item.isLiked ? "Unlike" : "Like"}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${likeColor}`}
                >
                  <span className={`text-base ${likeIconColor}`}>
                    {item.isLiked ? "♥" : "♡"}
                  </span>
                  {item.likeCount > 0 && <span className="tabular-nums">{item.likeCount}</span>}
                </button>
              </div>
            )}
          </article>
        );
      })}

      {/* Infinite Scroll Trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="py-6 flex justify-center">
          {loadingMore && (
            <div className={`w-5 h-5 border-2 rounded-full animate-spin ${items[0]?.myRating ? 'border-gray-400 border-t-gray-800' : 'border-gray-200 border-t-gray-900'}`} />
          )}
        </div>
      )}
    </div>
  );
}