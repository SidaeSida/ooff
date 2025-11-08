// app/my/MyRatingsClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import filmsData from "@/data/films.json";
import { deleteUserEntry } from "./actions";

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

  // ★ BFCache 복귀 시 리마운트 트리거용 키
  const [bfRev, setBfRev] = useState(0);


  // 영화 메타(제목/감독/연도)
  const filmMap = useMemo(() => {
    const map = new Map<string, Film>();
    (filmsData as Film[]).forEach((f) => map.set(f.id, f));
    return map;
  }, []);

  // fetch 타임아웃 도우미
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
    if (inFlightRef.current) return; // 중복 방지

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
        setItems([]);           // 에러에도 스켈레톤 탈출
      } else {
        const j = (await r.json()) as Entry[];
        setItems(j);
      }
    } catch (e: any) {
      if (!mountedRef.current) return;
      setErr(e?.name === "AbortError" ? "Network timeout" : "Load error");
      setItems([]);             // 타임아웃 등에도 스켈레톤 탈출
    } finally {
      if (mountedRef.current) setLoading(false);
      inFlightRef.current = false;
    }
  };

  // 최초 마운트/언마운트 가드 + 첫 로드
  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 뒤로가기(BFCache)/탭 복귀 시 재조회 + ★리마운트 키 증가
useEffect(() => {
  let t: number | null = null;
  const kick = (doRemount: boolean) => {
    if (!mountedRef.current) return;
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => {
      if (doRemount) setBfRev((x) => x + 1); // ★ 강제 리마운트
      load();
    }, 120);
  };

  const onPageShow = (e: PageTransitionEvent) => {
    // ★ persisted면 리마운트 + 재조회
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  // 뷰 렌더
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
    <div key={bfRev} className="space-y-3"> {/* ★ BFCache 복귀 시 리마운트 */}
      {items.map((e) => {
        const f = filmMap.get(e.filmId);
        const title = f ? `${f.title}${f.year ? ` (${f.year})` : ""}` : e.filmId;
        const directors = f?.credits?.directors?.length ? f.credits.directors.join(", ") : undefined;

        const d = new Date(e.updatedAt);
        const ymd = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;

        const badge = e.rating === null || e.rating === "" ? "-" : Number(e.rating).toFixed(1);

        return (
          <article
            key={e.id}
            className="rounded-xl border px-3 py-2 transition-colors duration-300 ease-out" // ← cursor-pointer 제거
            style={{ background: "var(--bg-rated)", borderColor: "var(--bd-rated)", color: "#FFFFFF" }}
          >
            {/* 본문만 클릭 가능 영역으로 제한 */}
            <div
              className="cursor-pointer"
              onClick={() => router.push(`/films/${e.filmId}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold truncate text-white">{title}</h3>
                  {directors && <p className="text-xs truncate mt-0.5 text-white/80">{directors}</p>}
                </div>
                <div
                  className="shrink-0 rounded-full px-2.5 py-1 text-base font-semibold"
                  style={{ background: "var(--badge-rated-bg)", color: "var(--badge-rated-fg)", border: "none" }}
                >
                  {badge}
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

            {/* 푸터(버튼 영역)는 본문 클릭 영역 밖에 둠 */}
            <div className="mt-1 flex items-center justify-between">
              <p className="text-[11px] text-white/70">Updated {ymd}</p>

              {/* ★ 서버 액션 기반 삭제: iOS Safari에서도 신뢰성 높음 */}
              <form
                action={deleteUserEntry}                              // ★ 서버 액션 직접 바인딩
                onClickCapture={(e) => { e.stopPropagation(); }}      // 카드 onClick과 충돌 방지
              >
                <input type="hidden" name="filmId" value={e.filmId} />
                <button
                  type="submit"
                  className="text-xs rounded-md px-2 py-0.5"
                  style={{
                    background: "var(--bg-unrated)",
                    color: "#111111",
                    border: "1px solid var(--bd-unrated)",
                    touchAction: "manipulation",
                  }}
                >
                  Delete
                </button>
              </form>
            </div>
          </article>
        );
      })}
    </div>
  );
}
