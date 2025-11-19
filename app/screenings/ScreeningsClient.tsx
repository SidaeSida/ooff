// app/screenings/ScreeningsClient.tsx
"use client";

import { useMemo, useState } from "react";
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

function normId(v: unknown): string {
  try {
    return decodeURIComponent(String(v ?? "")).trim().toLowerCase();
  } catch {
    return String(v ?? "").trim().toLowerCase();
  }
}

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

  if (editionId?.startsWith("edition_jiff_")) {
    const dShow = d && d !== "X" ? d : "";
    const sShow = s && s !== "X" ? s : "";
    if (dShow && sShow) return `${dShow}/${sShow}`;
    return dShow || sShow || "";
  }

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

  const [startLocal, setStartLocal] = useState(startParam);
  const [endLocal, setEndLocal] = useState(endParam);
  const [qLocal, setQLocal] = useState(qParam);

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

    for (const s of screenings) {
      const entry = entryById[s.entryId];
      if (!entry) continue;

      const film = filmById[entry.filmId];
      const editionId = entry.editionId ?? "unknown";

      const date = ymd(s.startsAt);
      const time = hm(s.startsAt);

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

  const currentDate =
    dateParam && datesForEdition.includes(dateParam)
      ? dateParam
      : datesForEdition[0] ?? "";

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
    if (currentDate) {
      rows = rows.filter((r) => r.date === currentDate);
    }
    if (sectionParam) {
      rows = rows.filter((r) => r.section === sectionParam);
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
      if (a.time !== b.time) return a.time.localeCompare(b.time);
      if (a.venue !== b.venue) return a.venue.localeCompare(b.venue, "ko");
      return a.filmTitle.localeCompare(b.filmTitle, "ko");
    });

    return rows;
  }, [
    allRows,
    currentEdition,
    currentDate,
    sectionParam,
    qParam,
    timeStartMin,
    timeEndMin,
  ]);

  const editionLabel =
    EDITION_LABEL[currentEdition] ?? currentEdition ?? "";

  const weekdayText =
    currentDate && weekdayKFromISO(`${currentDate}T00:00:00Z`);
  const dateLabel =
    currentDate && weekdayText
      ? mdK(`${currentDate}T00:00:00`)
      : currentDate;

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
                    })
                  }
                />
                {label}
              </label>
            );
          })}
        </div>

        {/* Date (필수) */}
        {datesForEdition.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600 mr-2">Date</span>
            {datesForEdition.map((d) => {
              const active = d === currentDate;
              const weekend = weekdayKFromISO(`${d}T00:00:00Z`);
              const isWeekend = weekend === "토" || weekend === "일";
              const style = !active && isWeekend ? { color: WEEKEND_TEXT_COLOR } : undefined;

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setQuery(router, pathname, search, {
                      date: d,
                    })
                  }
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

        {/* Section */}
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
                  (!sectionParam
                    ? "bg-black text-white border-black"
                    : "bg-white border-black")
                }
              >
                All
              </button>
              {sectionsForEdition.map((sec) => {
                const active = sec === sectionParam;
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() =>
                      setQuery(router, pathname, search, {
                        section: active ? undefined : sec,
                      })
                    }
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

        {/* Time range */}
        <div className="space-y-1">
          <div className="text-sm text-gray-700">Time range (optional)</div>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              onBlur={() =>
                setQuery(router, pathname, search, {
                  start: startLocal || undefined,
                })
              }
              className="border rounded px-2 py-1 text-sm"
            />
            <span className="text-xs text-gray-500">~</span>
            <input
              type="time"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              onBlur={() =>
                setQuery(router, pathname, search, {
                  end: endLocal || undefined,
                })
              }
              className="border rounded px-2 py-1 text-sm"
            />
            {(startParam || endParam) && (
              <button
                type="button"
                className="text-xs underline text-gray-600 whitespace-nowrap cursor-pointer"
                onClick={() => {
                  setStartLocal("");
                  setEndLocal("");
                  setQuery(router, pathname, search, {
                    start: undefined,
                    end: undefined,
                  });
                }}
              >
                Reset
              </button>
            )}
          </div>
          <div className="text-[11px] text-gray-500">
            시작·끝 시간이 모두 설정된 경우에만 적용됩니다.
          </div>
        </div>
      </div>

      {/* 요약 */}
      <div className="text-sm text-gray-700">
        {editionLabel &&
          `${editionLabel} · `}{dateLabel} · {totalCount}개 상영
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
                  {/* 시간 / 장소 */}
                  <div className="text-[12px] text-gray-800">
                    {mdK(`${row.date}T00:00:00`)} · {row.time} ·{" "}
                    {row.venue}
                  </div>

                  {/* 섹션 */}
                  {row.section && (
                    <div className="mt-[1px] text-[11px] text-gray-600 truncate">
                      {row.section}
                    </div>
                  )}

                  {/* 제목 (다중 상영 포함) */}
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

                  {/* 등급/언어/GV 배지 */}
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

                  {/* code */}
                  {row.code && (
                    <div className="mt-[2px] text-[11px] text-gray-500">
                      code: {row.code}
                    </div>
                  )}
                </div>

                {/* 하트 */}
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
