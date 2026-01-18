// app/screenings/ScreeningsClient.tsx
"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import filmsData from "@/data/films.json";
import entriesData from "@/data/entries.json";
import screeningsData from "@/data/screenings.json";

// [Refactor] 공용 유틸 import
import { 
  setQuery, parseCsv, buildCsv, 
  ymd, hm, weekdayKFromISO, mdK, clamp 
} from "@/lib/utils";

type Film = {
  id: string;
  title: string;
  title_ko?: string;
  title_en?: string;
  year: number;
  countries?: string[];
  runtime?: number;
  genres?: string[];
};

type Entry = {
  id: string;
  filmId: string;
  editionId: string;
  section?: string | null;
  format?: string | null;
  color?: string | null;
  premiere?: string | null;
};

type Screening = {
  id: string;
  entryId: string;
  code?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  venue?: string | null;
  city?: string | null;
  withGV?: boolean | null;
  dialogue?: string | null;
  subtitles?: string | null;
  rating?: string | null;
};

type BundleFilm = {
  filmId: string;
  title: string;
};

type ScreeningRow = {
  id: string;
  filmId: string;
  filmTitle: string;
  editionId: string;
  section?: string | null;
  date: string;
  time: string;
  endTime: string | null;
  endEstimated: boolean;
  venue: string;
  code?: string | null;
  withGV?: boolean | null;
  dialogue?: string | null;
  subtitles?: string | null;
  rating?: string | null;
  startBand: number;
  endBand: number;
  bundleFilms?: BundleFilm[];
};

const films = filmsData as Film[];
const entries = entriesData as Entry[];
const screenings = screeningsData as Screening[];

const DEFAULT_EDITION = "edition_jiff_2025";

const EDITION_LABEL: Record<string, string> = {
  edition_jiff_2025: "JIFF2025",
  edition_biff_2025: "BIFF2025",
};

const PAGE_SIZE = 20;

function buildBundleKey(editionId: string | undefined, code?: string | null) {
  const c = (code ?? "").trim();
  if (!editionId || !c) return null;
  return `${editionId}__${c}`;
}

function parseHmToMin(s: string | null): number | null {
  if (!s) return null;
  const parts = s.split(":");
  if (parts.length !== 2) return null;
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function makeBadges(
  rating?: string | null,
  lang?: string | null,
  withGV?: boolean | null,
) {
  const out: Array<{ key: string; type: "rating" | "lang" | "gv"; label: string }> = [];
  const r = (rating ?? "").trim();
  const l = (lang ?? "").trim();
  if (r) out.push({ key: `r:${r}`, type: "rating", label: r });
  if (l) out.push({ key: `l:${l}`, type: "lang", label: l });
  if (withGV) out.push({ key: "gv", type: "gv", label: "GV" });
  return out;
}

function badgeClass(t: "rating" | "lang" | "gv", label: string) {
  const isCircle = (label?.length ?? 0) <= 2;
  const base = "inline-flex items-center justify-center border leading-none";
  const font = isCircle ? " text-[10px]" : " text-[11px]";
  const weight = t === "rating" ? " font-medium" : t === "gv" ? " font-semibold" : "";

  if (isCircle) {
    return base + font + weight + " rounded-full h-6 w-6 p-0";
  }
  return base + font + weight + " rounded-full h-6 px-2";
}

function makeLangLabel(
  dialogue?: string | null,
  subtitles?: string | null,
  editionId?: string,
) {
  const d = (dialogue ?? "").trim();
  const s = (subtitles ?? "").trim();

  // JIFF: X는 숨기고 d/s 조합
  if (editionId?.startsWith("edition_jiff_")) {
    const dShow = d && d !== "X" ? d : "";
    const sShow = s && s !== "X" ? s : "";
    if (dShow && sShow) return `${dShow}/${sShow}`;
    return dShow || sShow || "";
  }

  // BIFF: Y -> KE, N/빈값 -> 없음, 그 외 그대로
  if (editionId?.startsWith("edition_biff_")) {
    const markRaw = (s || d || "").trim().toUpperCase();
    if (!markRaw || markRaw === "N") return "";
    if (markRaw === "Y") return "KE";
    return markRaw;
  }

  if (d && s) return `${d}/${s}`;
  return d || s || "";
}

// Time range 헬퍼 (06:00 기준)
const DAY_MINUTES = 24 * 60;
const BASE_MIN = 6 * 60; // 06:00

function hmFromMinutes(m: number): string {
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// 06:00 기준 band 분 (0~1439)
function hmToBandMinutes(hmStr: string | null): number | null {
  if (!hmStr) return null;
  const abs = parseHmToMin(hmStr);
  if (abs == null) return null;
  let v = abs - BASE_MIN;
  if (v < 0) v += DAY_MINUTES;
  return v;
}

// band → HH:MM
function bandMinutesToHm(band: number): string {
  if (band <= 0) return "06:00";
  if (band >= DAY_MINUTES) return "06:00";
  const abs = (band + BASE_MIN) % DAY_MINUTES;
  return hmFromMinutes(abs);
}

// 필터용: start/end 시각을 band 구간으로 변환 (심야 23:00~06:00 지원)
function getBandRangeForFilter(start?: string, end?: string) {
  if (!start || !end) {
    return { start: null as number | null, end: null as number | null };
  }

  const sBand = hmToBandMinutes(start);
  const eBandRaw = hmToBandMinutes(end);

  if (sBand == null || eBandRaw == null) {
    return { start: null, end: null };
  }

  let eBand = eBandRaw;
  if (eBand <= sBand) {
    // 23:00~06:00 같은 케이스 → 다음날 06:00
    eBand += DAY_MINUTES;
  }

  return { start: sBand, end: eBand };
}

type TimeRangeFilterProps = {
  start: string | undefined;
  end: string | undefined;
  gapOnly: boolean;
  onRangeChange: (start: string | undefined, end: string | undefined) => void;
  onGapToggle: () => void;
};

function TimeRangeFilter({
  start,
  end,
  gapOnly,
  onRangeChange,
  onGapToggle,
}: TimeRangeFilterProps) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<null | "start" | "end">(null);
  const ignoreClickRef = useRef(false);
  const bandsRef = useRef({ start: 0, end: DAY_MINUTES });
  const commitTimerRef = useRef<number | null>(null);

  const lockScroll = () => {
    try {
      document.documentElement.classList.add("no-scroll");
    } catch {
      // noop
    }
  };

  const unlockScroll = () => {
    try {
      document.documentElement.classList.remove("no-scroll");
    } catch {
      // noop
    }
  };

  const [startBand, setStartBand] = useState<number>(0);
  const [endBand, setEndBand] = useState<number>(DAY_MINUTES);
  const [isDragging, setIsDragging] = useState<"start" | "end" | null>(null);

  const syncBands = (s: number, e: number) => {
    const sClamped = clamp(s, 0, DAY_MINUTES);
    let eClamped = clamp(e, 0, DAY_MINUTES);
    if (eClamped < sClamped + 10) eClamped = sClamped + 10;
    setStartBand(sClamped);
    setEndBand(eClamped);
    bandsRef.current = { start: sClamped, end: eClamped };
  };

  // 쿼리(start/end) → band로 반영
  useEffect(() => {
    const { start: sBand, end: eBand } = getBandRangeForFilter(start, end);
    if (sBand != null && eBand != null) {
      syncBands(sBand, eBand);
    } else {
      syncBands(0, DAY_MINUTES);
    }
  }, [start, end]);

  const isFiltered = !!(start && end);

  // 바 위치 기준으로 즉시 갱신되는 프리뷰 라벨
  const previewStartHm = bandMinutesToHm(startBand);
  const previewEndHm = bandMinutesToHm(endBand);
  const isAllRange =
    startBand <= 0 + 0.5 && endBand >= DAY_MINUTES - 0.5;

  const previewEndLabel =
    !isAllRange && previewEndHm === "00:00" ? "24:00" : previewEndHm;

  const displayLabel = isAllRange
    ? "All Day"
    : `${previewStartHm} ~ ${previewEndLabel}`;

  const commitRange = () => {
    const { start: sBand, end: eBand } = bandsRef.current;
    const isAll =
      sBand <= 0 + 0.5 && eBand >= DAY_MINUTES - 0.5;

    const nextStart = isAll ? undefined : bandMinutesToHm(sBand);
    const nextEnd = isAll ? undefined : bandMinutesToHm(eBand);

    if (commitTimerRef.current != null) {
      window.clearTimeout(commitTimerRef.current);
    }

    commitTimerRef.current = window.setTimeout(() => {
      onRangeChange(nextStart, nextEnd);
    }, 0) as unknown as number;
  };

  const updateFromClientX = (
    clientX: number,
    target: "start" | "end",
    step: number,
  ) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratioRaw = (clientX - rect.left) / rect.width;
    const ratio = clamp(ratioRaw, 0, 1);
    let val = ratio * DAY_MINUTES;

    val = Math.round(val / step) * step;

    if (target === "start") {
      const maxVal = endBand - 10;
      if (maxVal <= 0) return;
      const next = clamp(val, 0, maxVal);
      syncBands(next, endBand);
    } else {
      const minVal = startBand + 10;
      if (minVal >= DAY_MINUTES) return;
      const next = clamp(val, minVal, DAY_MINUTES);
      syncBands(startBand, next);
    }
  };

  const onHandlePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    target: "start" | "end",
  ) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    draggingRef.current = target;
    ignoreClickRef.current = false;
    lockScroll();
    setIsDragging(target);
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    ignoreClickRef.current = true;
    updateFromClientX(e.clientX, draggingRef.current, 10);
  };

  const onHandlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    const el = e.currentTarget;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      // noop
    }
    draggingRef.current = null;
    unlockScroll();
    setIsDragging(null);
    commitRange();
  };

  const onBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratioRaw = (e.clientX - rect.left) / rect.width;
    const ratio = clamp(ratioRaw, 0, 1);
    let val = ratio * DAY_MINUTES;
    val = Math.round(val / 30) * 30;

    const distToStart = Math.abs(val - startBand);
    const distToEnd = Math.abs(val - endBand);
    const target: "start" | "end" =
      distToStart <= distToEnd ? "start" : "end";

    updateFromClientX(e.clientX, target, 30);
    commitRange();
  };

  const reset = () => {
    syncBands(0, DAY_MINUTES);
    onRangeChange(undefined, undefined);
  };

  const startPct = (startBand / DAY_MINUTES) * 100;
  const endPct = (endBand / DAY_MINUTES) * 100;

  const ticks = [
    { label: "6시", value: 0 },
    { label: "9시", value: 3 * 60 },
    { label: "12시", value: 6 * 60 },
    { label: "15시", value: 9 * 60 },
    { label: "18시", value: 12 * 60 },
    { label: "21시", value: 15 * 60 },
    { label: "24시", value: 18 * 60 },
    { label: "3시", value: 21 * 60 },
    { label: "6시", value: DAY_MINUTES },
  ];

  type PresetKey = "all" | "morning" | "afternoon" | "evening" | "late" | "custom";

  const preset: PresetKey = (() => {
    if (!start && !end) return "all";
    if (start === "06:00" && end === "12:00") return "morning";
    if (start === "12:00" && end === "18:00") return "afternoon";
    if (start === "18:00" && end === "24:00") return "evening";
    if (start === "23:00" && end === "06:00") return "late";
    return "custom";
  })();

  const presetButtonClass = (key: PresetKey) =>
    "px-3 h-8 rounded-full border text-[12px] cursor-pointer " +
    (preset === key
      ? "bg-black text-white border-black"
      : "bg-white text-gray-800 border-black");

  return (
    <div className="space-y-2">
      {/* 시간 라벨 + Free Slots 한 줄 */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[16px] font-semibold text-gray-900">
          {displayLabel}
        </div>
        <button
          type="button"
          onClick={onGapToggle}
          className={
            "px-3 h-8 rounded-full border text-[12px] cursor-pointer " +
            (gapOnly
              ? "bg-black text-white border-black"
              : "bg-white text-gray-800 border-black")
          }
        >
          Free Slots
        </button>
      </div>

      {/* 프리셋 버튼들 */}
      <div className="flex flex-wrap items-center justify-start gap-2">
        <button
          type="button"
          className={presetButtonClass("all")}
          onClick={() => onRangeChange(undefined, undefined)}
        >
          All Day
        </button>
        <button
          type="button"
          className={presetButtonClass("morning")}
          onClick={() => onRangeChange("06:00", "12:00")}
        >
          오전
        </button>
        <button
          type="button"
          className={presetButtonClass("afternoon")}
          onClick={() => onRangeChange("12:00", "18:00")}
        >
          오후
        </button>
        <button
          type="button"
          className={presetButtonClass("evening")}
          onClick={() => onRangeChange("18:00", "24:00")}
        >
          저녁
        </button>
        <button
          type="button"
          className={presetButtonClass("late")}
          onClick={() => onRangeChange("23:00", "06:00")}
        >
          심야
        </button>
      </div>

      {/* 바 + 눈금 + Reset */}
      <div className="space-y-1">
        <div
          ref={barRef}
          className="relative h-7 cursor-pointer select-none touch-none"
          onClick={onBarClick}
        >
          {/* 드래그 중일 때만 트랙 색 진하게 */}
          <div
            className={
              "absolute inset-y-[11px] left-0 right-0 rounded-full " +
              (isDragging ? "bg-gray-300" : "bg-gray-200")
            }
          />
          {/* 드래그 중일 때만 선택 범위 강하게 표시 */}
          <div
            className={
              "absolute inset-y-[11px] rounded-full " +
              (isDragging ? "bg-black" : "bg-gray-900/70")
            }
            style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
          />
          {/* 시작 핸들: 드래그 중일 때만 검은색으로 강조 */}
          <button
            type="button"
            className={
              "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border cursor-pointer " +
              (isDragging === "start"
                ? "border-black bg-black"
                : "border-gray-900 bg-white")
            }
            style={{ left: `${startPct}%` }}
            onPointerDown={(e) => onHandlePointerDown(e, "start")}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
          />
          {/* 끝 핸들: 드래그 중일 때만 검은색으로 강조 */}
          <button
            type="button"
            className={
              "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border cursor-pointer " +
              (isDragging === "end"
                ? "border-black bg-black"
                : "border-gray-900 bg-white")
            }
            style={{ left: `${endPct}%` }}
            onPointerDown={(e) => onHandlePointerDown(e, "end")}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
          />
        </div>


        <div className="flex justify-between text-[11px] text-gray-600 px-1">
          {ticks.map((t) => (
            <span key={`${t.label}-${t.value}`} className="whitespace-nowrap">
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {isFiltered && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={reset}
            className="text-xs underline text-gray-600 cursor-pointer"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

type Props = {
  initialFavoriteIds: string[];
};

export default function ScreeningsClient({ initialFavoriteIds }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const editionParam = search.get("edition") ?? DEFAULT_EDITION;
  const dateParam = search.get("date") ?? "";
  const sectionParam = search.get("section") ?? "";
  const qParam = (search.get("q") ?? "").trim();
  const startParam = search.get("start") ?? "";
  const endParam = search.get("end") ?? "";
  const gapParam = search.get("gap") ?? "";
  const pageParam = search.get("page") ?? "1";

  const gapOnly = gapParam === "1";

  const timeFilterDebounceRef = useRef<number | null>(null);

  const [qLocal, setQLocal] = useState(qParam);

  // Time Range 토글 열림 상태
  const [timeRangeOpen, setTimeRangeOpen] = useState<boolean>(
    () => Boolean(startParam || endParam),
  );

  const [timeStart, setTimeStart] = useState<string | undefined>(
    startParam || undefined,
  );
  const [timeEnd, setTimeEnd] = useState<string | undefined>(
    endParam || undefined,
  );

  useEffect(() => {
    setTimeStart(startParam || undefined);
    setTimeEnd(endParam || undefined);
  }, [startParam, endParam]);

  const favoriteSetInitial = useMemo(
    () => new Set(initialFavoriteIds),
    [initialFavoriteIds],
  );
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(favoriteSetInitial),
  );
  const [pendingIds, setPendingIds] = useState<Set<string>>(
    () => new Set(),
  );

  const allRows = useMemo<ScreeningRow[]>(() => {
    const filmById: Record<string, Film> = Object.fromEntries(
      films.map((f) => [f.id, f]),
    );
    const entryById: Record<string, Entry> = Object.fromEntries(
      entries.map((e) => [e.id, e]),
    );

    const bundleMap = new Map<string, BundleFilm[]>();

    for (const s of screenings) {
      const entry = entryById[s.entryId];
      if (!entry) continue;
      const key = buildBundleKey(entry.editionId, s.code);
      if (!key) continue;

      const film = filmById[entry.filmId];
      const title =
        film?.title_ko || film?.title || film?.title_en || entry.filmId;

      const list = bundleMap.get(key) ?? [];
      if (!list.some((x) => x.filmId === entry.filmId)) {
        list.push({ filmId: entry.filmId, title });
      }
      bundleMap.set(key, list);
    }

    const rows: ScreeningRow[] = [];
    const seen = new Set<string>(); // edition + code + date + time

    for (const s of screenings) {
      const entry = entryById[s.entryId];
      if (!entry) continue;

      const film = filmById[entry.filmId];
      const editionId = entry.editionId ?? "unknown";

      const date = ymd(s.startsAt);
      const time = hm(s.startsAt);

      const dedupeKey = `${editionId}__${s.code ?? s.id}__${date}__${time}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const bundleKey = buildBundleKey(editionId, s.code);
      const bundleList = bundleKey ? bundleMap.get(bundleKey) ?? [] : [];

      const timeHm = time || "00:00";
      const startBandRaw = hmToBandMinutes(timeHm);
      const startBand = startBandRaw ?? 0;

      let endBand: number | null = null;
      let endTimeHm: string | null = null;
      let endEstimated = false;

      if (s.endsAt) {
        const endHm = hm(s.endsAt);
        endTimeHm = endHm || null;
        endBand = hmToBandMinutes(endHm || null);
      }

      if (endBand == null) {
        let runtime = 120;

        if (bundleList.length > 1) {
          const runtimes = bundleList.map((bf) => {
            const rt = filmById[bf.filmId]?.runtime;
            return typeof rt === "number" ? rt : null;
          });
          if (runtimes.every((x) => x !== null)) {
            runtime = (runtimes as number[]).reduce((a, b) => a + b, 0);
          }
        } else {
          runtime =
            typeof film?.runtime === "number" ? film.runtime : 120;
        }

        const startAbs = parseHmToMin(timeHm) ?? 0;
        let endAbs = startAbs + runtime;
        endAbs %= DAY_MINUTES;
        const endHmStr = hmFromMinutes(endAbs);
        endBand = hmToBandMinutes(endHmStr) ?? startBand;
        endTimeHm = endHmStr;
        endEstimated = true;
      }

      if (endBand <= startBand) {
        endBand = startBand + 10;
      }

      let filmTitle: string;
      let bundleFilms: BundleFilm[] | undefined;

      if (bundleList.length > 1) {
        const primaryId = entry.filmId;
        const sorted = [...bundleList].sort((a, b) => {
          if (a.filmId === primaryId) return -1;
          if (b.filmId === primaryId) return 1;
          return a.title.localeCompare(b.title, "ko");
        });
        filmTitle = sorted.map((x) => x.title).join(" + ");
        bundleFilms = sorted;
      } else {
        filmTitle =
          film?.title_ko ||
          film?.title ||
          film?.title_en ||
          entry.filmId ||
          s.id;
      }

      rows.push({
        id: s.id,
        filmId: entry.filmId,
        filmTitle,
        editionId,
        section: entry.section ?? null,
        date,
        time,
        endTime: endTimeHm,
        endEstimated,
        venue: s.venue ?? "",
        code: s.code ?? null,
        withGV: s.withGV ?? false,
        dialogue: s.dialogue ?? null,
        subtitles: s.subtitles ?? null,
        rating: s.rating ?? null,
        startBand,
        endBand,
        bundleFilms,
      });
    }

    return rows.filter((r) => r.editionId !== "unknown");
  }, []);

  const editions = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRows) set.add(r.editionId);
    const arr = Array.from(set);
    arr.sort((a, b) => {
      const order = (id: string) =>
        id.startsWith("edition_jiff_")
          ? 0
          : id.startsWith("edition_biff_")
          ? 1
          : 99;
      const oa = order(a);
      const ob = order(b);
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b);
    });
    return arr;
  }, [allRows]);

  const currentEdition =
    editions.includes(editionParam) && editions.length
      ? editionParam
      : editions[0] ?? "";

  const datesForEdition = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRows) {
      if (r.editionId === currentEdition && r.date) set.add(r.date);
    }
    const arr = Array.from(set);
    arr.sort();
    return arr;
  }, [allRows, currentEdition]);

  // [Refactor] Use utils parseCsv (renamed from parseCSV)
  const dateList = useMemo(() => parseCsv(dateParam), [dateParam]);
  const sectionList = useMemo(() => parseCsv(sectionParam), [sectionParam]);

  const sectionsForEdition = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRows) {
      if (r.editionId !== currentEdition) continue;
      if (!r.section) continue;
      set.add(r.section);
    }
    const arr = Array.from(set);
    arr.sort((a, b) => a.localeCompare(b, "ko"));
    return arr;
  }, [allRows, currentEdition]);

  const favoriteRows = useMemo(
    () => allRows.filter((r) => favoriteIds.has(r.id)),
    [allRows, favoriteIds],
  );

  const busyByDay = useMemo(() => {
    const map = new Map<string, { startBand: number; endBand: number }[]>();
    for (const r of favoriteRows) {
      if (!r.date) continue;
      const key = `${r.editionId}__${r.date}`;
      const list = map.get(key) ?? [];
      list.push({ startBand: r.startBand, endBand: r.endBand });
      map.set(key, list);
    }
    return map;
  }, [favoriteRows]);

  const { start: timeStartBandRaw, end: timeEndBandRaw } = getBandRangeForFilter(
    timeStart,
    timeEnd,
  );
  const hasTimeFilter = !!(timeStart && timeEnd);
  
  const filtered = useMemo(() => {
    let rows = allRows;

    if (currentEdition) {
      rows = rows.filter((r) => r.editionId === currentEdition);
    }

    if (dateList.length > 0) {
      const ds = new Set(dateList);
      rows = rows.filter((r) => r.date && ds.has(r.date));
    }

    if (sectionList.length > 0) {
      const ss = new Set(sectionList);
      rows = rows.filter((r) => r.section && ss.has(r.section));
    }

    if (qParam) {
      const text = qParam.toLowerCase();
      rows = rows.filter((r) => {
        const hay = [
          r.filmTitle,
          r.venue,
          r.section ?? "",
          r.code ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(text);
      });
    }

    if (hasTimeFilter && timeStartBandRaw != null && timeEndBandRaw != null) {
      rows = rows.filter(
        (r) => r.startBand >= timeStartBandRaw && r.endBand <= timeEndBandRaw,
      );
    }

    if (gapOnly) {
      const rangeStart = hasTimeFilter && timeStartBandRaw != null
        ? timeStartBandRaw
        : 0;
      const rangeEnd = hasTimeFilter && timeEndBandRaw != null
        ? timeEndBandRaw
        : DAY_MINUTES;

      rows = rows.filter((r) => {
        const busyKey = `${r.editionId}__${r.date}`;
        const busyList = busyByDay.get(busyKey);
        if (!busyList || busyList.length === 0) {
          return true;
        }

        const s = r.startBand;
        const e = r.endBand;

        const sClamped = Math.max(s, rangeStart);
        const eClamped = Math.min(e, rangeEnd);
        if (eClamped <= sClamped) return false;

        for (const b of busyList) {
          const bs = b.startBand;
          const be = b.endBand;
          if (eClamped > bs && sClamped < be) {
            return false;
          }
        }
        return true;
      });
    }

    rows = [...rows].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);

      if (a.time !== b.time) return a.time.localeCompare(b.time);

      const secA = a.section ?? "";
      const secB = b.section ?? "";
      if (secA !== secB) return secA.localeCompare(secB, "ko");

      if (a.venue !== b.venue) return a.venue.localeCompare(b.venue, "ko");
      return a.filmTitle.localeCompare(b.filmTitle, "ko");
    });

    return rows;
  }, [
    allRows,
    currentEdition,
    dateList,
    sectionList,
    qParam,
    hasTimeFilter,
    timeStartBandRaw,
    timeEndBandRaw,
    gapOnly,
    busyByDay,
  ]);

  const editionLabel =
    EDITION_LABEL[currentEdition] ?? currentEdition ?? "";

  const dateLabel =
    dateList.length === 0
      ? "All dates"
      : dateList.length === 1
      ? mdK(`${dateList[0]}T00:00:00`)
      : `${dateList.length}일 선택`;

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const requestedPage = Number(pageParam);
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), totalPages)
    : 1;
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageEnd);

  async function toggleFavorite(screeningId: string) {
    if (!screeningId) return;

    const wasFavorite = favoriteIds.has(screeningId);

    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(screeningId);
      else next.add(screeningId);
      return next;
    });

    setPendingIds((prev) => {
      const next = new Set(prev);
      next.add(screeningId);
      return next;
    });

    try {
      const resp = await fetch("/api/favorite-screening", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screeningId,
          favorite: !wasFavorite,
        }),
      });

      if (!resp.ok) {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(screeningId);
          else next.delete(screeningId);
          return next;
        });
      }
    } catch {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.add(screeningId);
        else next.delete(screeningId);
        return next;
      });
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(screeningId);
        return next;
      });
    }
  }

  const WEEKEND_TEXT_COLOR = "#D30000";

  return (
    <section className="space-y-4">
      {/* 필터 바 */}
      <div className="bg-white border rounded-lg p-3 space-y-3">
        {/* Festival */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600 mr-2">Festival</span>
          {editions.map((eid) => {
            const label = EDITION_LABEL[eid] ?? eid;
            return (
              <label
                key={eid}
                className="inline-flex items-center gap-1 text-sm cursor-pointer"
              >
                <input
                  type="radio"
                  name="edition"
                  className="cursor-pointer"
                  checked={currentEdition === eid}
                  onChange={() =>
                    setQuery(router, pathname, search, {
                      edition: eid,
                      date: undefined,
                      section: undefined,
                      page: undefined,
                      start: undefined,
                      end: undefined,
                      gap: undefined,
                      q: undefined,
                    })
                  }
                />
                {label}
              </label>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = qLocal.trim();
                setQuery(router, pathname, search, {
                  q: v || undefined,
                  page: undefined,
                });
              }
            }}
            placeholder="Search title / venue / section / code"
            className="flex-1 min-w-0 border rounded px-3 py-2 text-base md:text-sm"
            inputMode="search"
          />
          <button
            type="button"
            aria-label="Search"
            title="Search"
            onClick={() => {
              const v = qLocal.trim();
              setQuery(router, pathname, search, {
                q: v || undefined,
                page: undefined,
              });
            }}
            className="inline-flex items-center justify-center p-1.5 md:p-1 bg-transparent border-0 rounded-none hover:bg-transparent focus:outline-none focus:ring-0 cursor-pointer"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
          {qParam && (
            <button
              type="button"
              className="text-xs underline text-gray-600 whitespace-nowrap cursor-pointer"
              onClick={() => {
                setQLocal("");
                setQuery(router, pathname, search, {
                  q: undefined,
                  page: undefined,
                });
              }}
              title="Clear search"
            >
              Clear
            </button>
          )}
        </div>

        {/* Date (다중 선택 + ALL 기본) */}
        {datesForEdition.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600 mr-2">Date</span>

            {/* ALL 버튼 */}
            <button
              type="button"
              onClick={() =>
                setQuery(router, pathname, search, {
                  date: undefined,
                  page: undefined,
                })
              }
              className={
                "px-2 py-1 rounded border text-[11px] cursor-pointer border-black " +
                (dateList.length === 0 ? "bg-black text-white" : "bg-white")
              }
              title="All dates"
            >
              ALL
            </button>

            {datesForEdition.map((d) => {
              const active = dateList.includes(d);
              // [Refactor] Use utils weekdayKFromISO & isWeekendISO logic via local var or util
              const wK = weekdayKFromISO(`${d}T00:00:00`);
              const isWeekend = wK === "토" || wK === "일";
              const style =
                !active && isWeekend ? { color: WEEKEND_TEXT_COLOR } : undefined;

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    let next: string[];
                    if (active) {
                      next = dateList.filter((v) => v !== d);
                    } else {
                      next = [...dateList, d];
                    }
                    const csv = buildCsv(next); // [Refactor] buildCsv (camelCase)
                    setQuery(router, pathname, search, {
                      date: csv || undefined,
                      page: undefined,
                    });
                  }}
                  className={
                    "px-2 py-1 rounded border text-[11px] cursor-pointer border-black " +
                    (active ? "bg-black text-white" : "bg-white")
                  }
                  style={style}
                  title={mdK(`${d}T00:00:00`)}
                >
                  {mdK(`${d}T00:00:00`)}
                </button>
              );
            })}
          </div>
        )}

        {/* Section (다중 선택) */}
        {sectionsForEdition.length > 0 && (
          <details>
            <summary className="cursor-pointer select-none text-sm text-gray-700 py-1">
              Section
            </summary>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setQuery(router, pathname, search, {
                    section: undefined,
                    page: undefined,
                  })
                }
                className={
                  "px-2 py-1 rounded border text-[11px] cursor-pointer " +
                  (sectionList.length === 0
                    ? "bg-black text-white border-black"
                    : "bg-white border-black")
                }
              >
                All
              </button>
              {sectionsForEdition.map((sec) => {
                const active = sectionList.includes(sec);
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => {
                      let next: string[];
                      if (active) {
                        next = sectionList.filter((v) => v !== sec);
                      } else {
                        next = [...sectionList, sec];
                      }
                      const csv = buildCsv(next); // [Refactor] buildCsv
                      setQuery(router, pathname, search, {
                        section: csv || undefined,
                        page: undefined,
                      });
                    }}
                    className={
                      "px-2 py-1 rounded border text-[11px] cursor-pointer " +
                      (active
                        ? "bg-black text-white border-black"
                        : "bg-white border-black")
                    }
                    title={sec}
                  >
                    {sec}
                  </button>
                );
              })}
            </div>
          </details>
        )}

        {/* Time range */}
        <details
          open={timeRangeOpen}
          onToggle={(e) => {
            const el = e.currentTarget as HTMLDetailsElement;
            setTimeRangeOpen(el.open);
          }}
        >
          <summary className="cursor-pointer select-none text-sm text-gray-700 py-1">
            Time Range
          </summary>
          <div className="mt-2">
            <TimeRangeFilter
              start={timeStart}
              end={timeEnd}
              gapOnly={gapOnly}
              onRangeChange={(start, end) => {
                setTimeStart(start || undefined);
                setTimeEnd(end || undefined);

                if (timeFilterDebounceRef.current != null) {
                  window.clearTimeout(timeFilterDebounceRef.current);
                }

                timeFilterDebounceRef.current = window.setTimeout(() => {
                  setQuery(router, pathname, search, {
                    start: start || undefined,
                    end: end || undefined,
                    page: undefined,
                  });
                }, 400) as unknown as number;
              }}
              onGapToggle={() => {
                const next = !gapOnly;
                setQuery(router, pathname, search, {
                  gap: next ? "1" : undefined,
                  page: undefined,
                });
              }}
            />
          </div>
        </details>
      </div>

      {/* 요약 */}
      <div className="text-sm text-gray-700">
        {editionLabel && `${editionLabel} · `}
        {dateLabel} · {totalCount}개 상영
        {totalPages > 1 && ` · Page ${currentPage} / ${totalPages}`}
      </div>

      {/* 리스트 */}
      <div className="space-y-3">
        {pageRows.map((row) => {
          const editionId = row.editionId;
          const lang = makeLangLabel(row.dialogue, row.subtitles, editionId);
          const badges = makeBadges(row.rating, lang, row.withGV);

          const isFavorite = favoriteIds.has(row.id);
          const isPending = pendingIds.has(row.id);

          const hasBundle =
            Array.isArray(row.bundleFilms) && row.bundleFilms.length > 1;

          return (
            <article
              key={row.id}
              className="border rounded-xl p-3 bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12px] text-gray-800">
                    {mdK(`${row.date}T00:00:00`)} ·{" "}
                    {row.endTime ? (
                      row.endEstimated ? (
                        <>
                          <span className="font-semibold">{row.time}</span>{" "}
                          ~ <span>{row.endTime}</span>
                        </>
                      ) : (
                        <span className="font-semibold">
                          {row.time} ~ {row.endTime}
                        </span>
                      )
                    ) : (
                      <span className="font-semibold">{row.time}</span>
                    )}{" "}
                    · {row.venue}
                  </div>

                  {row.section && (
                    <div className="mt-[1px] text-[11px] text-gray-600 truncate">
                      {row.section}
                    </div>
                  )}

                  <div className="mt-1 text-[13px] font-semibold leading-snug break-words">
                    {hasBundle
                      ? row.bundleFilms!.map((bf, idx) => (
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
                            >
                              {bf.title}
                            </Link>
                          </span>
                        ))
                      : (
                        <Link
                          href={`/films/${encodeURIComponent(row.filmId)}`}
                          className="hover:underline underline-offset-2"
                        >
                          {row.filmTitle}
                        </Link>
                      )}
                  </div>

                  {badges.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-gray-700">
                      {badges.map((b) => (
                        <span
                          key={b.key}
                          className={badgeClass(b.type, b.label)}
                        >
                          {b.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {row.code && (
                    <div className="mt-[2px] text-[11px] text-gray-500">
                      code: {row.code}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => toggleFavorite(row.id)}
                  disabled={isPending}
                  aria-pressed={isFavorite}
                  // [UX] touch-target 추가
                  className={
                    "touch-target shrink-0 rounded-full border px-2 py-1 text-[12px]" +
                    (isFavorite
                      ? " bg-black text-white border-black"
                      : " bg-white text-gray-700") +
                    (isPending ? " opacity-60 cursor-default" : " cursor-pointer")
                  }
                  title={
                    isFavorite
                      ? "타임테이블 후보에서 제거"
                      : "타임테이블 후보에 추가"
                  }
                >
                  {isFavorite ? "♥" : "♡"}
                </button>
              </div>
            </article>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-sm text-gray-500 border rounded-lg px-3 py-2">
            조건에 맞는 상영이 없습니다.
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <nav
          className="mt-4 flex flex-wrap items-center gap-1.5"
          aria-label="Pagination"
        >
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() =>
                setQuery(router, pathname, search, {
                  page: String(p),
                })
              }
              className={`inline-flex items-center justify-center border rounded cursor-pointer
                          min-w-[28px] h-7 px-0 text-[10px]
                          ${p === currentPage ? "bg-black text-white border-black" : "bg-white border-black"}`}
              aria-current={p === currentPage ? "page" : undefined}
              title={`Page ${p}`}
            >
              {p}
            </button>
          ))}
        </nav>
      )}
    </section>
  );
}