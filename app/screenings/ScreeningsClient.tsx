"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import filmsData from "@/data/films.json";
import entriesData from "@/data/entries.json";
import screeningsData from "@/data/screenings.json";

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
  venue: string;
  code?: string | null;
  withGV?: boolean | null;
  dialogue?: string | null;
  subtitles?: string | null;
  rating?: string | null;
  startMin: number;
  endMin: number;
  bundleFilms?: BundleFilm[];
};

const films = filmsData as Film[];
const entries = entriesData as Entry[];
const screenings = screeningsData as Screening[];

const DEFAULT_EDITION = "edition_jiff_2025";

const EDITION_LABEL: Record<string, string> = {
  edition_jiff_2025: "JIFF 2025",
  edition_biff_2025: "BIFF 2025",
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function ymd(iso?: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

function hm(iso?: string | null) {
  return iso ? iso.slice(11, 16) : "";
}

function weekdayKFromISO(iso?: string | null) {
  if (!iso) return "";
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAYS[dow] ?? "";
}

function mdK(iso?: string | null) {
  if (!iso) return "";
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  const w = weekdayKFromISO(iso);
  return `${month}월 ${day}일(${w})`;
}

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

function makeBadges(rating?: string | null, lang?: string | null, withGV?: boolean | null) {
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

function makeLangLabel(dialogue?: string | null, subtitles?: string | null, editionId?: string) {
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

function setQuery(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  prev: URLSearchParams,
  patch: Record<string, string | undefined>,
) {
  const sp = new URLSearchParams(prev.toString());
  Object.entries(patch).forEach(([k, v]) => {
    if (v === undefined || v === "") sp.delete(k);
    else sp.set(k, v);
  });
  const qs = sp.toString();
  router.replace(qs ? `${pathname}?${qs}` : pathname);
}

// CSV 헬퍼(날짜/섹션 공용)
function parseCSV(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildCSV(list: string[]): string {
  const uniq = Array.from(new Set(list.filter(Boolean)));
  return uniq.join(",");
}

// Time range 바 전용 헬퍼 (06:00 기준)
const DAY_MINUTES = 24 * 60;
const BASE_MIN = 6 * 60; // 06:00

function hmFromMinutes(m: number): string {
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// 06:00 = 0, 다음날 06:00 = 1440 으로 변환
function hmToBandMinutes(hmStr: string | null): number | null {
  const abs = parseHmToMin(hmStr);
  if (abs == null) return null;
  let v = abs - BASE_MIN;
  if (v < 0) v += DAY_MINUTES;
  return v;
}

// band(0~1440)를 실제 HH:MM 문자열로 변환
function bandMinutesToHm(band: number): string {
  let v = band;
  if (v < 0) v = 0;
  // 1440은 sentinel이라 1439로 클램프
  if (v >= DAY_MINUTES) v = DAY_MINUTES - 1;
  const abs = (v + BASE_MIN) % DAY_MINUTES;
  return hmFromMinutes(abs);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type TimeRangeFilterProps = {
  startParam: string;
  endParam: string;
  onChange: (start: string | undefined, end: string | undefined) => void;
};

function TimeRangeFilter({ startParam, endParam, onChange }: TimeRangeFilterProps) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<null | "start" | "end">(null);
  const ignoreClickRef = useRef(false);

  // URL 쿼리 → band 값으로 초기화
  const [startBand, setStartBand] = useState<number>(() => {
    const s = hmToBandMinutes(startParam || null);
    const e = hmToBandMinutes(endParam || null);
    if (s != null && e != null && e > s) return s;
    return 0;
  });
  const [endBand, setEndBand] = useState<number>(() => {
    const s = hmToBandMinutes(startParam || null);
    const e = hmToBandMinutes(endParam || null);
    if (s != null && e != null && e > s) return e;
    return DAY_MINUTES;
  });

  // 쿼리 변경에 대응
  useEffect(() => {
    const s = hmToBandMinutes(startParam || null);
    const e = hmToBandMinutes(endParam || null);
    if (s != null && e != null && e > s) {
      setStartBand(s);
      setEndBand(e);
    } else {
      setStartBand(0);
      setEndBand(DAY_MINUTES);
    }
  }, [startParam, endParam]);

  const isFiltered = useMemo(() => {
    const s = hmToBandMinutes(startParam || null);
    const e = hmToBandMinutes(endParam || null);
    return s != null && e != null && e > s;
  }, [startParam, endParam]);

  const startLabel = bandMinutesToHm(startBand);
  const endLabel = bandMinutesToHm(endBand);

  const updateFromClientX = (clientX: number, target: "start" | "end", step: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratioRaw = (clientX - rect.left) / rect.width;
    const ratio = clamp(ratioRaw, 0, 1);
    let val = ratio * DAY_MINUTES;

    // step 분 단위
    val = Math.round(val / step) * step;

    if (target === "start") {
      const maxVal = endBand - 10;
      if (maxVal <= 0) return;
      const next = clamp(val, 0, maxVal);
      setStartBand(next);
      if (next === 0 && endBand === DAY_MINUTES) {
        onChange(undefined, undefined);
      } else {
        onChange(bandMinutesToHm(next), bandMinutesToHm(endBand));
      }
    } else {
      const minVal = startBand + 10;
      if (minVal >= DAY_MINUTES) return;
      const next = clamp(val, minVal, DAY_MINUTES);
      setEndBand(next);
      if (startBand === 0 && next === DAY_MINUTES) {
        onChange(undefined, undefined);
      } else {
        onChange(bandMinutesToHm(startBand), bandMinutesToHm(next));
      }
    }
  };

  const onHandlePointerDown = (e: React.PointerEvent, target: "start" | "end") => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    draggingRef.current = target;
    ignoreClickRef.current = false;
  };

  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    ignoreClickRef.current = true;
    // 드래그: 10분 단위
    updateFromClientX(e.clientX, draggingRef.current, 10);
  };

  const onHandlePointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    const el = e.currentTarget;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      // noop
    }
    draggingRef.current = null;
  };

  const onBarClick = (e: React.MouseEvent) => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratioRaw = (e.clientX - rect.left) / rect.width;
    const ratio = clamp(ratioRaw, 0, 1);
    let val = ratio * DAY_MINUTES;
    // 클릭: 30분 단위
    val = Math.round(val / 30) * 30;

    const distToStart = Math.abs(val - startBand);
    const distToEnd = Math.abs(val - endBand);
    const target: "start" | "end" = distToStart <= distToEnd ? "start" : "end";
    updateFromClientX(e.clientX, target, 30);
  };

  const reset = () => {
    setStartBand(0);
    setEndBand(DAY_MINUTES);
    onChange(undefined, undefined);
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

  return (
    <div className="space-y-1">
      <div className="text-center text-sm font-medium text-gray-800">
        {isFiltered ? `${startLabel} ~ ${endLabel}` : "Any time"}
      </div>

      <div className="space-y-1">
        {/* 바 영역 */}
        <div
          ref={barRef}
          className="relative h-7 cursor-pointer select-none"
          onClick={onBarClick}
        >
          {/* 배경 바 */}
          <div className="absolute inset-y-[11px] left-0 right-0 rounded-full bg-gray-200" />

          {/* 선택 구간 */}
          <div
            className="absolute inset-y-[11px] rounded-full bg-gray-900/70"
            style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
          />

          {/* 핸들들 */}
          <button
            type="button"
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border border-gray-900 bg-white cursor-pointer"
            style={{ left: `${startPct}%` }}
            onPointerDown={(e) => onHandlePointerDown(e, "start")}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
          />
          <button
            type="button"
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border border-gray-900 bg-white cursor-pointer"
            style={{ left: `${endPct}%` }}
            onPointerDown={(e) => onHandlePointerDown(e, "end")}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
          />
        </div>

        {/* 눈금 라벨: 바 아래 한 줄 */}
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

    const [qLocal, setQLocal] = useState(qParam);
    // Time Range 토글 열림 상태: 최초에는 start/end 유무로 결정, 이후에는 사용자가 연·닫은 상태 유지
    const [timeRangeOpen, setTimeRangeOpen] = useState<boolean>(
      () => Boolean(startParam || endParam)
    );

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

    // code 단위로 묶어서 패키지 상영의 영화 목록 구성
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
    const seen = new Set<string>(); // edition + code + date + time 기준 중복 제거

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

      const [hh, mm] = time.split(":").map((v) => Number(v) || 0);
      let startMin = hh * 60 + mm;
      let endMin: number;

      const bundleKey = buildBundleKey(editionId, s.code);
      const bundleList = bundleKey ? bundleMap.get(bundleKey) ?? [] : [];

      if (s.endsAt) {
        const t2 = hm(s.endsAt);
        const [hh2, mm2] = t2.split(":").map((v) => Number(v) || 0);
        endMin = hh2 * 60 + mm2;
      } else {
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
        endMin = startMin + runtime;
      }

      if (endMin <= startMin) endMin += 24 * 60;

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
        venue: s.venue ?? "",
        code: s.code ?? null,
        withGV: s.withGV ?? false,
        dialogue: s.dialogue ?? null,
        subtitles: s.subtitles ?? null,
        rating: s.rating ?? null,
        startMin,
        endMin,
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

  // Date/Section 다중 선택 리스트
  const dateList = useMemo(() => parseCSV(dateParam), [dateParam]);
  const sectionList = useMemo(() => parseCSV(sectionParam), [sectionParam]);

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

  const timeStartMin = parseHmToMin(startParam || null);
  const timeEndMin = parseHmToMin(endParam || null);

  const filtered = useMemo(() => {
    let rows = allRows;

    if (currentEdition) {
      rows = rows.filter((r) => r.editionId === currentEdition);
    }

    // Date OR 필터
    if (dateList.length > 0) {
      const ds = new Set(dateList);
      rows = rows.filter((r) => r.date && ds.has(r.date));
    }

    // Section OR 필터
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

    if (
      timeStartMin != null &&
      timeEndMin != null &&
      timeEndMin > timeStartMin
    ) {
      rows = rows.filter(
        (r) => r.startMin >= timeStartMin && r.endMin <= timeEndMin,
      );
    }

    rows = [...rows].sort((a, b) => {
      // 1) Date
      if (a.date !== b.date) return a.date.localeCompare(b.date);

      // 2) Time
      if (a.time !== b.time) return a.time.localeCompare(b.time);

      // 3) Section
      const secA = a.section ?? "";
      const secB = b.section ?? "";
      if (secA !== secB) return secA.localeCompare(secB, "ko");

      // 이하 타이브레이커
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
    timeStartMin,
    timeEndMin,
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
                      q: undefined,
                    })
                  }
                />
                {label}
              </label>
            );
          })}
        </div>

        {/* Search (Festival 바로 아래로 이동) */}
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
              setQuery(router, pathname, search, { q: v || undefined });
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
                setQuery(router, pathname, search, { q: undefined });
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
              const weekend = weekdayKFromISO(`${d}T00:00:00Z`);
              const isWeekend = weekend === "토" || weekend === "일";
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
                    const csv = buildCSV(next);
                    setQuery(router, pathname, search, {
                      date: csv || undefined,
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
                      const csv = buildCSV(next);
                      setQuery(router, pathname, search, {
                        section: csv || undefined,
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

        {/* Time range: Section처럼 토글 */}
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
              startParam={startParam}
              endParam={endParam}
              onChange={(start, end) =>
                setQuery(router, pathname, search, {
                  start: start || undefined,
                  end: end || undefined,
                })
              }
            />
          </div>
        </details>
      </div>

      {/* 요약 */}
      <div className="text-sm text-gray-700">
        {editionLabel && `${editionLabel} · `}{dateLabel} · {totalCount}개 상영
      </div>

      {/* 리스트 */}
      <div className="space-y-3">
        {filtered.map((row) => {
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
                    {mdK(`${row.date}T00:00:00`)} · {row.time} ·{" "}
                    {row.venue}
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
                  className={
                    "shrink-0 rounded-full border px-2 py-1 text-[12px]" +
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
    </section>
  );
}
