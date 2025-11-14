"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { TimetableRow } from "./page";

// ---------------------------------------------------
// 1) 타임라인 설정 (08:00 ~ 24:00)
//    → PX_PER_MIN = 1.8 로 확대 (기존 1)
// ---------------------------------------------------
const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 24 * 60;
const TOTAL_MIN = DAY_END_MIN - DAY_START_MIN;

// 확대된 픽셀 배율
const PX_PER_MIN = 1.45;

// 전체 높이
const TIMELINE_HEIGHT = TOTAL_MIN * PX_PER_MIN;

// ---------------------------------------------------
// 2) 좌측 시간 표시 너비 및 카드 시작 위치
//    (당신의 기존 튜닝값을 모두 유지)
// ---------------------------------------------------
const LABEL_COL_WIDTH = 32;
const GRID_GAP_LEFT = 8;
const GRID_RIGHT_PADDING = 5;

const baseLeftPx = LABEL_COL_WIDTH + GRID_GAP_LEFT;
const basePaddingPx = baseLeftPx + GRID_RIGHT_PADDING;

// 시간 표시 라인
const HOUR_MARKS: number[] = [];
for (let h = 8; h <= 23; h++) HOUR_MARKS.push(h);

// ---------------------------------------------------
// PC / Mobile step & width 설정 (당신의 튜닝값 그대로)
// ---------------------------------------------------
function makeDefaultWidths(steps: number[]) {
  const arr: string[] = [];
  for (let i = 0; i < 5; i++) {
    const sizeIndex = i;
    const step = steps[i];
    const minus = basePaddingPx + step * sizeIndex;
    arr.push(`calc(100% - ${minus}px)`);
  }
  return arr;
}

const CONF_PC = {
  steps: [150, 143, 95, 66, 54],
  widths: [] as string[],
};

const CONF_MOBILE = {
  steps: [120, 93, 55, 44, 34],
  widths: [] as string[],
};

CONF_PC.widths = makeDefaultWidths(CONF_PC.steps);
CONF_MOBILE.widths = makeDefaultWidths(CONF_MOBILE.steps);

// ---------------------------------------------------
// 겹침 그룹 계산
// ---------------------------------------------------
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

function idxFromSize(size: number) {
  return size >= 5 ? 4 : size - 1;
}

type Props = {
  rows: TimetableRow[];
  editionLabel: string;
  dateIso: string;
};

type PlacedRow = TimetableRow & {
  top: number;
  height: number;
  left: number;
  width: string;
  z: number;
};

export default function TimetableClient({
  rows = [],
  editionLabel,
  dateIso,
}: Props) {
  // ---------------------------------------------------
  // 3) 모바일/PC 판정 안정화
  //    - 초기 렌더
  //    - hydration 직후
  //    - 뒤로가기 시에도 정확하게 유지
  // ---------------------------------------------------
  const getIsMobile = () =>
    typeof window !== "undefined" && window.innerWidth < 420;

  const [isMobile, setIsMobile] = useState(getIsMobile);

  useLayoutEffect(() => {
    setIsMobile(getIsMobile());
  }, []);

  useEffect(() => {
    const handler = () => setIsMobile(getIsMobile());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const CONF = isMobile ? CONF_MOBILE : CONF_PC;

  // ---------------------------------------------------
  // 카드 상태 관리
  // ---------------------------------------------------
  const [activeIds, setActiveIds] = useState<Set<string>>(
    () => new Set(rows.map((r) => r.id)),
  );

  const [zOverrides, setZOverrides] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [zSeq, setZSeq] = useState(1);

  useEffect(() => {
    setActiveIds(new Set(rows.map((r) => r.id)));
    setZOverrides(new Map());
    setZSeq(1);
  }, [rows]);

  const visibleRows = useMemo(
    () => rows.filter((r) => activeIds.has(r.id)),
    [rows, activeIds],
  );

  // ---------------------------------------------------
  // 카드 배치(top, height, left, width)
// ---------------------------------------------------
  const placedRows: PlacedRow[] = useMemo(() => {
    const groups = groupByOverlap(visibleRows);
    const placed: PlacedRow[] = [];

    for (const group of groups) {
      const size = group.length;
      const idx = idxFromSize(size);

      const step = CONF.steps[idx];
      const width = CONF.widths[idx];
      const isSingle = size === 1;

      group.forEach((row, indexInGroup) => {
        const startClamped = Math.max(row.startMin, DAY_START_MIN);
        const endClamped = Math.min(row.endMin, DAY_END_MIN);
        const duration = Math.max(endClamped - startClamped, 40);

        const top = (startClamped - DAY_START_MIN) * PX_PER_MIN;
        const height = duration * PX_PER_MIN;

        let left: number;
        if (isSingle) {
          left = baseLeftPx;
        } else {
          left = baseLeftPx + indexInGroup * step;
        }

        let z = 100 + (size - indexInGroup);
        const boost = zOverrides.get(row.id);
        if (boost != null) z += boost * 10;

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
  }, [visibleRows, zOverrides, isMobile, CONF.steps, CONF.widths]);

  // ---------------------------------------------------
  // 날짜 표시
  // ---------------------------------------------------
  const dateLabel = useMemo(() => {
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime()))
      return `${editionLabel} · ${dateIso} · ${visibleRows.length}개 상영`;

    const month = d.getMonth() + 1;
    const day = d.getDate();
    const w = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    return `${editionLabel} · ${month}월${day}일(${w}) · ${visibleRows.length}개 상영`;
  }, [editionLabel, dateIso, visibleRows.length]);

  // ---------------------------------------------------
  // Bring to front
  // ---------------------------------------------------
  function bringToFront(id: string) {
    setZOverrides((prev) => {
      const next = new Map(prev);
      next.set(id, zSeq);
      return next;
    });
    setZSeq((n) => n + 1);
  }

  // ---------------------------------------------------
  // 즐겨찾기 토글
  // ---------------------------------------------------
  async function toggleFavorite(screeningId: string) {
    if (!screeningId) return;
    const wasActive = activeIds.has(screeningId);

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
        setActiveIds((prev) => {
          const next = new Set(prev);
          if (wasActive) next.add(screeningId);
          else next.delete(screeningId);
          return next;
        });
      }
    } catch {
      setActiveIds((prev) => {
        const next = new Set(prev);
        if (wasActive) next.add(screeningId);
        else next.delete(screeningId);
        return next;
      });
    }
  }

  // ---------------------------------------------------
  // 렌더링
  // ---------------------------------------------------
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
            {/* 시간 그리드 */}
            {HOUR_MARKS.map((h) => {
              const minutesFromStart = h * 60 - DAY_START_MIN;
              const top = minutesFromStart * PX_PER_MIN;

              const 특별강조 = h === 12 || h === 18;

              return (
                <div
                  key={h}
                  className="absolute left-0 right-0"
                  style={{ top }}
                >
                  <div className="flex items-center">
                    <div
                      className={
                        특별강조
                          ? "w-[36px] pl-[2px] text-[10px] text-left leading-none text-gray-900 font-semibold"
                          : "w-[36px] pl-[2px] text-[10px] text-left leading-none text-gray-400"
                      }
                    >
                      {h.toString().padStart(2, "0")}:00
                    </div>
                    <div className="flex-1 border-t border-dashed border-gray-200" />
                  </div>
                </div>
              );
            })}

            {/* 상영 카드 */}
            {placedRows.map((s) => {
              const ratingLabel = s.rating ?? "";
              const hasRating = !!ratingLabel;
              const hasGV = !!s.withGV;

              return (
                <article
                  key={s.id}
                  className="
                    absolute border border-gray-200 rounded-3xl bg-white/85
                    px-3 py-2 shadow-sm text-[10px] cursor-pointer
                    overflow-hidden
                  "
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
                    <div className="text-[12px] font-semibold text-gray-900 truncate">
                      {s.time}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(s.id);
                      }}
                      className="
                        shrink-0 inline-flex items-center justify-center
                        w-7 h-7 rounded-full border border-gray-300
                        bg-white cursor-pointer
                      "
                      title="타임테이블에서 제거"
                    >
                      <span className="text-[12px] leading-none">♥</span>
                    </button>
                  </div>

                  {/* 2행: 상영관 */}
                  <div className="mt-[1px] text-[10px] text-gray-700 truncate">
                    {s.venue}
                  </div>

                  {/* 3행: 섹션 */}
                  {s.section && (
                    <div className="mt-[1px] text-[10px] text-gray-500 truncate">
                      {s.section}
                    </div>
                  )}

                  {/* 4행: 제목 */}
                  <div className="mt-[1px] truncate">
                    <Link
                      href={`/films/${encodeURIComponent(s.filmId)}`}
                      className="
                        text-[12px] font-semibold leading-snug
                        hover:underline underline-offset-2 truncate
                      "
                      onClick={(e) => e.stopPropagation()}
                    >
                      {s.filmTitle}
                    </Link>
                  </div>

                  {/* 5행: 등급/GV 및 code */}
                  {(hasRating || hasGV || s.code) && (
                    <div className="mt-[2px] flex items-center justify-between text-[9px]">
                      <div className="text-gray-600 truncate">
                        {hasRating && <span>{ratingLabel}</span>}
                        {hasRating && hasGV && (
                          <span className="mx-[2px]">·</span>
                        )}
                        {hasGV && <span>GV</span>}
                      </div>
                      {s.code && (
                        <span className="text-gray-400 truncate ml-1">
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
