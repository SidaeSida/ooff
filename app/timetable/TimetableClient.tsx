// app/timetable/TimetableClient.tsx

"use client";

import type React from "react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";

import type { TimetableRow } from "./page";

// ---------------------------------------------------
// 1) 타임라인 설정 (08:00 ~ 27:00 = 다음날 03:00 직전까지)
//    → 02:00까지 그리드, 03:00까지 여유 높이
// ---------------------------------------------------
const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 27 * 60; // 03:00
const TOTAL_MIN = DAY_END_MIN - DAY_START_MIN;

const PX_PER_MIN_PC = 2.0;   // 데스크톱용
const PX_PER_MIN_MOBILE = 2.0; // 모바일용 (원하시는 값으로 조정)

// ---------------------------------------------------
// 2) 좌측 시간 표시 너비 및 카드 시작 위치
// ---------------------------------------------------
const LABEL_COL_WIDTH = 32;
const GRID_GAP_LEFT = 8;
const GRID_RIGHT_PADDING = 5;

const baseLeftPx = LABEL_COL_WIDTH + GRID_GAP_LEFT;
const basePaddingPx = baseLeftPx + GRID_RIGHT_PADDING;

// 시간 표시 라인: 08:00 ~ 26:00(=02:00)
// 03:00(27:00)은 라인 없이 여백만
const HOUR_MARKS: number[] = [];
for (let h = 8; h <= 26; h++) HOUR_MARKS.push(h);

// ---------------------------------------------------
// PC / Mobile step & width 설정
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
  steps: [120, 93, 68, 54, 45], // 1116 mobile s 튜닝값 유지
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

type Priority = 1 | 2 | null;

type PriorityMenuState = {
  screeningId: string;
  x: number;
  y: number;
} | null;

// 롱프레스용 상태
type LongPressState = {
  timer: number | null;
  id: string | null;
  triggered: boolean;
  x: number;
  y: number;
};

export default function TimetableClient({
  rows = [],
  editionLabel,
  dateIso,
}: Props) {
  // ---------------------------------------------------
  // 3) 모바일/PC 판정 안정화
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
  const pxPerMin = isMobile ? PX_PER_MIN_MOBILE : PX_PER_MIN_PC;
  const timelineHeight = TOTAL_MIN * pxPerMin;

  // ---------------------------------------------------
  // 카드 상태 관리
  // ---------------------------------------------------
  const [activeIds, setActiveIds] = useState<Set<string>>(
    () => new Set(rows.map((r) => r.id)),
  );

  const [priorityMap, setPriorityMap] = useState<Map<string, Priority>>(
    () => {
      const m = new Map<string, Priority>();
      for (const r of rows) {
        m.set(r.id, (r.priority as Priority) ?? null);
      }
      return m;
    },
  );

  // 클릭 z-index override
  const [zOverrides, setZOverrides] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [zSeq, setZSeq] = useState(1);

  // 롱프레스 메뉴 상태
  const [priorityMenu, setPriorityMenu] = useState<PriorityMenuState>(null);

  // 롱프레스 타이머
  const longPressRef = useRef<LongPressState>({
    timer: null,
    id: null,
    triggered: false,
    x: 0,
    y: 0,
  });

  useEffect(() => {
    setActiveIds(new Set(rows.map((r) => r.id)));
    setZOverrides(new Map());
    setZSeq(1);

    const m = new Map<string, Priority>();
    for (const r of rows) {
      m.set(r.id, (r.priority as Priority) ?? null);
    }
    setPriorityMap(m);
  }, [rows]);

  const visibleRows = useMemo(
    () => rows.filter((r) => activeIds.has(r.id)),
    [rows, activeIds],
  );

  const getPriority = (id: string): Priority => {
    const local = priorityMap.get(id);
    if (local !== undefined) return local;
    const found = rows.find((r) => r.id === id);
    return (found?.priority as Priority) ?? null;
  };

  // ---------------------------------------------------
  // 카드 배치(top, height, left, width, z-index)
  //  - 그룹 안 정렬: priority(1 → 2 → none) + startMin
  // ---------------------------------------------------
  const placedRows: PlacedRow[] = useMemo(() => {
    const groups = groupByOverlap(visibleRows);
    const placed: PlacedRow[] = [];

    for (const group of groups) {
      const groupWithPriority = group.map((row) => ({
        row,
        priority: getPriority(row.id),
      }));

      groupWithPriority.sort((a, b) => {
        const pa = a.priority ?? 99;
        const pb = b.priority ?? 99;
        if (pa !== pb) return pa - pb;
        return a.row.startMin - b.row.startMin;
      });

      const size = groupWithPriority.length;
      const idx = idxFromSize(size);

      const step = CONF.steps[idx];
      const width = CONF.widths[idx];
      const isSingle = size === 1;

      groupWithPriority.forEach(({ row, priority }, indexInGroup) => {
                // 자정을 넘는 상영(끝 시간이 시작 시간보다 빠른 경우)을 다음날로 보정
        let start = row.startMin;
        let end = row.endMin;
        if (end <= start) {
          end += 24 * 60; // 다음날로 이동
        }

        const startClamped = Math.max(start, DAY_START_MIN);
        const endClamped = Math.min(end, DAY_END_MIN);
        const duration = Math.max(endClamped - startClamped, 40);

        const top = (startClamped - DAY_START_MIN) * pxPerMin;
        const height = duration * pxPerMin;

        let left: number;
        if (isSingle) {
          left = baseLeftPx;
        } else {
          left = baseLeftPx + indexInGroup * step;
        }

        let zBase = 100 + (size - indexInGroup);
        if (priority === 1) zBase += 100;
        else if (priority === 2) zBase += 50;

        let z = zBase;
        const override = zOverrides.get(row.id);
        if (override != null) {
          z = 1000 + override; // 클릭 시 항상 최상단
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
  }, [visibleRows, zOverrides, pxPerMin, CONF.steps, CONF.widths, priorityMap]);

  // ---------------------------------------------------
  // 날짜 표시
  // ---------------------------------------------------
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
  // priority 저장
  // ---------------------------------------------------
  async function savePriority(screeningId: string, newPriority: Priority) {
    setPriorityMap((prev) => {
      const next = new Map(prev);
      next.set(screeningId, newPriority);
      return next;
    });

    try {
      const resp = await fetch("/api/favorite-screening", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screeningId,
          favorite: true,
          priority: newPriority,
        }),
      });

      if (!resp.ok) {
        setPriorityMap((_) => {
          const m = new Map<string, Priority>();
          for (const r of rows) {
            m.set(r.id, (r.priority as Priority) ?? null);
          }
          return m;
        });
      }
    } catch {
      setPriorityMap((_) => {
        const m = new Map<string, Priority>();
        for (const r of rows) {
          m.set(r.id, (r.priority as Priority) ?? null);
        }
        return m;
      });
    }
  }

  // ---------------------------------------------------
  // favorite 제거
  // ---------------------------------------------------
  async function removeFavorite(screeningId: string) {
    const wasActive = activeIds.has(screeningId);
    if (!wasActive) return;

    setActiveIds((prev) => {
      const next = new Set(prev);
      next.delete(screeningId);
      return next;
    });
    setPriorityMap((prev) => {
      const next = new Map(prev);
      next.delete(screeningId);
      return next;
    });

    try {
      const resp = await fetch("/api/favorite-screening", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screeningId,
          favorite: false,
        }),
      });

      if (!resp.ok) {
        setActiveIds((prev) => {
          const next = new Set(prev);
          if (wasActive) next.add(screeningId);
          return next;
        });
      }
    } catch {
      setActiveIds((prev) => {
        const next = new Set(prev);
        if (wasActive) next.add(screeningId);
        return next;
      });
    }
  }

  // ---------------------------------------------------
  // 하트: 짧게 누르기 → priority 순환 (1 → 2 → none → 1 ...)
// ---------------------------------------------------
  function handleHeartQuickTap(screeningId: string) {
    const current = getPriority(screeningId);
    let next: Priority;
    if (current === 1) next = 2;
    else if (current === 2) next = null;
    else next = 1;
    savePriority(screeningId, next);
  }

  // ---------------------------------------------------
  // 롱프레스 메뉴 위치 계산
  // ---------------------------------------------------
  function openPriorityMenuAt(
    screeningId: string,
    clientX: number,
    clientY: number,
  ) {
    if (typeof window === "undefined") return;

    const MENU_WIDTH = 40;
    const MENU_HEIGHT = 132; // 대략값
    const MARGIN = 8;

    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;

    let x = clientX - MENU_WIDTH / 2;
    if (x < MARGIN) x = MARGIN;
    if (x > vw - MENU_WIDTH - MARGIN) x = vw - MENU_WIDTH - MARGIN;

    let y: number;
    if (clientY + MENU_HEIGHT + MARGIN > vh) {
      y = clientY - MENU_HEIGHT - MARGIN;
      if (y < MARGIN) y = MARGIN;
    } else {
      y = clientY + MARGIN;
    }

    setPriorityMenu({ screeningId, x, y });
  }

  function closePriorityMenu() {
    setPriorityMenu(null);
  }

  async function handlePriorityAction(
    screeningId: string,
    action: "first" | "second" | "normal" | "remove",
  ) {
    closePriorityMenu();

    if (action === "remove") {
      await removeFavorite(screeningId);
      return;
    }

    const newPriority: Priority =
      action === "first" ? 1 : action === "second" ? 2 : null;

    await savePriority(screeningId, newPriority);
  }

  // ---------------------------------------------------
  // 롱프레스용 pointer 핸들러
  // ---------------------------------------------------
  function onHeartPointerDown(screeningId: string) {
    return (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const st = longPressRef.current;
      if (st.timer) {
        window.clearTimeout(st.timer);
        st.timer = null;
      }
      st.id = screeningId;
      st.triggered = false;
      st.x = e.clientX;
      st.y = e.clientY;
      st.timer = window.setTimeout(() => {
        if (!st.id) return;
        st.triggered = true;
        st.timer = null;
        openPriorityMenuAt(st.id, st.x, st.y);
      }, 500) as unknown as number;
    };
  }

  function clearLongPressTimer() {
    const st = longPressRef.current;
    if (st.timer) {
      window.clearTimeout(st.timer);
      st.timer = null;
    }
  }

  function onHeartPointerUp(screeningId: string) {
    return (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const st = longPressRef.current;
      const triggered = st.triggered;
      clearLongPressTimer();
      st.id = null;
      st.triggered = false;

      if (!triggered) {
        handleHeartQuickTap(screeningId);
      }
    };
  }

  function onHeartPointerLeave() {
    return () => {
      clearLongPressTimer();
      const st = longPressRef.current;
      st.triggered = false;
      st.id = null;
    };
  }

  // ---------------------------------------------------
  // 렌더링
  // ---------------------------------------------------
  return (
    <section className="space-y-3">
      <div className="text-sm text-gray-700">{dateLabel}</div>

      {visibleRows.length === 0 && (
        <div className="text-sm text-gray-500 border rounded-lg px-3 py-2">
          No favorite screenings on this day.
        </div>
      )}

      {visibleRows.length > 0 && (
        <div className="mt-1 bg-gray-50/90 px-1.5 py-2">
          <div className="relative" style={{ height: timelineHeight  }}>
            {/* 시간 그리드 */}
                        {HOUR_MARKS.map((h) => {
                          const minutesFromStart = h * 60 - DAY_START_MIN;
                          const top = minutesFromStart * pxPerMin;

                          // 12:00, 18:00, 24:00 강조
                          const 강조 = h === 12 || h === 18 || h === 24;

                          // 24시는 24:00 그대로, 그 이후(25,26)는 01:00, 02:00으로 표기
                          let labelHour = h;
                          if (h > 24) {
                            labelHour = h - 24; // 25→1, 26→2
                          }

                          return (
                            <div
                              key={h}
                              className="absolute left-0 right-0"
                              style={{ top }}
                            >
                              <div className="flex items-center">
                                <div
                                  className={
                                    강조
                                      ? "w-[36px] pl-[2px] text-[10px] text-left leading-none text-gray-900 font-semibold"
                                      : "w-[36px] pl-[2px] text-[10px] text-left leading-none text-gray-400"
                                  }
                                >
                                  {labelHour.toString().padStart(2, "0")}:00
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
              const priority = getPriority(s.id);

              let heartClass =
                "shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full border bg-white cursor-pointer text-[12px]";
              let heartStyle: React.CSSProperties | undefined;

              if (priority === 1) {
                heartStyle = {
                  borderColor: "var(--badge-rated-bg)",
                  color: "var(--badge-rated-bg)",
                };
              } else if (priority === 2) {
                heartStyle = {
                  borderColor: "var(--bar-fill-rated)",
                  color: "var(--bar-fill-rated)",
                };
              } else {
                heartStyle = {
                  borderColor: "var(--bar-fill-unrated)",
                  color: "var(--bar-fill-unrated)",
                };
              }

              const hasBundle =
                Array.isArray(s.bundleFilms) && s.bundleFilms.length > 1;

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
                      onPointerDown={onHeartPointerDown(s.id)}
                      onPointerUp={onHeartPointerUp(s.id)}
                      onPointerLeave={onHeartPointerLeave()}
                      className={heartClass}
                      style={heartStyle}
                      title="Priority / remove"
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

                  {/* 4행: 제목 (동시상영 A+B+C+D 각기 링크) */}
                  <div className="mt-[1px] text-[12px] font-semibold leading-snug line-clamp-2 break-words">
                    {hasBundle && s.bundleFilms
                      ? s.bundleFilms.map((bf, idx) => (
                          <span key={bf.filmId}>
                            {idx > 0 && (
                              <span className="mx-[1px] text-[11px] text-gray-700">
                                +{" "}
                              </span>
                            )}
                            <Link
                              href={`/films/${encodeURIComponent(bf.filmId)}`}
                              className="hover:underline underline-offset-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {bf.title}
                            </Link>
                          </span>
                        ))
                      : (
                        <Link
                          href={`/films/${encodeURIComponent(s.filmId)}`}
                          className="hover:underline underline-offset-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {s.filmTitle}
                        </Link>
                      )}
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

      {/* 우선순위 롱프레스 메뉴 */}
      {priorityMenu && (
        <div
          className="fixed inset-0 z-[2000] bg-black/10"
          onClick={closePriorityMenu}
        >
          <div
            className="
        absolute rounded-xl bg-white/95 
        border border-gray-300 shadow-[0_8px_20px_rgba(0,0,0,0.18)]
        w-[40px] text-[14px]
      "
            style={{ left: priorityMenu.x, top: priorityMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col divide-y divide-gray-200">
              {/* 1순위: badge-rated-bg */}
              <button
                type="button"
                className="w-full py-1 text-center hover:bg-gray-50"
                onClick={() =>
                  handlePriorityAction(priorityMenu.screeningId, "first")
                }
              >
                <span
                  className="font-medium"
                  style={{ color: "var(--badge-rated-bg)" }}
                >
                  1♡
                </span>
              </button>

              {/* 2순위: bar-fill-rated */}
              <button
                type="button"
                className="w-full py-1 text-center hover:bg-gray-50"
                onClick={() =>
                  handlePriorityAction(priorityMenu.screeningId, "second")
                }
              >
                <span
                  className="font-medium"
                  style={{ color: "var(--bar-fill-rated)" }}
                >
                  2♡
                </span>
              </button>

              {/* 무순위: bar-fill-unrated */}
              <button
                type="button"
                className="w-full py-1 text-center hover:bg-gray-50"
                onClick={() =>
                  handlePriorityAction(priorityMenu.screeningId, "normal")
                }
              >
                <span style={{ color: "var(--bar-fill-unrated)" }}>-♥</span>
              </button>

              {/* Remove */}
              <button
                type="button"
                className="w-full py-1 text-center hover:bg-gray-100"
                onClick={() =>
                  handlePriorityAction(priorityMenu.screeningId, "remove")
                }
              >
                <span className="text-gray-500 text-[11px]">X</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
