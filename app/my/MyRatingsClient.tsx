// app/my/MyRatingsClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import filmsData from "@/data/films.json";

type Vis = "private" | "friends" | "public";
type FilmData = any;

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
  const [loading, setLoading] = useState<boolean>(true);

  const mountedRef = useRef<boolean>(false);
  const inFlightRef = useRef<boolean>(false);
  const [bfRev, setBfRev] = useState(0);

  const filmMap = useMemo(() => {
    const map = new Map<string, FilmData>();
    filmsData.forEach((f) => map.set(f.id, f));
    return map;
  }, []);

  const fetchWithTimeout = async (
    input: RequestInfo,
    init: RequestInit = {},
    ms = 10000,
  ) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const resp = await fetch(input, { ...init, signal: controller.signal });
      return resp;
    } finally {
      clearTimeout(id);
    }
  };

  const load = async () => {
    if (!mountedRef.current) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setErr(null);
    setLoading(true);
    try {
      const r = await fetchWithTimeout("/api/user-entry/list", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      }, 10000);

      if (!mountedRef.current) return;
      if (!r || !r.ok) {
        setErr(`Load error: ${r?.status ?? "?"} ${r?.statusText ?? ""}`);
        setItems([]);
      } else {
        const j = (await r.json()) as Entry[];
        setItems(j);
      }
    } catch (e: any) {
      if (!mountedRef.current) return;
      setErr(e?.name === "AbortError" ? "Network timeout" : "Load error");
      setItems([]);
    } finally {
      if (mountedRef.current) setLoading(false);
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let t: number | null = null;
    const kick = (doRemount: boolean) => {
      if (!mountedRef.current) return;
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => {
        if (doRemount) setBfRev((x) => x + 1);
        load();
      }, 120);
    };
    const onPageShow = (e: PageTransitionEvent) => { if ((e as any).persisted) kick(true); };
    const onVisibility = () => { if (document.visibilityState === "visible") kick(false); };
    window.addEventListener("pageshow", onPageShow as any);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (t) window.clearTimeout(t);
      window.removeEventListener("pageshow", onPageShow as any);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (loading && !items) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (err) return <div className="text-sm text-red-600">{err}</div>;

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
        <p className="text-sm text-gray-500">No ratings yet.</p>
        <p className="text-xs text-gray-400 mt-1">Watch some films and rate them!</p>
      </div>
    );
  }

  return (
    <div key={bfRev} className="space-y-3">
      {items.map((e) => {
        const f = filmMap.get(e.filmId);
        
        // 제목: 한글 우선
        const titleKo = f?.title_ko;
        const titleEn = f?.title;
        const displayTitle = titleKo
          ? `${titleKo}${titleEn && titleKo !== titleEn ? ` (${titleEn})` : ""}`
          : (titleEn ?? e.filmId);

        const year = f?.year ? ` (${f.year})` : "";
        const fullTitle = `${displayTitle}${year}`;

        // 감독: 한글 우선
        const directors = f?.credits?.directors_ko?.length
          ? f.credits.directors_ko.join(", ")
          : (f.credits?.directors?.join(", ") ?? "");

        const d = new Date(e.updatedAt);
        const ymd = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;

        const badgeText = e.rating === null || e.rating === "" ? "-" : Number(e.rating).toFixed(1);
        
        return (
          <article
            key={e.id}
            // [수정] rounded-xl 적용하여 카드 모서리 통일
            className="group relative rounded-xl border p-4 transition-all duration-200 hover:shadow-md cursor-pointer"
            style={{
              // [수정] globals.css 변수 사용
              background: "var(--bg-rated)",
              borderColor: "var(--bd-rated)",
              color: "#FFFFFF",
            }}
            onClick={() => router.push(`/films/${e.filmId}`)}
          >
            <div className="flex flex-col gap-3">
              {/* 상단: 제목/감독 및 평점 배지 */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {/* 제목: 흰색, 굵게 */}
                  <h3 className="text-lg font-bold text-white truncate leading-tight">
                    {fullTitle}
                  </h3>
                  {/* 감독: 흰색(약간 투명) */}
                  {directors && (
                    <p className="text-xs text-white/80 mt-1 truncate">
                      {directors}
                    </p>
                  )}
                </div>

                {/* 평점 배지: [수정] rounded-xl 적용하여 둥근 사각형으로 변경 */}
                <div
                  className="shrink-0 rounded-xl min-w-[42px] h-[42px] flex items-center justify-center text-lg font-bold shadow-sm"
                  style={{
                    background: "var(--badge-rated-bg)",
                    color: "var(--badge-rated-fg)",
                  }}
                >
                  {badgeText}
                </div>
              </div>

              {/* 한줄평 (구분선 추가) */}
              {e.shortReview && (
                <div className="pt-3 border-t border-white/20">
                   <p className="text-[14px] text-white/95 leading-relaxed break-words whitespace-pre-wrap">
                     {e.shortReview}
                   </p>
                </div>
              )}

              {/* 하단 날짜 */}
              <div className="flex justify-end mt-auto pt-1">
                <p className="text-[11px] text-white/60">{ymd}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}