// app/timetable/logic.ts
import { TimetableRow } from "./page";
import { clamp } from "@/lib/utils";

// ---------------------------------------------------
// 상수 설정
// ---------------------------------------------------
export const DAY_START_MIN = 8 * 60;
export const DAY_END_MIN = 27 * 60; // 03:00
export const LOGICAL_DAY_END_MIN = 30 * 60; // 06:00
export const TOTAL_MIN = DAY_END_MIN - DAY_START_MIN;

export const PX_PER_MIN_PC = 2.0;
export const PX_PER_MIN_MOBILE = 2.0;

export const LABEL_COL_WIDTH = 32;
export const GRID_GAP_LEFT = 8;
export const GRID_RIGHT_PADDING = 5;

export const BASE_LEFT_PX = LABEL_COL_WIDTH + GRID_GAP_LEFT;
export const BASE_PADDING_PX = BASE_LEFT_PX + GRID_RIGHT_PADDING;

export const HOUR_MARKS: number[] = [];
for (let h = 8; h <= 26; h++) HOUR_MARKS.push(h);

export const DELETE_ZONE_WIDTH = 32;
export const SINGLE_CARD_DRAG_LIMIT_LEFT = 10;
export const SINGLE_CARD_DRAG_LIMIT_RIGHT = 40;

// ---------------------------------------------------
// 레이아웃 계산 유틸
// ---------------------------------------------------
export function makeDefaultWidths(steps: number[]) {
  const arr: string[] = [];
  for (let i = 0; i < 5; i++) {
    const sizeIndex = i;
    const step = steps[i];
    const minus = BASE_PADDING_PX + step * sizeIndex;
    arr.push(`calc(100% - ${minus}px)`);
  }
  return arr;
}

export const CONF_PC = {
  steps: [150, 143, 95, 66, 54],
  widths: [] as string[],
};

export const CONF_MOBILE = {
  steps: [120, 120, 80, 60, 48],
  widths: [] as string[],
};

CONF_PC.widths = makeDefaultWidths(CONF_PC.steps);
CONF_MOBILE.widths = makeDefaultWidths(CONF_MOBILE.steps);

export function groupByOverlap(list: TimetableRow[]): TimetableRow[][] {
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

export function idxFromSize(size: number) {
  return size >= 5 ? 4 : size - 1;
}

export function stepOffset(delta: number, step: number) {
  const r = delta / step;
  if (r >= 0) return Math.round(r);
  return Math.ceil(r);
}

// ISO 문자열 -> 절대 분(08:00~27:00 기준)
export function isoToAbsMinutes(dateTime: string): number {
  const d = new Date(dateTime);
  const h = d.getHours();
  const m = d.getMinutes();
  const base = h * 60 + m;

  if (base < DAY_START_MIN) {
    return base + 24 * 60;
  }
  return base;
}

export function absMinutesToHm(abs: number): string {
  const total = ((abs % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export type SlotCountScreening = {
  startAbs: number;
  endAbs: number;
};

export function countScreeningsForSlot(
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

// 상영 카드용 라벨 정보
export type TimeRangeInfo = {
  startLabel: string;
  endLabel: string | null;
  isEndEstimated: boolean;
};

export function getTimeRangeInfo(row: TimetableRow): TimeRangeInfo {
  const startLabel = row.time ?? absMinutesToHm(row.startMin);

  let endLabel: string | null = null;
  let isEndEstimated = false;

  const rawEndsAt = (row as any).endsAt as string | null | undefined;

  if (rawEndsAt && typeof rawEndsAt === "string") {
    const endAbs = isoToAbsMinutes(rawEndsAt);
    endLabel = absMinutesToHm(endAbs);
  } else if (typeof (row as any).runtimeMin === "number") {
    const runtime = (row as any).runtimeMin as number;
    const endAbs = row.startMin + runtime;
    endLabel = absMinutesToHm(endAbs);
    isEndEstimated = true;
  } else if (typeof row.endMin === "number") {
    endLabel = absMinutesToHm(row.endMin);
  }

  return { startLabel, endLabel, isEndEstimated };
}

// ---------------------------------------------------
// 스타일 유틸
// ---------------------------------------------------
export type Priority = 0 | 1 | 2;
export type PriorityOrNull = Priority | null;

export function getPriorityStyles(priority: PriorityOrNull) {
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

export function getNextPriority(p: PriorityOrNull): Priority {
  if (p === 0 || p === null) return 1;
  if (p === 1) return 2;
  return 0;
}