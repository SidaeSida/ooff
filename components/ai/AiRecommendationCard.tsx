"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// 데이터 직접 import (클라이언트에서 상세 정보 조회용)
import filmsData from "@/data/films.json";
import entriesData from "@/data/entries.json";
import screeningsData from "@/data/screenings.json";

type Props = {
  screeningId: string;
  reason: string;
};

// 시간 포맷 헬퍼 (2025-05-01T14:00:00 -> 14:00)
function formatTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export default function AiRecommendationCard({ screeningId, reason }: Props) {
  const router = useRouter();
  const [isAdded, setIsAdded] = useState(false);
  const [loading, setLoading] = useState(false);

  // ID로 상세 정보 Lookup
  const info = useMemo(() => {
    const scr = (screeningsData as any[]).find((s) => s.id === screeningId);
    if (!scr) return null;

    const entry = (entriesData as any[]).find((e) => e.id === scr.entryId);
    const film = (filmsData as any[]).find((f) => f.id === entry?.filmId);

    if (!scr || !film) return null;

    // 종료 시간 계산 (없으면 런타임 더하기)
    let endTime = "";
    if (scr.endsAt) {
      endTime = formatTime(scr.endsAt);
    } else {
      const d = new Date(scr.startsAt);
      d.setMinutes(d.getMinutes() + (film.runtime || 100));
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      endTime = `${h}:${m}`;
    }

    return {
      title: film.title_ko || film.title,
      director: film.credits?.directors?.join(", ") || "",
      venue: scr.venue,
      startTime: formatTime(scr.startsAt),
      endTime,
      filmId: film.id,
    };
  }, [screeningId]);

  // 하트 클릭 핸들러 (API 호출)
  const handleAdd = async () => {
    if (loading) return;
    setLoading(true);

    // 토글 로직: 이미 추가되었으면 제거, 아니면 추가
    // (여기서는 '추천받아 담기' 컨셉이므로 일단 담기만 구현하고, UI상으론 Added 상태로 변경)
    const nextState = !isAdded;

    try {
      await fetch("/api/favorite-screening", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screeningId,
          favorite: nextState,
        }),
      });

      setIsAdded(nextState);
      router.refresh(); // [핵심] 뒤에 있는 타임테이블 새로고침
    } catch (e) {
      alert("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!info) return null; // 데이터 매칭 실패 시 숨김

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm mb-3 flex flex-col gap-2">
      {/* 상단: 영화 정보 + 하트 */}
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/films/${encodeURIComponent(info.filmId)}`}
            className="text-sm font-bold text-gray-900 hover:underline leading-tight block mb-1"
          >
            {info.title}
          </Link>
          <div className="text-xs text-gray-600">
            <span className="font-medium text-black">
              {info.startTime} - {info.endTime}
            </span>{" "}
            <span className="text-gray-400">|</span> {info.venue}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {info.director}
          </div>
        </div>

        {/* 하트 버튼 */}
        <button
          onClick={handleAdd}
          disabled={loading}
          className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all ${
            isAdded
              ? "bg-black border-black text-white"
              : "bg-white border-gray-200 text-gray-400 hover:border-black hover:text-black"
          }`}
        >
          {loading ? (
            <span className="animate-spin text-[10px]">↻</span>
          ) : (
            <span className="text-sm">♥</span>
          )}
        </button>
      </div>

      {/* 하단: 추천 사유 (말풍선 느낌) */}
      <div className="bg-gray-50 rounded-lg p-2.5 text-xs text-gray-700 leading-relaxed border border-gray-100">
        <span className="font-bold mr-1">✨ AI:</span>
        {reason}
      </div>
    </div>
  );
}