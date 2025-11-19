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
// ---------------------------------------------------
const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 27 * 60; // 03:00
const TOTAL_MIN = DAY_END_MIN - DAY_START_MIN;

const PX_PER_MIN_PC = 2.0;
const PX_PER_MIN_MOBILE = 2.0;

// ---------------------------------------------------
// 2) 좌측 시간 표시 너비 및 카드 시작 위치
// ---------------------------------------------------
const LABEL_COL_WIDTH = 32;
const GRID_GAP_LEFT = 8;
const GRID_RIGHT_PADDING = 5;

const baseLeftPx = LABEL_COL_WIDTH + GRID_GAP_LEFT;
const basePaddingPx = baseLeftPx + GRID_RIGHT_PADDING;

// 시간 표시 라인: 08:00 ~ 26:00(=02:00)
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
  steps: [120, 120, 80, 60, 48], // 모바일 튜닝값 유지
  widths: [] as string[],
};

CONF_PC.widths = makeDefaultWidths(CONF_PC.steps);
CONF_MOBILE.widths = makeDefaultWidths(CONF_MOBILE.steps);

// ---------------------------------------------------
// 삭제존 설정 (오른쪽 끝 32px 카드형 DEL)
// ---------------------------------------------------
const DELETE_ZONE_WIDTH = 32;

const SINGLE_CARD_DRAG_LIMIT_LEFT = 10;   // 왼쪽으로 최대 80px
const SINGLE_CARD_DRAG_LIMIT_RIGHT = 40;  // 오른쪽으로 최대 80px
// ---------------------------------------------------
// 유틸
// ---------------------------------------------------
// ---------------------------------------------------
// 유틸
// ---------------------------------------------------
function groupByOverlap(list: TimetableRow[]): TimetableRow[][] {
  if (!list.length) return [];

  // 시작 시간 기준 정렬
  const sorted = [...list].sort((a, b) => a.startMin - b.startMin);

  const groups: TimetableRow[][] = [];
  let cur: TimetableRow[] = [];
  let curEnd = -1;

  for (const row of sorted) {
    const rowStart = row.startMin;

    // 자정 넘는 상영 보정:
    // endMin이 startMin보다 작거나 같으면 다음날로 넘어간 것으로 보고 +24시간
    const rawEnd = row.endMin;
    const rowEnd =
      rawEnd <= rowStart ? rawEnd + 24 * 60 : rawEnd;

    if (!cur.length) {
      // 첫 카드
      cur = [row];
      curEnd = rowEnd;
      groups.push(cur);
      continue;
    }

    // 겹침 여부 판단 (보정된 rowEnd 사용)
    if (rowStart < curEnd) {
      // 기존 그룹과 시간 겹침 → 같은 그룹에 추가
      cur.push(row);
      if (rowEnd > curEnd) {
        curEnd = rowEnd;
      }
    } else {
      // 시간 안 겹침 → 새 그룹 시작
      cur = [row];
      curEnd = rowEnd;
      groups.push(cur);
    }
  }

  return groups;
}


function idxFromSize(size: number) {
  return size >= 5 ? 4 : size - 1;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
function stepOffset(delta: number, step: number) {
  const r = delta / step;

  // 오른쪽 이동은 기존처럼 0.5 기준
  if (r >= 0) return Math.round(r);

  // 왼쪽 이동은 "한 칸 더 나갔다가 되돌아오는" 걸 막기 위해
  // 항상 안쪽으로만 스냅되게 처리 (ceil 사용)
  return Math.ceil(r);
}

// ---------------------------------------------------
// 타입
// ---------------------------------------------------
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

type Priority = 0 | 1 | 2;
type PriorityOrNull = Priority | null;

type PriorityMenuState = {
  screeningId: string;
  x: number;
  y: number;
} | null;

type LongPressState = {
  timer: number | null;
  id: string | null;
  triggered: boolean;
  x: number;
  y: number;
};

type CardLongPressState = {
  timer: number | null;
  id: string | null;
  startClientX: number;
};

type DragState = {
  id: string;
  groupIds: string[];
  originIndex: number;
  startClientX: number;
  visualClientX: number;
  pointerClientX: number;
};

// ---------------------------------------------------
// 우선순위 스타일
// ---------------------------------------------------
function getPriorityStyles(priority: PriorityOrNull) {
  if (priority === 1) {
    return {
      cardBg: "rgba(244, 215, 170, 0.92)",
      cardBorder: "var(--badge-rated-bg)",
      heartBorder: "var(--badge-rated-bg)",
      heartColor: "var(--badge-rated-bg)",
    };
  }
  if (priority === 2) {
    return {
      cardBg: "rgba(219, 196, 255, 0.92)",
      cardBorder: "var(--bar-fill-rated)",
      heartBorder: "var(--bar-fill-rated)",
      heartColor: "var(--bar-fill-rated)",
    };
  }
  return {
    cardBg: "rgba(255,255,255,0.92)",
    cardBorder: "rgba(209,213,219,1)",
    heartBorder: "var(--bar-fill-unrated)",
    heartColor: "var(--bar-fill-unrated)",
  };
}

function getNextPriority(p: PriorityOrNull): Priority {
  if (p === 0 || p === null) return 1;
  if (p === 1) return 2;
  return 0;
}

export default function TimetableClient({
  rows = [],
  editionLabel,
  dateIso,
}: Props) {
  // ---------------------------------------------------
  // 모바일 판정
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

  const containerRef = useRef<HTMLDivElement | null>(null);

  // ---------------------------------------------------
  // 상태
  // ---------------------------------------------------
  const [activeIds, setActiveIds] = useState<Set<string>>(
    () => new Set(rows.map((r) => r.id)),
  );

  const [priorityMap, setPriorityMap] = useState<
    Map<string, PriorityOrNull>
  >(() => {
    const m = new Map<string, PriorityOrNull>();
    for (const r of rows) {
      const base =
        typeof r.priority === "number"
          ? (r.priority as Priority)
          : null;
      m.set(r.id, base);
    }
    return m;
  });

  const [orderMap, setOrderMap] = useState<Map<string, number | null>>(
    () => {
      const m = new Map<string, number | null>();
      for (const r of rows) {
        m.set(
          r.id,
          typeof r.order === "number" ? (r.order as number) : null,
        );
      }
      return m;
    },
  );

  const [zOverrides, setZOverrides] = useState(new Map<string, number>());
  const [zSeq, setZSeq] = useState(1);

  const [priorityMenu, setPriorityMenu] = useState<PriorityMenuState>(null);

  const longPressRef = useRef<LongPressState>({
    timer: null,
    id: null,
    triggered: false,
    x: 0,
    y: 0,
  });

  const cardLongPressRef = useRef<CardLongPressState>({
    timer: null,
    id: null,
    startClientX: 0,
  });

  const [dragState, setDragState] = useState<DragState | null>(null);

  const [deleteZoneActive, setDeleteZoneActive] = useState(false);

  // rows 변경 시 reset
  useEffect(() => {
    setActiveIds(new Set(rows.map((r) => r.id)));
    setZOverrides(new Map());
    setZSeq(1);

    const m1 = new Map<string, PriorityOrNull>();
    for (const r of rows) {
      const base =
        typeof r.priority === "number"
          ? (r.priority as Priority)
          : null;
      m1.set(r.id, base);
    }
    setPriorityMap(m1);

    const m2 = new Map<string, number | null>();
    for (const r of rows) {
      m2.set(
        r.id,
        typeof r.order === "number" ? (r.order as number) : null,
      );
    }
    setOrderMap(m2);
  }, [rows]);

  // ---------------------------------------------------
  // 필터
  // ---------------------------------------------------
  const visibleRows = useMemo(
    () => rows.filter((r) => activeIds.has(r.id)),
    [rows, activeIds],
  );

  const getPriority = (id: string): PriorityOrNull => {
    const local = priorityMap.get(id);
    if (local !== undefined) return local;
    const found = rows.find((r) => r.id === id);
    return (found?.priority as PriorityOrNull) ?? null;
  };

  const getOrder = (id: string): number | null => {
    const v = orderMap.get(id);
    return v == null ? null : v;
  };

  // ---------------------------------------------------
  // 카드 배치 (column 분리 핵심)
  // ---------------------------------------------------
  const placedRows: PlacedRow[] = useMemo(() => {
    const groups = groupByOverlap(visibleRows);
    const placed: PlacedRow[] = [];

    for (const group of groups) {
      let meta = group.map((row) => ({
        row,
        priority: getPriority(row.id),
        order: getOrder(row.id),
      }));

      // 기본 정렬: order → 시간
            // 기본 정렬:
      // 1) order가 있으면 order 우선
      // 2) 둘 다 order 없으면 code → 시작 시간 순
      meta.sort((a, b) => {
        const oa = a.order;
        const ob = b.order;

        // 둘 다 order가 있는 경우: order 우선
        if (oa != null && ob != null && oa !== ob) return oa - ob;

        // a만 order가 있으면 a를 앞으로
        if (oa != null && ob == null) return -1;

        // b만 order가 있으면 b를 앞으로
        if (oa == null && ob != null) return 1;

        // 여기까지 왔다는 것은 둘 다 order가 없거나(둘 다 null),
        // 둘 다 있고 값이 같은 경우 → code + 시작 시간으로 fallback
        const ca = parseInt(a.row.code ?? "0", 10);
        const cb = parseInt(b.row.code ?? "0", 10);
        if (ca !== cb) return ca - cb;

        return a.row.startMin - b.row.startMin;
      });


      const size = meta.length;
      const idx = idxFromSize(size);
      const step = CONF.steps[idx];
      const width = CONF.widths[idx];
      const isSingle = size === 1;

      let dragInfo: {
        dragId: string;
        originIndex: number;
        newIndex: number;
        delta: number;
      } | null = null;

      if (dragState && size > 1) {
        const dragId = dragState.id;
        const baseIndex = meta.findIndex((g) => g.row.id === dragId);
        if (baseIndex >= 0) {
          const delta =
            dragState.visualClientX - dragState.startClientX;
          const offset = stepOffset(delta, step);
          const newIndex = clamp(
            baseIndex + offset,
            0,
            size - 1,
          );
          dragInfo = {
            dragId,
            originIndex: baseIndex,
            newIndex,
            delta,
          };
        }
      }

      meta.forEach(({ row, priority }, baseIndex) => {
        // 자정 보정
        let start = row.startMin;
        let end = row.endMin;
        if (end <= start) end += 1440;

        const startClamped = Math.max(start, DAY_START_MIN);
        const endClamped = Math.min(end, DAY_END_MIN);
        const duration = Math.max(endClamped - startClamped, 40);

        const top = (startClamped - DAY_START_MIN) * pxPerMin;
        const height = duration * pxPerMin;

        // visualIndex 계산
        let visualIndex = baseIndex;

        if (dragInfo && dragInfo.originIndex !== dragInfo.newIndex) {
          const { dragId, originIndex, newIndex } = dragInfo;

          if (row.id === dragId) {
            visualIndex = originIndex;
          } else if (newIndex > originIndex) {
            if (baseIndex > originIndex && baseIndex <= newIndex) {
              visualIndex = baseIndex - 1;
            }
          } else if (newIndex < originIndex) {
            if (baseIndex >= newIndex && baseIndex < originIndex) {
              visualIndex = baseIndex + 1;
            }
          }
        }

        // column 위치
        const left = isSingle
          ? baseLeftPx
          : baseLeftPx + visualIndex * step;

        // zIndex
        let zBase = 100 + (size - baseIndex);
        if (priority === 1) zBase += 100;
        else if (priority === 2) zBase += 50;

        let z = zBase;
        const override = zOverrides.get(row.id);
        if (override != null) z = 1000 + override;

        placed.push({
          ...(row as TimetableRow),
          top,
          height,
          left,
          width,
          z,
        });
      });
    }

    return placed;
  }, [
    visibleRows,
    zOverrides,
    pxPerMin,
    CONF.steps,
    CONF.widths,
    priorityMap,
    orderMap,
    dragState,
  ]);

  // ---------------------------------------------------
  // 삭제존 위치
  // ---------------------------------------------------
  let deleteZoneTop = timelineHeight / 2 - 40;
  let deleteZoneHeight = 80;
  if (dragState) {
    const dragging = placedRows.find((r) => r.id === dragState.id);
    if (dragging) {
      deleteZoneTop = dragging.top;
      deleteZoneHeight = dragging.height;
    }
  }

  // ---------------------------------------------------
  // 날짜 라벨
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
  // 우선순위 메뉴
  // ---------------------------------------------------
  function bringToFront(id: string) {
    setZOverrides((prev) => {
      const next = new Map(prev);
      next.set(id, zSeq);
      return next;
    });
    setZSeq((n) => n + 1);
  }

  function openPriorityMenuAt(
    screeningId: string,
    clientX: number,
    clientY: number,
  ) {
    if (typeof window === "undefined") return;

    const MENU_WIDTH = 40;
    const MENU_HEIGHT = 132;
    const MARGIN = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

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

    let newPriority: Priority = 0;
    if (action === "first") newPriority = 1;
    if (action === "second") newPriority = 2;

    await savePriority(screeningId, newPriority);
  }

  // ---------------------------------------------------
  // priority 저장
  // ---------------------------------------------------
  async function savePriority(
    screeningId: string,
    newPriority: Priority,
  ) {
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
          sortOrder: getOrder(screeningId),
        }),
      });

      if (!resp.ok) throw new Error();
    } catch {
      // rollback
      const m = new Map<string, PriorityOrNull>();
      for (const r of rows) {
        const base =
          typeof r.priority === "number"
            ? (r.priority as Priority)
            : null;
        m.set(r.id, base);
      }
      setPriorityMap(m);
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

    setOrderMap((prev) => {
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

      if (!resp.ok) throw new Error();
    } catch {
      // rollback
      setActiveIds((prev) => {
        const next = new Set(prev);
        if (wasActive) next.add(screeningId);
        return next;
      });
    }
  }

  // ---------------------------------------------------
  // 하트 롱프레스
  // ---------------------------------------------------
  function onHeartPointerDown(screeningId: string) {
    return (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const st = longPressRef.current;
      if (st.timer) clearTimeout(st.timer);
      st.id = screeningId;
      st.triggered = false;
      st.x = e.clientX;
      st.y = e.clientY;
      st.timer = window.setTimeout(() => {
        if (!st.id) return;
        st.triggered = true;
        st.timer = null;
        openPriorityMenuAt(st.id, st.x, st.y);
      }, 500) as any;
    };
  }

  function clearHeartLongPressTimer() {
    const st = longPressRef.current;
    if (st.timer) {
      clearTimeout(st.timer);
      st.timer = null;
    }
  }

  function onHeartPointerUp(screeningId: string) {
    return (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const st = longPressRef.current;
      const triggered = st.triggered;
      clearHeartLongPressTimer();
      st.id = null;
      st.triggered = false;

      if (!triggered) {
        const current = getPriority(screeningId);
        const next = getNextPriority(current);
        savePriority(screeningId, next);
      }
    };
  }

  function onHeartPointerLeave() {
    return (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      clearHeartLongPressTimer();
      const st = longPressRef.current;
      st.id = null;
      st.triggered = false;
    };
  }

  // ---------------------------------------------------
  // 카드 드래그 핸들링
  // ---------------------------------------------------
  function clearCardLongPressTimer() {
    const st = cardLongPressRef.current;
    if (st.timer) {
      clearTimeout(st.timer);
      st.timer = null;
    }
  }

  function handleCardPointerDown(id: string) {
    return (e: React.PointerEvent<HTMLElement>) => {
      if (dragState) return;

      const target = e.target as HTMLElement;
      if (target.closest("a, button")) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}

      const st = cardLongPressRef.current;
      clearCardLongPressTimer();
      st.id = id;
      st.startClientX = e.clientX;
      st.timer = window.setTimeout(() => {
        if (!st.id) return;

        const row = placedRows.find((r) => r.id === st.id);
        if (!row) return;

        // 기준 카드의 시간(자정 보정 포함)
        const rowStart = row.startMin;
        let rowEnd = row.endMin;
        if (rowEnd <= rowStart) rowEnd += 24 * 60;

        const group = placedRows
          .filter((other) => {
            if (other.id === row.id) return true;

            const otherStart = other.startMin;
            let otherEnd = other.endMin;
            if (otherEnd <= otherStart) otherEnd += 24 * 60;

            const overlap =
              !(otherEnd <= rowStart || otherStart >= rowEnd);

            return overlap;
          })
          .sort((a, b) => a.left - b.left);


        const originIndex = group.findIndex((g) => g.id === row.id);
        const groupIds = group.map((g) => g.id);

        setDragState({
          id: row.id,
          groupIds,
          originIndex: originIndex < 0 ? 0 : originIndex,
          startClientX: st.startClientX,
          visualClientX: st.startClientX,
          pointerClientX: st.startClientX,
        });

        setDeleteZoneActive(false);
      }, 400) as any;
    };
  }

  function handleCardPointerMove(id: string) {
    return (e: React.PointerEvent<HTMLElement>) => {
      if (!dragState || dragState.id !== id) return;

      const target = e.target as HTMLElement;
      if (target.closest("a, button")) return;

      e.preventDefault();
      e.stopPropagation();
      const clientX = e.clientX;

      setDragState((prev) => {
        if (!prev || prev.id !== id) return prev;
        const groupSize = prev.groupIds.length;

        if (groupSize <= 1) {
          const rawDelta = clientX - prev.startClientX;

          // 시작 지점 기준으로 좌/우 한계를 픽셀 단위로 클램프
          const clampedDelta = clamp(
            rawDelta,
            -SINGLE_CARD_DRAG_LIMIT_LEFT,
            SINGLE_CARD_DRAG_LIMIT_RIGHT,
          );

          const visualX = prev.startClientX + clampedDelta;

          return {
            ...prev,
            visualClientX: visualX,   // 카드는 한계까지만 이동
            pointerClientX: clientX,  // 포인터 실제 위치는 그대로(DEL 판정용)
          };
        }


        const idx = idxFromSize(groupSize);
        const step = CONF.steps[idx];

        const minOffset = -prev.originIndex;
        const maxOffset = groupSize - 1 - prev.originIndex;

        const rawDelta = clientX - prev.startClientX;
        const minDelta = minOffset * step;
        const maxDelta = maxOffset * step;

        const clampedDelta = clamp(rawDelta, minDelta, maxDelta);
        const visualX = prev.startClientX + clampedDelta;

        return {
          ...prev,
          visualClientX: visualX,
          pointerClientX: clientX,
        };
      });

      if (typeof window !== "undefined") {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const zoneLeft = rect.right - DELETE_ZONE_WIDTH;
          setDeleteZoneActive(clientX >= zoneLeft);
        }
      }
    };
  }

  async function finalizeDrag() {
    if (!dragState) return;

    const {
      id,
      groupIds,
      originIndex,
      startClientX,
      visualClientX,
      pointerClientX,
    } = dragState;

    const groupSize = groupIds.length;

    // 삭제
    if (typeof window !== "undefined") {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const zoneLeft = rect.right - DELETE_ZONE_WIDTH;
        if (pointerClientX >= zoneLeft) {
          setDragState(null);
          setDeleteZoneActive(false);
          await removeFavorite(id);
          return;
        }
      }
    }

    // 정렬 없음
    if (groupSize <= 1) {
      setDragState(null);
      setDeleteZoneActive(false);
      return;
    }

    const idx = idxFromSize(groupSize);
    const step = CONF.steps[idx];
    const delta = visualClientX - startClientX;
    const offset = stepOffset(delta, step);

    let targetIndex = originIndex + offset;
    targetIndex = clamp(targetIndex, 0, groupSize - 1);

    const finalIds = [...groupIds];
    finalIds.splice(originIndex, 1);
    finalIds.splice(targetIndex, 0, id);

    setOrderMap((prev) => {
      const next = new Map(prev);
      finalIds.forEach((sid, index) => {
        next.set(sid, index);
      });
      return next;
    });

    setDragState(null);
    setDeleteZoneActive(false);

    try {
      await Promise.all(
        finalIds.map(async (sid, index) => {
          const priority = getPriority(sid);
          await fetch("/api/favorite-screening", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              screeningId: sid,
              favorite: true,
              priority: priority ?? 0,
              sortOrder: index,
            }),
          });
        }),
      );
    } catch (e) {}
  }

  function handleCardPointerUp(id: string) {
    return async (e: React.PointerEvent<HTMLElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button")) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(
          e.pointerId,
        );
      } catch {}

      clearCardLongPressTimer();

      if (dragState && dragState.id === id) {
        await finalizeDrag();
      } else {
        bringToFront(id);
      }
    };
  }

  function handleCardPointerLeave(id: string) {
    return (e: React.PointerEvent<HTMLElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button")) return;
      e.preventDefault();
      e.stopPropagation();
      clearCardLongPressTimer();
    };
  }

  // ---------------------------------------------------
  // touchmove 방지 (iOS)
  // ---------------------------------------------------
  useEffect(() => {
    if (!dragState) return;
    const block = (e: TouchEvent) => e.preventDefault();
    window.addEventListener("touchmove", block, { passive: false });
    return () => window.removeEventListener("touchmove", block);
  }, [dragState]);

  // ---------------------------------------------------
  // 렌더링
  // ---------------------------------------------------
  const isDraggingAny = !!dragState;

  return (
    <section className="space-y-3">
      <div className="text-sm text-gray-700">{dateLabel}</div>

      {visibleRows.length === 0 && (
        <div className="text-sm text-gray-500 border rounded-lg px-3 py-2">
          No favorite screenings on this day.
        </div>
      )}

      {visibleRows.length > 0 && (
        <div className="mt-1 bg-white px-1.5 py-2">
          <div
            ref={containerRef}
            className="relative"
            style={{
              height: timelineHeight,
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
              touchAction: isDraggingAny ? "none" : "auto",
            }}
          >
            {/* 시간 그리드 */}
            {HOUR_MARKS.map((h) => {
              const minutesFromStart = h * 60 - DAY_START_MIN;
              const top = minutesFromStart * pxPerMin;
              const 강조 = h === 12 || h === 18 || h === 24;

              let labelHour = h;
              if (h > 24) labelHour = h - 24;

              return (
                <div key={h} className="absolute left-0 right-0" style={{ top }}>
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

              const isDragging = dragState?.id === s.id;
              const dragDeltaX =
                isDragging && dragState
                  ? dragState.visualClientX - dragState.startClientX
                  : 0;

              const palette = getPriorityStyles(priority);

              const hasBundle =
                Array.isArray(s.bundleFilms) &&
                s.bundleFilms.length > 1;

              return (
                <article
                  key={s.id}
                  className="absolute rounded-3xl px-3 py-2 shadow-sm text-[10px] overflow-hidden"
                  style={{
                    top: s.top,
                    left: s.left,
                    width: s.width,
                    height: s.height,
                    zIndex: isDragging ? 3000 : s.z,
                    cursor: isDraggingAny ? "grabbing" : "pointer",
                    boxShadow: isDragging
                      ? "0 10px 24px rgba(0,0,0,0.25)"
                      : "0 4px 12px rgba(0,0,0,0.06)",
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: isDragging
                      ? "var(--badge-rated-bg)"
                      : palette.cardBorder,
                    backgroundColor: palette.cardBg,
                    transform: isDragging
                      ? `translateX(${dragDeltaX}px)`
                      : undefined,
                    transition: isDragging
                      ? "none"
                      : "transform 120ms ease-out, box-shadow 120ms ease-out, border-color 120ms ease-out",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    WebkitTouchCallout: "none",
                    touchAction: isDragging ? "none" : "auto",
                  }}
                  onPointerDown={handleCardPointerDown(s.id)}
                  onPointerMove={handleCardPointerMove(s.id)}
                  onPointerUp={handleCardPointerUp(s.id)}
                  onPointerCancel={handleCardPointerUp(s.id)}
                  onPointerLeave={handleCardPointerLeave(s.id)}
                >
                  {/* 시간 + 하트 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[12px] font-semibold text-gray-900 truncate">
                      {s.time}
                    </div>
                    <button
                      type="button"
                      onPointerDown={onHeartPointerDown(s.id)}
                      onPointerUp={onHeartPointerUp(s.id)}
                      onPointerLeave={onHeartPointerLeave()}
                      className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full border bg-white cursor-pointer text-[12px]"
                      style={{
                        borderColor: palette.heartBorder,
                        color: palette.heartColor,
                      }}
                    >
                      <span className="text-[12px] leading-none">♥</span>
                    </button>
                  </div>

                  {/* 상영관 */}
                  <div className="mt-[1px] text-[10px] text-gray-700 truncate">
                    {s.venue}
                  </div>

                  {/* 섹션 */}
                  {s.section && (
                    <div className="mt-[1px] text-[10px] text-gray-500 truncate">
                      {s.section}
                    </div>
                  )}

                  {/* 제목 */}
                  <div className="mt-[1px] text-[12px] font-semibold leading-snug line-clamp-2 break-words">
                    {hasBundle
                      ? s.bundleFilms!.map((bf, idx) => (
                          <span key={bf.filmId}>
                            {idx > 0 && (
                              <span className="mx-[1px] text-[11px] text-gray-700">
                                +{" "}
                              </span>
                            )}
                            <Link
                              href={`/films/${encodeURIComponent(
                                bf.filmId,
                              )}`}
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

                  {/* rating, GV, code */}
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

            {/* 삭제 영역 */}
            {dragState && (
              <div
                className="pointer-events-none absolute right-0 flex items-center justify-center text-[10px]"
                style={{
                  top: deleteZoneTop,
                  height: deleteZoneHeight,
                  width: DELETE_ZONE_WIDTH,
                  borderRadius: 4,
                  zIndex: 5000,
                  backgroundColor: deleteZoneActive
                    ? "rgba(220,38,38,0.40)"
                    : "rgba(148,163,184,0.55)",
                  color: deleteZoneActive ? "#B91C1C" : "#111827",
                  boxShadow: deleteZoneActive
                    ? "0 0 0 1px rgba(220,38,38,0.7)"
                    : "0 0 0 1px rgba(148,163,184,0.7)",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
              >
                <span className="font-semibold text-[11px] leading-none">
                  DEL
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 우선순위 롱프레스 메뉴 */}
      {priorityMenu && (
        <div
          className="fixed inset-0 z-[6000] bg-black/10"
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
              {/* 모드 1 */}
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
                  1
                </span>
              </button>

              {/* 모드 2 */}
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
                  2
                </span>
              </button>

              {/* 기본색 */}
              <button
                type="button"
                className="w-full py-1 text-center hover:bg-gray-50"
                onClick={() =>
                  handlePriorityAction(priorityMenu.screeningId, "normal")
                }
              >
                <span style={{ color: "var(--bar-fill-unrated)" }}>0</span>
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
