// app/my/MyRatingsClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import filmsData from "@/data/films.json";

type Vis = "private" | "friends" | "public";
type Film = {
  id: string;
  title: string;
  year?: number;
  credits?: { directors?: string[] };
};

type Entry = {
  id: string;
  filmId: string;
  rating: string | number | null;
  shortReview: string | null;
  visibility: Vis;
  updatedAt: string;
};

export default function MyRatingsClient() {
  const router = useRouter();
  const [items, setItems] = useState<Entry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 영화 메타 조회(제목/감독/연도)
  const filmMap = useMemo(() => {
    const map = new Map<string, Film>();
    (filmsData as Film[]).forEach((f) => map.set(f.id, f));
    return map;
  }, []);

  const load = async () => {
    setErr(null);
    const r = await fetch("/api/user-entry/list", { cache: "no-store" });
    if (!r.ok) {
      setErr(`Load error: ${r.statusText}`);
      return;
    }
    const j = await r.json();
    setItems(j as Entry[]);
  };

  useEffect(() => {
    load();
  }, []);

  const onDelete = async (filmId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭(네비게이션) 방지
    if (!confirm("Delete this rating and review?")) return;
    const resp = await fetch(`/api/user-entry?filmId=${encodeURIComponent(filmId)}`, {
      method: "DELETE",
      cache: "no-store",
      credentials: "same-origin",
    });
    if (resp.ok || resp.status === 204) {
      setItems((prev) => (prev ? prev.filter((x) => x.filmId !== filmId) : prev));
    } else {
      const msg = await resp.text();
      alert(`Delete failed: ${msg || resp.status}`);
    }
  };

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!items) {
    return (
      <div className="space-y-2">
        <div className="h-16 rounded-lg bg-gray-100 animate-pulse" />
        <div className="h-16 rounded-lg bg-gray-100 animate-pulse" />
      </div>
    );
  }
  if (items.length === 0) return <p className="text-sm text-gray-600">No ratings yet.</p>;

  return (
    <div className="space-y-3">
      {items.map((e) => {
        const f = filmMap.get(e.filmId);
        const title = f ? `${f.title}${f.year ? ` (${f.year})` : ""}` : e.filmId;
        const directors = f?.credits?.directors?.length ? f.credits.directors.join(", ") : undefined;

        const d = new Date(e.updatedAt);
        const ymd = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;

        // 배지용 숫자 표시: null/"" 이면 "-"
        const badge =
          e.rating === null || e.rating === "" ? "-" : Number(e.rating).toFixed(1);

        return (
          <article
            key={e.id}
            className="rounded-xl border px-3 py-2 cursor-pointer hover:bg-gray-50 transition"
            onClick={() => router.push(`/films/${e.filmId}`)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold truncate">{title}</h3>
                {directors && (
                  <p className="text-xs text-gray-600 truncate mt-0.5">{directors}</p>
                )}
              </div>
              {/* 점수 뱃지 */}
              <div className="shrink-0 rounded-full border px-2 py-0.5 text-xs">
                {badge}
              </div>
            </div>

            {e.shortReview && (
              <p className="text-sm mt-1 break-words">{e.shortReview}</p>
            )}

            <div className="mt-1 flex items-center justify-between">
              <p className="text-[11px] text-gray-500">Updated {ymd}</p>
              <button
                className="text-xs rounded-md border px-2 py-0.5 hover:bg-gray-100"
                onClick={(evt) => onDelete(e.filmId, evt)}
              >
                Delete
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
