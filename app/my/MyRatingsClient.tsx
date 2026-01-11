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
    filmsData.forEach((f: any) => map.set(f.id, f));
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
      const r = await fetchWithTimeout(
        "/api/user-entry/list",
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        },
        10000
      );

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
    return () => {
      mountedRef.current = false;
    };
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
    const onPageShow = (e: PageTransitionEvent) => {
      if ((e as any).persisted) kick(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") kick(false);
    };
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

  // FilmListCard 톤(평가된 카드) 기준 변수
  const bg = "var(--bg-rated)";
  const bd = "var(--bd-rated)";
  const hover = "var(--bg-hover-r)";

  return (
    <ul key={bfRev} className="space-y-3">
      {items.map((e) => {
        const f = filmMap.get(e.filmId);

        // 제목: 한글 우선 (영어 제목 괄호 표기 제거)
        const titleKo = f?.title_ko;
        const titleEn = f?.title;

        const displayTitle = titleKo ? titleKo : (titleEn ?? e.filmId);

        const year = f?.year ? ` (${f.year})` : "";
        const fullTitle = `${displayTitle}${year}`;


        // 감독: 한글 우선
        const directors = f?.credits?.directors_ko?.length
          ? f.credits.directors_ko.join(", ")
          : (f?.credits?.directors?.join(", ") ?? "");

        const d = new Date(e.updatedAt);
        const ymd = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;

        const badgeText =
          e.rating === null || e.rating === "" ? "-" : Number(e.rating).toFixed(1);

        return (
          <li
            key={e.id}
            className="border rounded-lg p-4 transition cursor-pointer"
            style={{ background: bg, borderColor: bd }}
            onMouseEnter={(ev) => {
              (ev.currentTarget as HTMLLIElement).style.background = hover;
            }}
            onMouseLeave={(ev) => {
              (ev.currentTarget as HTMLLIElement).style.background = bg;
            }}
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/films/${e.filmId}`)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") router.push(`/films/${e.filmId}`);
            }}
          >
            {/* 상단: 제목/감독 + 평점 원형 배지 */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[1.0rem] leading-snug text-white truncate">
                  {fullTitle}
                </div>

                {directors && (
                  <div className="text-[0.875rem] text-white/90 mt-1 truncate">
                    {directors}
                  </div>
                )}
              </div>

              {/* 평점 배지: 완전 원형 */}
              <div
                className="shrink-0 w-12 h-12 rounded-[20px] grid place-items-center text-[1.05rem] font-semibold select-none"
                style={{
                  background: "var(--badge-rated-bg)",
                  color: "var(--badge-rated-fg)",
                }}
                aria-label={`Rating ${badgeText}`}
              >
                {badgeText}
              </div>

            </div>

            {/* 한줄평 */}
            {e.shortReview && (
              <div className="mt-3 pt-3 border-t border-white/20">
                <p className="text-[14px] text-white/95 leading-relaxed break-words whitespace-pre-wrap">
                  {e.shortReview}
                </p>
              </div>
            )}

            {/* 하단 날짜: Updated : 추가 */}
            <div className="mt-3 flex justify-end">
              <p className="text-[11px] text-white/60">Updated : {ymd}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
