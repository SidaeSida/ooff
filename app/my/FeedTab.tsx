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
      // rollback
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
          // [수정] 텍스트 색상 강제 지정 (Global CSS 오버라이드 방지)
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

        return (
          <article
            key={item.id}
            className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <Link href={`/users/${item.user.id}`} className="font-bold text-sm text-gray-900 hover:underline">
                {item.user.nickname}
              </Link>
              <span className="text-xs text-gray-400 font-medium">{formatDate(item.updatedAt)}</span>
            </div>

            {/* Content: Poster + Info */}
            <div className="flex gap-4">
              {/* Poster */}
              <Link href={`/films/${item.filmId}`} className="shrink-0 w-[60px] block">
                {film?.posters && film.posters.length > 0 ? (
                  <img
                    src={`/${film.posters[0]}`}
                    alt={title}
                    className="block w-full h-auto rounded-md border border-gray-100"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-[60px] py-6 bg-gray-100 rounded-md border border-gray-100 flex items-center justify-center text-[8px] text-gray-400">
                    No Img
                  </div>
                )}
              </Link>

              {/* Text */}
              <div className="flex-1 min-w-0 pt-0.5">
                <Link href={`/films/${item.filmId}`} className="block mb-1">
                  <h3 className="text-sm font-bold text-gray-900 truncate leading-tight">
                    {title} <span className="text-gray-500 font-normal text-xs ml-0.5">{year}</span>
                  </h3>
                </Link>

                {item.rating !== null && (
                  <div className="mb-2">
                    <span className="inline-flex items-center justify-center bg-gray-900 text-white text-[11px] font-bold px-1.5 h-5 rounded-md tabular-nums">
                      {item.rating.toFixed(1)}
                    </span>
                  </div>
                )}

                {item.shortReview && item.shortReview.trim().length > 0 && (
                  <p className="text-[13px] text-gray-700 leading-relaxed break-words whitespace-pre-wrap">
                    {item.shortReview}
                  </p>
                )}
              </div>
            </div>

            {/* Like (review 있을 때만) */}
            {hasReview && (
              <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end">
                <button
                  onClick={() => handleLike(item.id, true)}
                  disabled={pendingIds.has(item.id)}
                  aria-pressed={item.isLiked}
                  aria-label={item.isLiked ? "Unlike" : "Like"}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-500"
                >
                  <span className={`text-base ${item.isLiked ? "text-red-500" : "text-gray-300"}`}>
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
            <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
          )}
        </div>
      )}
    </div>
  );
}