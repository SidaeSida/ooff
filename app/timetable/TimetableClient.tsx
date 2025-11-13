// app/timetable/TimetableClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { TimetableRow } from "./page";

type Props = {
  rows: TimetableRow[];
  editionLabel: string;
  dateIso: string;
};

type PlacedRow = TimetableRow & {
  top: number;
  height: number;
  left: number;
  width: string; // CSS calc() 문자열
  z: number;
};

// 타임라인 설정 (08:00 ~ 24:00)
const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 24 * 60;
const TOTAL_MIN = DAY_END_MIN - DAY_START_MIN; // 960
const PX_PER_MIN = 1;
const TIMELINE_HEIGHT = TOTAL_MIN * PX_PER_MIN;

// 좌측 시간 표시 너비 및 카드 시작 위치
const LABEL_COL_WIDTH = 32;
const GRID_GAP_LEFT = 0;
const GRID_RIGHT_PADDING = 0;

// 08:00 ~ 24:00 시간선
const HOUR_MARKS: number[] = [];
for (let h = 8; h <= 24; h++) HOUR_MARKS.push(h);

// 겹치는 상영들 그룹핑
function groupByOverlap(list: TimetableRow[]): TimetableRow[][] {
  if (!list.length) return [];
  const sorted = [...list].sort((a, b) => a.startMin - b.startMin);

  const groups: TimetableRow[][] = [];
  let cur: TimetableRow[] = [];
  let curEnd = -1;

  for (const row of sorted) {
    if (!cur.length) {
      cur = [row];
      curEnd = row.endMin;
      groups.push(cur);
      continue;
    }
    if (row.startMin < curEnd) {
      cur.push(row);
      if (row.endMin > curEnd) curEnd = row.endMin;
    } else {
      cur = [row];
      curEnd = row.endMin;
      groups.push(cur);
    }
  }
  return groups;
}

// 그룹 크기에 따라 카드 간 가로 간격(px)
// 숫자를 키우면 → 카드 폭이 더 줄고, 서로 더 많이 겹쳐집니다.
function offsetStepForGroupSize(size: number): number {
  if (size <= 1) return 150;
  if (size === 2) return 130;
  if (size === 3) return 98;
  if (size === 4) return 70;
  return 50; // 5개 이상
}

export default function TimetableClient({
  rows = [],
  editionLabel,
  dateIso,
}: Props) {
  // 현재 화면에 살아있는 즐겨찾기 (타임테이블에서는 기본이 모두 true)
  const [activeIds, setActiveIds] = useState<Set<string>>(
    () => new Set(rows.map((r) => r.id))
  );

  // 카드별 z-index 보정(클릭으로 앞으로 가져온 순서 저장)
  const [zOverrides, setZOverrides] = useState<Map<string, number>>(
    () => new Map()
  );
  const [zSeq, setZSeq] = useState(1);

  // 날짜 / 영화제 바꾸면 rows 가 통째로 바뀌므로 상태 동기화
  useEffect(() => {
    setActiveIds(new Set(rows.map((r) => r.id)));
    setZOverrides(new Map());
    setZSeq(1);
  }, [rows]);

  const visibleRows = useMemo(
    () => (rows ?? []).filter((r) => activeIds.has(r.id)),
    [rows, activeIds]
  );

  // 겹침 그룹 → 좌우 오프셋/높이/폭 계산
  const placedRows: PlacedRow[] = useMemo(() => {
    const groups = groupByOverlap(visibleRows);
    const placed: PlacedRow[] = [];

    const baseLeftPx = LABEL_COL_WIDTH + GRID_GAP_LEFT;
    const basePaddingPx = baseLeftPx + GRID_RIGHT_PADDING;

    for (const group of groups) {
      const size = group.length;
      const step = offsetStepForGroupSize(size);

      group.forEach((row, idx) => {
        const startClamped = Math.max(row.startMin, DAY_START_MIN);
        const endClamped = Math.min(row.endMin, DAY_END_MIN);
        const duration = Math.max(endClamped - startClamped, 40); // 최소 높이 40분

        const top = (startClamped - DAY_START_MIN) * PX_PER_MIN;
        const height = duration * PX_PER_MIN;

        const offsetIdx = idx; // 0 = 가장 왼쪽
        const left = baseLeftPx + offsetIdx * step;

        // 그룹 크기에 따라 폭이 줄어들도록 width 를 calc 로 계산
        const width = `calc(100% - ${basePaddingPx}px - ${
          (size - 1) * step
        }px)`;

        // 기본 z-index: 왼쪽(0)이 가장 위
        let z = 100 + (size - offsetIdx);
        const boost = zOverrides.get(row.id);
        if (boost != null) {
          z += boost * 10;
        }

        placed.push({
          ...row,
          top,
          height,
          left,
          width,
          z,
        });
      });
    }

    return placed;
  }, [visibleRows, zOverrides]);

  const dateLabel = useMemo(() => {
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) {
      return `${editionLabel} · ${dateIso} · ${visibleRows.length}개 상영`;
    }
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const w = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    return `${editionLabel} · ${month}월${day}일(${w}) · ${visibleRows.length}개 상영`;
  }, [editionLabel, dateIso, visibleRows.length]);

  // 카드 앞으로 가져오기
  function bringToFront(id: string) {
    setZOverrides((prev) => {
      const next = new Map(prev);
      next.set(id, zSeq);
      return next;
    });
    setZSeq((n) => n + 1);
  }

  // 즐겨찾기 해제 토글 (타임테이블에서는 주로 "빼는" 용도)
  async function toggleFavorite(screeningId: string) {
    if (!screeningId) return;

    const wasActive = activeIds.has(screeningId);

    // optimistic update: 우선 화면에서 제거
    if (wasActive) {
      setActiveIds((prev) => {
        const next = new Set(prev);
        next.delete(screeningId);
        return next;
      });
    }

    try {
      const resp = await fetch("/api/favorite-screening", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screeningId,
          favorite: !wasActive,
        }),
      });

      if (!resp.ok) {
        // 실패 시 롤백
        setActiveIds((prev) => {
          const next = new Set(prev);
          if (wasActive) next.add(screeningId);
          else next.delete(screeningId);
          return next;
        });
      }
    } catch {
      // 에러 시 롤백
      setActiveIds((prev) => {
        const next = new Set(prev);
        if (wasActive) next.add(screeningId);
        else next.delete(screeningId);
        return next;
      });
    }
  }

  return (
    <section className="space-y-3">
      <div className="text-sm text-gray-700">{dateLabel}</div>

      {visibleRows.length === 0 && (
        <div className="text-sm text-gray-500 border rounded-lg px-3 py-2">
          선택한 날짜에 남아 있는 하트 상영이 없습니다.
        </div>
      )}

      {visibleRows.length > 0 && (
        <div className="mt-1 bg-gray-50/90 px-1.5 py-2">
          <div className="relative" style={{ height: TIMELINE_HEIGHT }}>
            {/* 시간 그리드 (1시간 간격) */}
            {HOUR_MARKS.map((h) => {
              const minutesFromStart = h * 60 - DAY_START_MIN;
              if (minutesFromStart < 0 || minutesFromStart > TOTAL_MIN) {
                return null;
              }
              const top = minutesFromStart * PX_PER_MIN;

              const isMealTime = h === 12 || h === 18;

              return (
                <div
                  key={h}
                  className="absolute left-0 right-0"
                  style={{ top }}
                >
                  <div className="flex items-center">
                    <div
                      className="w-[36px] pl-[2px] text-[10px] text-left leading-none"
                      style={isMealTime ? { color: "#000000" } : { color: "#9CA3AF" }}
                    >
                      {h.toString().padStart(2, "0")}:00
                    </div>
                    <div className="flex-1 border-t border-dashed border-gray-200" />
                  </div>
                </div>
              );
            })}

            {/* 상영 카드들 */}
            {placedRows.map((s) => {
              const ratingLabel = s.rating ?? "";
              const hasRating = !!ratingLabel;
              const hasGV = !!s.withGV;

              return (
                <article
                  key={s.id}
                  className="absolute border border-gray-200 rounded-3xl bg-white/85 px-3 py-2 shadow-sm text-[10px] cursor-pointer"
                  style={{
                    top: s.top,
                    left: s.left,
                    width: s.width,
                    height: s.height,
                    zIndex: s.z,
                  }}
                  onClick={() => bringToFront(s.id)}
                >
                  {/* 1행: 시간 + 하트 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[12px] font-semibold text-gray-900">
                      {s.time}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(s.id);
                      }}
                      className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full border border-gray-300 bg-white cursor-pointer"
                      title="타임테이블에서 제거"
                    >
                      <span className="text-[12px] leading-none">♥</span>
                    </button>
                  </div>

                  {/* 2행: 상영관 */}
                  <div className="mt-[1px] flex justify-between gap-2 text-[10px] text-gray-700">
                    <div className="truncate">{s.venue}</div>
                  </div>

                  {/* 3행: 섹션 */}
                  {s.section && (
                    <div className="mt-[1px] text-[10px] text-gray-500 truncate">
                      {s.section}
                    </div>
                  )}

                  {/* 4행: 제목 (글자만 링크) */}
                  <div className="mt-[1px]">
                    <Link
                      href={`/films/${encodeURIComponent(s.filmId)}`}
                      className="text-[12px] font-semibold leading-snug hover:underline underline-offset-2"
                      onClick={(e) => {
                        // 카드 클릭(onClick)과 분리: 제목 글자만 링크
                        e.stopPropagation();
                      }}
                    >
                      {s.filmTitle}
                    </Link>
                  </div>

                  {/* 5행: 연령 / GV / code 한 줄 */}
                  {(hasRating || hasGV || s.code) && (
                    <div className="mt-[2px] flex items-center justify-between text-[9px]">
                      <div className="text-gray-600">
                        {hasRating && <span>{ratingLabel}</span>}
                        {hasRating && hasGV && (
                          <span className="mx-[2px]">·</span>
                        )}
                        {hasGV && <span>GV</span>}
                      </div>
                      {s.code && (
                        <span className="text-gray-400">
                          code: {s.code}
                        </span>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
