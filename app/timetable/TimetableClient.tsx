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

import entriesData from "@/data/entries.json";
import screeningsData from "@/data/screenings.json";

import type { TimetableRow } from "./page";


// ---------------------------------------------------
// 1) 타임라인 설정 (08:00 ~ 27:00 = 다음날 03:00 직전까지)
// ---------------------------------------------------
const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 27 * 60; // 03:00 (레이아웃/표시 기준)
const LOGICAL_DAY_END_MIN = 30 * 60; // 06:00 (Free slot 검색 기준)
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
  steps: [120, 120, 80, 60, 48],
  widths: [] as string[],
};

CONF_PC.widths = makeDefaultWidths(CONF_PC.steps);
CONF_MOBILE.widths = makeDefaultWidths(CONF_MOBILE.steps);

// ---------------------------------------------------
// 삭제존 설정 (오른쪽 끝 32px 카드형 DEL)
// ---------------------------------------------------
const DELETE_ZONE_WIDTH = 32;

const SINGLE_CARD_DRAG_LIMIT_LEFT = 10;
const SINGLE_CARD_DRAG_LIMIT_RIGHT = 40;

// ---------------------------------------------------
// 유틸
// ---------------------------------------------------
function groupByOverlap(list: TimetableRow[]): TimetableRow[][] {
  if (!list.length) return [];

  const sorted = [...list].sort((a, b) => a.startMin - b.startMin);

  const groups: TimetableRow[][] = [];
  let cur: TimetableRow[] = [];
  let curEnd = -1;

  for (const row of sorted) {
    const rowStart = row.startMin;
    const rawEnd = row.endMin;
    const rowEnd = rawEnd <= rowStart ? rawEnd + 24 * 60 : rawEnd;

    if (!cur.length) {
      cur = [row];
      curEnd = rowEnd;
      groups.push(cur);
      continue;
    }

    if (rowStart < curEnd) {
      cur.push(row);
      if (rowEnd > curEnd) curEnd = rowEnd;
    } else {
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
  if (r >= 0) return Math.round(r);
  return Math.ceil(r);
}

// ISO 문자열(상영 시작/종료)을 타임테이블 절대 분(08:00~27:00 기준)으로 변환
function isoToAbsMinutes(dateTime: string): number {
  const d = new Date(dateTime);
  const h = d.getHours();
  const m = d.getMinutes();
  const base = h * 60 + m;

  // 00:00~07:59 는 다음날 새벽으로 취급 → +24시간
  if (base < DAY_START_MIN) {
    return base + 24 * 60;
  }
  return base;
}

function absMinutesToHm(abs: number): string {
  const total = ((abs % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

type SlotCountScreening = {
  startAbs: number;
  endAbs: number;
};

function countScreeningsForSlot(
  list: SlotCountScreening[],
  slotStart: number,
  slotEnd: number,
): number {
  let n = 0;
  for (const s of list) {
    if (s.startAbs >= slotStart && s.endAbs <= slotEnd) {
      n += 1;
    }
  }
  return n;
}

// 상영 카드용 시작/종료 시간 라벨 생성
type TimeRangeInfo = {
  startLabel: string;
  endLabel: string | null;
  isEndEstimated: boolean;
};

function getTimeRangeInfo(row: TimetableRow): TimeRangeInfo {
  const startLabel = row.time ?? absMinutesToHm(row.startMin);

  let endLabel: string | null = null;
  let isEndEstimated = false;

  // 실제 endsAt가 있는 경우 → 정확한 종료 시각
  const rawEndsAt = (row as any).endsAt as string | null | undefined;

  if (rawEndsAt && typeof rawEndsAt === "string") {
    const endAbs = isoToAbsMinutes(rawEndsAt);
    endLabel = absMinutesToHm(endAbs);
  } else if (typeof (row as any).runtimeMin === "number") {
    // endsAt 없고 runtime을 더해 추정한 경우
    const runtime = (row as any).runtimeMin as number;
    const endAbs = row.startMin + runtime;
    endLabel = absMinutesToHm(endAbs);
    isEndEstimated = true;
  } else if (typeof row.endMin === "number") {
    // fallback: 미리 계산된 endMin 사용
    endLabel = absMinutesToHm(row.endMin);
  }

  return { startLabel, endLabel, isEndEstimated };
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

type ViewMode = "my" | "full" | "grid";

type CompressSegment = {
  start: number;
  end: number;
  busy: boolean;
  top: number;
  bottom: number;
  height: number;
};

type FreeSlot = {
  startAbs: number;
  endAbs: number;
  top: number;
  height: number;
};

type CompressionConfig = {
  toY: (absMin: number) => number;
  toHeight: (startAbs: number, endAbs: number) => number;
  height: number;
  freeSlots: FreeSlot[];
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

  const containerRef = useRef<HTMLDivElement | null>(null);

  // 현재 에디션 id (screenings 링크용)
  const editionId = rows[0]?.editionId ?? "";

  // ---------------------------------------------------
  // 상태
  // ---------------------------------------------------
  const [viewMode, setViewMode] = useState<ViewMode>("my");

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
  // 압축 타임라인 (My Day 뷰)
  // ---------------------------------------------------
  const compression: CompressionConfig = useMemo(() => {
    // Full Day / Grid 이거나 상영이 없으면 선형
    const makeLinear = (): CompressionConfig => {
      const toY = (absMin: number) =>
        (clamp(absMin, DAY_START_MIN, DAY_END_MIN) - DAY_START_MIN) *
        pxPerMin;
      const toHeight = (startAbs: number, endAbs: number) => {
        const s = clamp(startAbs, DAY_START_MIN, DAY_END_MIN);
        const e = clamp(endAbs, DAY_START_MIN, DAY_END_MIN);
        const duration = Math.max(e - s, 40);
        return duration * pxPerMin;
      };
      return {
        toY,
        toHeight,
        height: TOTAL_MIN * pxPerMin,
        freeSlots: [],
      };
    };

    if (viewMode !== "my" || visibleRows.length === 0) {
      return makeLinear();
    }

    // busy interval 수집
    const busy: { start: number; end: number }[] = [];

    for (const r of visibleRows) {
      let start = r.startMin;
      let end = r.endMin;
      if (end <= start) end += 24 * 60;

      start = clamp(start, DAY_START_MIN, DAY_END_MIN);
      end = clamp(end, DAY_START_MIN, DAY_END_MIN);
      if (end <= start) continue;
      busy.push({ start, end });
    }

    if (!busy.length) return makeLinear();

    busy.sort((a, b) => a.start - b.start);

    const merged: { start: number; end: number }[] = [];
    let cur = busy[0];
    for (let i = 1; i < busy.length; i++) {
      const next = busy[i];
      if (next.start <= cur.end) {
        cur.end = Math.max(cur.end, next.end);
      } else {
        merged.push(cur);
        cur = next;
      }
    }
    merged.push(cur);

    const segments: CompressSegment[] = [];
    let cursor = DAY_START_MIN;

    const BUSY_RATE = 1.0;
    const FREE_RATE = 0.25;

    let acc = 0;

    for (const iv of merged) {
      if (iv.start > cursor) {
        const start = cursor;
        const end = iv.start;
        const dur = end - start || 1;
        let height = dur * pxPerMin * FREE_RATE;
        if (height < 14) height = 14;
        segments.push({
          start,
          end,
          busy: false,
          top: acc,
          bottom: acc + height,
          height,
        });
        acc += height;
      }

      const start = iv.start;
      const end = iv.end;
      const dur = end - start || 1;
      let height = dur * pxPerMin * BUSY_RATE;
      if (height < 40) height = 40;
      segments.push({
        start,
        end,
        busy: true,
        top: acc,
        bottom: acc + height,
        height,
      });
      acc += height;
      cursor = iv.end;
    }

    if (cursor < DAY_END_MIN) {
      const start = cursor;
      const end = DAY_END_MIN;
      const dur = end - start || 1;
      let height = dur * pxPerMin * FREE_RATE;
      if (height < 14) height = 14;
      segments.push({
        start,
        end,
        busy: false,
        top: acc,
        bottom: acc + height,
        height,
      });
      acc += height;
    }

    const toY = (absMin: number) => {
      const t = clamp(absMin, DAY_START_MIN, DAY_END_MIN);
      for (const seg of segments) {
        if (t <= seg.start) return seg.top;
        if (t >= seg.end) continue;
        const ratio =
          (t - seg.start) / (seg.end - seg.start || 1);
        return seg.top + ratio * seg.height;
      }
      return segments.length ? segments[segments.length - 1].bottom : 0;
    };

    const toHeight = (startAbs: number, endAbs: number) => {
      const s = clamp(startAbs, DAY_START_MIN, DAY_END_MIN);
      const e = clamp(endAbs, DAY_START_MIN, DAY_END_MIN);
      const h = Math.max(toY(e) - toY(s), 40);
      return h;
    };

    const freeSlots: FreeSlot[] = segments
      .filter((seg) => !seg.busy && seg.end - seg.start >= 20)
      .map((seg) => ({
        startAbs: seg.start,
        endAbs: seg.end,
        top: seg.top,
        height: seg.height,
      }));

    // 마지막 free slot 종료 논리 시간만 06:00으로 확장
    if (freeSlots.length > 0) {
      const last = freeSlots[freeSlots.length - 1];
      if (last.endAbs === DAY_END_MIN) {
        last.endAbs = LOGICAL_DAY_END_MIN;
      }
    }

    return {
      toY,
      toHeight,
      height: acc,
      freeSlots,
    };

  }, [viewMode, visibleRows, pxPerMin]);

  // Full Day 모드에서 사용할 free slot (선형 타임라인 기준)
  const fullFreeSlots: FreeSlot[] = useMemo(() => {
    if (visibleRows.length === 0) return [];

    const busy: { start: number; end: number }[] = [];

    for (const r of visibleRows) {
      let start = r.startMin;
      let end = r.endMin;
      if (end <= start) end += 24 * 60;

      start = clamp(start, DAY_START_MIN, DAY_END_MIN);
      end = clamp(end, DAY_START_MIN, DAY_END_MIN);
      if (end <= start) continue;
      busy.push({ start, end });
    }

    if (!busy.length) {
      const height = (DAY_END_MIN - DAY_START_MIN) * pxPerMin;
      return [
        {
          startAbs: DAY_START_MIN,
          endAbs: LOGICAL_DAY_END_MIN,
          top: 0,
          height,
        },
      ];
    }


    busy.sort((a, b) => a.start - b.start);

    const merged: { start: number; end: number }[] = [];
    let cur = busy[0];
    for (let i = 1; i < busy.length; i++) {
      const next = busy[i];
      if (next.start <= cur.end) {
        cur.end = Math.max(cur.end, next.end);
      } else {
        merged.push(cur);
        cur = next;
      }
    }
    merged.push(cur);

    const free: FreeSlot[] = [];
    let cursor = DAY_START_MIN;

    for (const iv of merged) {
      if (iv.start > cursor) {
        const start = cursor;
        const end = iv.start;
        const dur = end - start;
        if (dur >= 20) {
          const top = (start - DAY_START_MIN) * pxPerMin;
          const height = Math.max(dur * pxPerMin, 24);
          free.push({ startAbs: start, endAbs: end, top, height });
        }
      }
      cursor = Math.max(cursor, iv.end);
    }

    if (cursor < DAY_END_MIN) {
      const start = cursor;
      const end = DAY_END_MIN;
      const dur = end - start;
      if (dur >= 20) {
        const top = (start - DAY_START_MIN) * pxPerMin;
        const height = Math.max(dur * pxPerMin, 24);
        free.push({ startAbs: start, endAbs: end, top, height });
      }
    }

    // 마지막 free slot 종료 논리 시간만 06:00으로 확장
    if (free.length > 0) {
      const last = free[free.length - 1];
      if (last.endAbs === DAY_END_MIN) {
        last.endAbs = LOGICAL_DAY_END_MIN;
      }
    }

    return free;

  }, [visibleRows, pxPerMin]);

  const timelineHeight = compression.height;


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

      // 정렬: order → code → startMin
      meta.sort((a, b) => {
        const oa = a.order;
        const ob = b.order;

        if (oa != null && ob != null && oa !== ob) return oa - ob;
        if (oa != null && ob == null) return -1;
        if (oa == null && ob != null) return 1;

        const ca = parseInt(a.row.code ?? "0", 10);
        const cb = parseInt(b.row.code ?? "0", 10);
        if (!Number.isNaN(ca) && !Number.isNaN(cb) && ca !== cb) {
          return ca - cb;
        }

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
        let start = row.startMin;
        let end = row.endMin;
        if (end <= start) end += 1440;

        const startClamped = Math.max(start, DAY_START_MIN);
        const endClamped = Math.min(end, DAY_END_MIN);
        const duration = Math.max(endClamped - startClamped, 40);

        const top =
          viewMode === "my"
            ? compression.toY(startClamped)
            : (startClamped - DAY_START_MIN) * pxPerMin;
        const height =
          viewMode === "my"
            ? compression.toHeight(startClamped, endClamped)
            : duration * pxPerMin;

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

        const left = isSingle
          ? baseLeftPx
          : baseLeftPx + visualIndex * step;

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
    viewMode,
    compression,
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
  // 날짜 / 요약 라벨
  // ---------------------------------------------------
  const dateSummaryLabel = useMemo(() => {
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

          const clampedDelta = clamp(
            rawDelta,
            -SINGLE_CARD_DRAG_LIMIT_LEFT,
            SINGLE_CARD_DRAG_LIMIT_RIGHT,
          );

          const visualX = prev.startClientX + clampedDelta;

          return {
            ...prev,
            visualClientX: visualX,
            pointerClientX: clientX,
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
  // Free slot 클릭 → Screenings 새 탭
  //   - 시간 범위(start/end)만 전달, free slot 전용 필터(gap)는 사용하지 않음
  // ---------------------------------------------------
  function openFreeSlotInScreenings(startAbs: number, endAbs: number) {
    if (!editionId) return;
    const startHm = absMinutesToHm(startAbs);
    const endHm = absMinutesToHm(endAbs);

    const params = new URLSearchParams();
    params.set("edition", editionId);
    params.set("date", dateIso);
    params.set("start", startHm);
    params.set("end", endHm);
    // params.set("gap", "1"); // 제거

    const url = `/screenings?${params.toString()}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener");
    }
  }


  // ---------------------------------------------------
  // Free slot용 상영 개수 데이터 (에디션+날짜 기준)
  //   - 다중상영(A+B+C+D)은 1개의 screening으로 카운트
  // ---------------------------------------------------
  const allScreeningsForCount = useMemo(
    () => {
      if (!editionId) return [] as SlotCountScreening[];

      const entriesById = new Map<string, any>();
      (entriesData as any[]).forEach((e: any) => {
        if (!e || !e.id) return;
        entriesById.set(e.id, e);
      });

      // key(동일 상영 그룹) → SlotCountScreening
      const map = new Map<string, SlotCountScreening>();

      (screeningsData as any[]).forEach((s: any) => {
        const entry = entriesById.get(s.entryId);
        if (!entry) return;

        // 같은 에디션만 사용
        if (entry.editionId !== editionId) return;

        if (!s.startsAt || typeof s.startsAt !== "string") return;

        // 날짜가 다르면 제외 (YYYY-MM-DD 기준)
        if (dateIso && s.startsAt.slice(0, 10) !== dateIso) return;

        // 다중상영을 하나로 묶기 위한 그룹 키
        // code + venue + startsAt 기준으로 1개 상영으로 본다
        const keyParts: string[] = [];
        if (s.code != null) keyParts.push(String(s.code));
        else if (s.id != null) keyParts.push(String(s.id));
        else keyParts.push(String(s.entryId));
        keyParts.push(String(s.venue ?? ""));
        keyParts.push(String(s.startsAt));
        const key = keyParts.join("|");

        const startAbs = isoToAbsMinutes(s.startsAt);

        let endAbs = startAbs + 120;
        if (typeof s.endsAt === "string" && s.endsAt) {
          endAbs = isoToAbsMinutes(s.endsAt);
        }

        // 자정 넘김 처리
        if (endAbs <= startAbs) {
          endAbs += 24 * 60;
        }

        const existing = map.get(key);
        if (!existing) {
          map.set(key, { startAbs, endAbs });
        } else {
          // 혹시 시작/끝이 약간 다른 데이터가 섞여 있으면 범위를 넓게 잡는다
          if (startAbs < existing.startAbs) existing.startAbs = startAbs;
          if (endAbs > existing.endAbs) existing.endAbs = endAbs;
        }
      });

      return Array.from(map.values());
    },
    [editionId, dateIso],
  );

  // ---------------------------------------------------
  // Grid view 데이터 (겹침 그룹 + x축 겹침 레이아웃용 메타)
  //  - groupByOverlap(visibleRows) 그대로 사용
  //  - 각 그룹의 label 시간은 해당 그룹에서 가장 이른 startMin
  //  - cards: 같은 시간대 상영을 x축으로 겹쳐 배치하기 위한 left / width / z 포함
  //  - width/left는 My Day / Full Day와 동일한 step 로직(CONF.steps, idxFromSize) 사용
  //  - zOverrides를 반영해 클릭 시 맨 앞으로 나오도록 처리
  // ---------------------------------------------------
  const gridGroups = useMemo(() => {
    if (visibleRows.length === 0) return [];

    // 겹침 기준으로 그룹화 (My/Full과 동일)
    const groups = groupByOverlap(visibleRows);

    const mapped = groups.map((group) => {
      // Timetable과 동일한 정렬 기준: order → code → startMin
      let meta = group.map((row) => ({
        row,
        priority: getPriority(row.id),
        order: getOrder(row.id),
      }));

      meta.sort((a, b) => {
        const oa = a.order;
        const ob = b.order;

        if (oa != null && ob != null && oa !== ob) return oa - ob;
        if (oa != null && ob == null) return -1;
        if (oa == null && ob != null) return 1;

        const ca = parseInt(a.row.code ?? "0", 10);
        const cb = parseInt(b.row.code ?? "0", 10);
        if (!Number.isNaN(ca) && !Number.isNaN(cb) && ca !== cb) {
          return ca - cb;
        }

        return a.row.startMin - b.row.startMin;
      });

      if (meta.length === 0) {
        return {
          startAbs: DAY_START_MIN,
          cards: [] as {
            row: TimetableRow;
            left: number;
            width: string;
            z: number;
          }[],
        };
      }

      const startAbs = meta[0].row.startMin;
      const size = meta.length;

      const idx = idxFromSize(size);
      const step = CONF.steps[idx];
      // 겹치는 개수(size)에 따라 카드 폭이 줄어들도록 설정
      const width = `calc(100% - ${step * (size - 1)}px)`;

      // 드래그 중일 때 List에서도 옆 카드가 밀리도록 시각적 인덱스 계산
      let dragInfo: {
        dragId: string;
        originIndex: number;
        newIndex: number;
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
          };
        }
      }

      const cards = meta.map(({ row, priority }, baseIndex) => {
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

        let zBase = 100 + (size - baseIndex);
        if (priority === 1) zBase += 100;
        else if (priority === 2) zBase += 50;

        let z = zBase;
        const override = zOverrides.get(row.id);
        if (override != null) z = 1000 + override;

        const left = visualIndex * step;

        return {
          row,
          left,
          width,
          z,
        };
      });

      return { startAbs, cards };
    });

    // 그룹 자체도 시작 시간 기준으로 정렬
    mapped.sort((a, b) => a.startAbs - b.startAbs);

    return mapped;
  }, [visibleRows, priorityMap, orderMap, CONF.steps, zOverrides, dragState]);






  // ---------------------------------------------------
  // 렌더링
  // ---------------------------------------------------
  const isDraggingAny = !!dragState;

  const freeSlotsToRender =
    viewMode === "my"
      ? compression.freeSlots
      : viewMode === "full"
      ? fullFreeSlots
      : [];

  const viewLabel = (mode: ViewMode) =>
    mode === "my"
      ? "My Day"
      : mode === "full"
      ? "Full Day"
      : "List";


  const viewBtnClass = (mode: ViewMode) =>
    "px-2.5 py-1 rounded-full text-[11px] border cursor-pointer whitespace-nowrap " +
    (viewMode === mode
      ? "bg-black text-white border-black"
      : "bg-white text-gray-700 border-gray-300");


  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm text-gray-700">{dateSummaryLabel}</div>
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-1 py-0.5 border border-gray-200">
            <button
              type="button"
              className={viewBtnClass("my")}
              onClick={() => setViewMode("my")}
            >
              {viewLabel("my")}
            </button>
            <button
              type="button"
              className={viewBtnClass("full")}
              onClick={() => setViewMode("full")}
            >
              {viewLabel("full")}
            </button>
            <button
              type="button"
              className={viewBtnClass("grid")}
              onClick={() => setViewMode("grid")}
            >
              {viewLabel("grid")}
            </button>
          </div>
        </div>
      </div>


      {visibleRows.length === 0 && (
        <div className="text-sm text-gray-500 border rounded-lg px-3 py-2">
          No favorite screenings on this day.
        </div>
      )}

      {/* 메인 타임라인 (My Day / Full Day) */}
      {visibleRows.length > 0 && viewMode !== "grid" && (
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
              const abs = h * 60;
              if (abs < DAY_START_MIN || abs > DAY_END_MIN) return null;

              const top =
                viewMode === "my"
                  ? compression.toY(abs)
                  : (abs - DAY_START_MIN) * pxPerMin;

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

            {/* Free Slot 리본 (My Day / Full Day 공통) */}
            {(viewMode === "my" || viewMode === "full") &&
              freeSlotsToRender.map((slot, idx) => {
                const availableCount = countScreeningsForSlot(
                  allScreeningsForCount,
                  slot.startAbs,
                  slot.endAbs,
                );

                const clickable = availableCount > 0;

                return (
                  <button
                    key={`${slot.startAbs}-${idx}`}
                    type="button"
                    disabled={!clickable}
                    className={[
                      "absolute rounded-2xl border border-dashed",
                      "flex items-center justify-between",
                      "px-3",
                      "text-[13px] leading-none",
                      clickable
                        ? "bg-gray-50/80 text-gray-900 cursor-pointer hover:bg-gray-100"
                        : "bg-gray-100/80 text-gray-900 cursor-default opacity-70",
                    ].join(" ")}
                    style={{
                      top: slot.top + 4,
                      height: Math.max(slot.height - 8, 24),
                      left: baseLeftPx,
                      right: GRID_RIGHT_PADDING,
                      zIndex: 10,
                    }}
                    onClick={
                      clickable
                        ? () =>
                            openFreeSlotInScreenings(
                              slot.startAbs,
                              slot.endAbs,
                            )
                        : undefined
                    }
                  >
                    <span className="truncate">
                      Free slot{" "}
                      {absMinutesToHm(slot.startAbs)} ~{" "}
                      {absMinutesToHm(slot.endAbs)}
                    </span>
                    <span className="ml-2 text-[11px] font-semibold">
                      {availableCount > 0
                        ? `${availableCount} screenings fit`
                        : "No screening fit"}
                    </span>
                  </button>
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

              const { startLabel, endLabel, isEndEstimated } =
                getTimeRangeInfo(s);

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
                    <div className="flex-1 text-[12px] font-semibold text-gray-900 truncate">
                      <span>{startLabel}</span>
                      {endLabel && (
                        <>
                          <span> ~ </span>
                          <span
                            className={
                              isEndEstimated
                                ? "text-gray-400"
                                : "text-gray-900"
                            }
                          >
                            {endLabel}
                          </span>
                        </>
                      )}
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

      {/* Grid View (겹침 그룹 요약) */}
      {visibleRows.length > 0 && viewMode === "grid" && (
        <div
          ref={containerRef}
          className="mt-2 bg-white border rounded-lg px-2 py-2 space-y-2 relative"
        >
          {gridGroups.map((group, idx) => (
            <div
              key={`${group.startAbs}-${idx}`}
              className="flex items-start gap-2 border-b border-dashed border-gray-200 pb-2 last:border-b-0"
            >
              {/* 이 클러스터에서 가장 이른 시작 시간만 표시 */}
              <div className="w-[52px] text-[10px] text-right pt-1 text-gray-500">
                {absMinutesToHm(group.startAbs)}
              </div>

              {/* 오른쪽: 같은 시간대 상영 카드들을 x축으로 겹쳐서 표시 */}
              <div
                className="relative flex-1 py-1"
                style={{ minHeight: 80 }}
              >
                {group.cards.map(({ row, left, width, z }) => {
                  const s = row;
                  const priority = getPriority(s.id);
                  const palette = getPriorityStyles(priority);

                  const { startLabel, endLabel, isEndEstimated } =
                    getTimeRangeInfo(s);

                  const cityLabel =
                    (s as any).city && typeof (s as any).city === "string"
                      ? (s as any).city
                      : null;

                  const hasBundle =
                    Array.isArray(s.bundleFilms) &&
                    s.bundleFilms.length > 1;

                  const isDragging = dragState?.id === s.id;
                  const dragDeltaX =
                    isDragging && dragState
                      ? dragState.visualClientX - dragState.startClientX
                      : 0;


                  return (
                    <article
                      key={s.id}
                      className="absolute rounded-2xl px-2 py-1 text-[10px] shadow-sm overflow-hidden"
                      style={{
                        top: 0,
                        left,
                        zIndex: isDragging ? 3000 : z,
                        width,
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
                        cursor: isDraggingAny ? "grabbing" : "pointer",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        WebkitTouchCallout: "none",
                        touchAction: isDragging ? "none" : "auto",
                        boxShadow: isDragging
                          ? "0 10px 24px rgba(0,0,0,0.25)"
                          : "0 4px 12px rgba(0,0,0,0.06)",
                      }}
                      onPointerDown={handleCardPointerDown(s.id)}
                      onPointerMove={handleCardPointerMove(s.id)}
                      onPointerUp={handleCardPointerUp(s.id)}
                      onPointerCancel={handleCardPointerUp(s.id)}
                      onPointerLeave={handleCardPointerLeave(s.id)}
                    >
                      {/* 시작시간 + 하트 */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex-1 text-[11px] font-semibold text-gray-900 truncate">
                          <span>{startLabel}</span>
                          {endLabel && (
                            <>
                              <span> ~ </span>
                              <span
                                className={
                                  isEndEstimated
                                    ? "text-gray-400"
                                    : "text-gray-900"
                                }
                              >
                                {endLabel}
                              </span>
                            </>
                          )}
                        </span>
                        <button
                          type="button"
                          onPointerDown={onHeartPointerDown(s.id)}
                          onPointerUp={onHeartPointerUp(s.id)}
                          onPointerLeave={onHeartPointerLeave()}
                          className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full border bg-white cursor-pointer text-[11px]"
                          style={{
                            borderColor: palette.heartBorder,
                            color: palette.heartColor,
                          }}
                        >
                          ♥
                        </button>
                      </div>


                      {/* Venue */}
                      <div className="mt-[1px] text-[10px] text-gray-700 truncate">
                        {s.venue}
                      </div>

                      {/* 영화 제목 (단일/다중 상영 공통) */}
                      <div className="mt-[1px] text-[11px] font-semibold leading-snug line-clamp-1 break-words">
                        {hasBundle
                          ? s.bundleFilms!.map((bf, bundleIdx) => (
                              <span key={bf.filmId}>
                                {bundleIdx > 0 && (
                                  <span className="mx-[1px] text-[10px] text-gray-700">
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

                      {/* 장소(city) + code */}
                      {(cityLabel || s.code) && (
                        <div className="mt-[1px] flex items-center justify-between text-[9px] text-gray-600">
                          <div className="truncate">
                            {cityLabel && <span>{cityLabel}</span>}
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
          ))}

          {/* Grid 뷰용 삭제 영역 (오른쪽 전체 높이 DEL 컬럼) */}
          {dragState && (
            <div
              className="pointer-events-none absolute right-0 flex items-center justify-center text-[10px]"
              style={{
                top: 0,
                height: "100%",
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
              <button
                type="button"
                className="w-full py-1 text-center hover:bg-gray-50"
                onClick={() =>
                  handlePriorityAction(priorityMenu.screeningId, "normal")
                }
              >
                <span style={{ color: "var(--bar-fill-unrated)" }}>0</span>
              </button>
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
