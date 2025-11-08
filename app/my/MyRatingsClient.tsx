"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [loading, setLoading] = useState<boolean>(true);

  // 가드
  const mountedRef = useRef<boolean>(false);
  const inFlightRef = useRef<boolean>(false);

  // BFCache 복귀 시 리마운트 키
  const [bfRev, setBfRev] = useState(0);

  // 영화 메타
  const filmMap = useMemo(() => {
    const map = new Map<string, Film>();
    (filmsData as Film[]).forEach((f) => map.set(f.id, f));
    return map;
  }, []);

  const fetchWithTimeout = async (input: RequestInfo, init: RequestInit = {}, ms = 10000) => {
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
        headers: { "Accept": "application/json" },
      }, 10000);
      if (!mountedRef.current) return;
      if (!r.ok) {
        setErr(`Load error: ${r.status} ${r.statusText}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // BFCache 복귀/가시성 복귀
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 렌더
  if (loading && !items) {
    return (
      <div className="space-y-2">
        <div className="h-16 rounded-lg bg-gray-100 animate-pulse" />
        <div className="h-16 rounded-lg bg-gray-100 animate-pulse" />
      </div>
    );
  }
  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!items || items.length === 0) return <p className="text-sm text-gray-600">No ratings yet.</p>;

  return (
    <div key={bfRev} className="space-y-3">
      {items.map((e) => {
        const f = filmMap.get(e.filmId);
        const title = f ? `${f.title}${f.year ? ` (${f.year})` : ""}` : e.filmId;
        const directors = f?.credits?.directors?.length ? f.credits.directors.join(", ") : undefined;

        const d = new Date(e.updatedAt);
        const ymd = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;

        const badgeText = e.rating === null || e.rating === "" ? "-" : Number(e.rating).toFixed(1);

        return (
          <article
            key={e.id}
            className="rounded-xl border px-3 py-2 transition-colors duration-300 ease-out"
            style={{ background: "var(--bg-rated)", borderColor: "var(--bd-rated)", color: "#FFFFFF" }}
          >
            {/* 본문 클릭으로 상세 이동 */}
            <div className="cursor-pointer" onClick={() => router.push(`/films/${e.filmId}`)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold truncate text-white">{title}</h3>
                  {directors && <p className="text-xs truncate mt-0.5 text-white/80">{directors}</p>}
                </div>

                {/* ★ 배지 확대: 패딩/폰트 상향, 고정 높이로 원형에 가깝게 */}
                <div
                  className="shrink-0 rounded-full min-w-10 h-10 px-3.5 flex items-center justify-center text-lg font-bold"
                  style={{ background: "var(--badge-rated-bg)", color: "var(--badge-rated-fg)", border: "none" }}
                >
                  {badgeText}
                </div>
              </div>

              {e.shortReview && (
                <div
                  className="mt-1 text-sm text-white/90 leading-[1.5] overflow-auto"
                  style={{ whiteSpace: "pre-line", maxHeight: "12em" }}
                >
                  {e.shortReview}
                </div>
              )}
            </div>

            {/* 푸터(업데이트 일시만 표기) */}
            <div className="mt-1 flex items-center justify-between">
              <p className="text-[11px] text-white/70">Updated {ymd}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
