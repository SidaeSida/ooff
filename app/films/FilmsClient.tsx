'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import filmsData from '@/data/films.json';
import entriesData from '@/data/entries.json';
import screeningsData from '@/data/screenings.json';
import FilmListCard from '@/components/FilmListCard';

type Film = {
  id: string;
  title: string;
  title_ko?: string;
  title_en?: string;
  year: number;
  countries?: string[];
  runtime?: number;
  genres?: string[];
  festivalBadges?: string[];
  credits?: { directors?: string[] };
  creditTokens?: string[]; // 있으면 전역 크레딧 검색 포함
};
type Entry = {
  id: string;
  filmId: string;
  editionId: string;
  section?: string | null;
  format?: string | null;
  color?: string | null;
  premiere?: string | null;
  detail_url?: string | null;
};
type Screening = {
  id: string;
  entryId: string;
  code?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  venue?: string | null;
  rating?: string | null;
  withGV?: boolean;
  dialogue?: string | null;
  subtitles?: string | null;
};

const films = filmsData as Film[];
const entries = entriesData as Entry[];
const screenings = screeningsData as Screening[];

// 기본 페스티벌
const DEFAULT_EDITION = 'edition_jiff_2025';

// 섹션 표시 순서(사이트 제공 순서)
const ORDER_JIFF = [
  '개막작','폐막작','국제경쟁','한국경쟁','한국단편경쟁','전주시네마프로젝트','프론트라인','다시, 민주주의로',
  '월드시네마','마스터즈','코리안시네마','배창호 특별전: 대중성과 실험성 사이에서','영화보다 낯선','시네마천국',
  '불면의 밤','시네필전주','게스트 시네필: 에이드리언 마틴','특별전: 가능한 영화를 향하여','J 스페셜: 올해의 프로그래머','특별상영'
];
const ORDER_BIFF = [
  '개막작','경쟁','갈라 프레젠테이션','아이콘','비전','아시아영화의 창','한국영화의 오늘','월드 시네마',
  '플래시 포워드','와이드 앵글','오픈 시네마','미드나잇 패션','온 스크린','특별기획 프로그램','특별상영'
];
const radioOptions = [
  { id: 'edition_jiff_2025', label: 'JIFF2025' },
  { id: 'edition_biff_2025', label: 'BIFF2025' },
  { id: 'all', label: 'All' },
];

function setQuery(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  prev: URLSearchParams,
  patch: Record<string, string | undefined>
) {
  const sp = new URLSearchParams(prev.toString());
  Object.entries(patch).forEach(([k, v]) => {
    if (v === undefined || v === '') sp.delete(k);
    else sp.set(k, v);
  });
  const qs = sp.toString();
  router.replace(qs ? `${pathname}?${qs}` : pathname);
}
function toggleCsv(currentCsv: string | null, value: string): string {
  const cur = (currentCsv ?? '').split(',').filter(Boolean);
  const set = new Set(cur);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return Array.from(set).join(',');
}
function csvOfAll(arr: string[]): string | undefined {
  return arr.length ? arr.join(',') : undefined;
}
function isAllSelected(currentCsv: string | null, options: string[]): boolean {
  if (!options.length) return false;
  const cur = new Set((currentCsv ?? '').split(',').filter(Boolean));
  return options.every((o) => cur.has(o));
}
function ymd(iso?: string | null) {
  return iso ? iso.slice(0, 10) : '';
}
function mdK(iso?: string | null) {
  if (!iso) return '';
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return `${m}월 ${d}일`;
}
function normId(s: string) {
  try { return decodeURIComponent(String(s)).trim().toLowerCase(); }
  catch { return String(s).trim().toLowerCase(); }
}

export default function FilmsClient({ ratedFilmIds }: { ratedFilmIds: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const edition = search.get('edition') ?? DEFAULT_EDITION;
  const sectionCsv = search.get('section');
  const dateCsv = search.get('date');
  const q = (search.get('q') ?? '').trim();
  const [qLocal, setQLocal] = useState(q);

  const sectionSet = useMemo(
    () => new Set((sectionCsv ?? '').split(',').filter(Boolean)),
    [sectionCsv]
  );
  const dateSet = useMemo(
    () => new Set((dateCsv ?? '').split(',').filter(Boolean)),
    [dateCsv]
  );

  // 인덱스
  const filmById = useMemo(
    () => Object.fromEntries(films.map((f) => [normId(f.id), f])),
    []
  );
  const entriesByFilmAndEdition = useMemo(() => {
    const m = new Map<string, Map<string, Entry>>();
    for (const e of entries) {
      const k = normId(e.filmId);
      const inner = m.get(k) ?? new Map<string, Entry>();
      inner.set(e.editionId, e);
      m.set(k, inner);
    }
    return m;
  }, []);
  const screeningsByEntry = useMemo(() => {
    const m = new Map<string, Screening[]>();
    for (const s of screenings)
      (m.get(s.entryId) ?? m.set(s.entryId, []).get(s.entryId)!).push(s);
    return m;
  }, []);

  // 현재 에디션 엔트리
  const editionEntries = useMemo(
    () => (edition === 'all' ? entries : entries.filter((e) => e.editionId === edition)),
    [edition]
  );

  // 섹션 후보(제공 순서 + 글씨 축소)
  const availableSections = useMemo(() => {
    if (edition === 'all') return [];
    const set = new Set<string>();
    for (const e of editionEntries) if (e.section) set.add(e.section);
    const arr = Array.from(set);
    const order = edition === 'edition_jiff_2025' ? ORDER_JIFF : ORDER_BIFF;
    const idx = (s: string) => {
      const i = order.indexOf(s);
      return i >= 0 ? i : 9999;
    };
    return arr.sort((a, b) => idx(a) - idx(b));
  }, [edition, editionEntries]);

  // 날짜 후보(표시: “M월 D일”, 내부: ISO 유지)
  const availableDates = useMemo(() => {
    if (edition === 'all') return [];
    const set = new Set<string>();
    for (const e of editionEntries)
      for (const s of screeningsByEntry.get(e.id) ?? []) set.add(ymd(s.startsAt));
    return Array.from(set).sort();
  }, [edition, editionEntries, screeningsByEntry]);

  // 필터링
  const filteredFilmIds = useMemo(() => {
    let es = edition === 'all' ? entries : entries.filter((e) => e.editionId === edition);

    if (edition !== 'all' && sectionSet.size) es = es.filter((e) => e.section && sectionSet.has(e.section));
    if (edition !== 'all' && dateSet.size) {
      const ok = new Set<string>();
      for (const e of es) {
        if ((screeningsByEntry.get(e.id) ?? []).some((s) => dateSet.has(ymd(s.startsAt)))) ok.add(e.id);
      }
      es = es.filter((e) => ok.has(e.id));
    }

    const filmIds = Array.from(new Set(es.map((e) => e.filmId)));
    const text = q.toLowerCase();

    return filmIds.filter((fid) => {
      const f = filmById[normId(fid)];
      if (!f) return false;
      if (text) {
        const hay = [
          f.title,
          f.title_ko ?? '',
          f.title_en ?? '',
          ...(f.credits?.directors ?? []),
          ...(f.genres ?? []),
          ...(f.creditTokens ?? []), // 있으면 전역 크레딧까지
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
  }, [edition, sectionSet, dateSet, q, filmById, screeningsByEntry]);

  // 리스트 렌더 데이터(대표 등급 계산 + 기본 정렬 규칙)
  const rows = useMemo(() => {
    const list = filteredFilmIds
      .map((fid) => {
        const f = filmById[normId(fid)];
        if (!f) return null;

        let entry: Entry | undefined;
        if (edition !== 'all') entry = entriesByFilmAndEdition.get(normId(fid))?.get(edition);

        let ratingHint: string | null = null;
        if (entry) {
          const arr = screeningsByEntry.get(entry.id) ?? [];
          const freq = new Map<string, number>();
          for (const s of arr) {
            const r = (s.rating ?? '').trim();
            if (!r) continue;
            freq.set(r, (freq.get(r) ?? 0) + 1);
          }
          let top: string | null = null;
          let topN = -1;
          for (const [k, v] of freq) if (v > topN) { top = k; topN = v; }
          ratingHint = top;
        }

        return { f, entry, ratingHint };
      })
      .filter(Boolean) as { f: Film; entry?: Entry; ratingHint?: string | null }[];

    // 페스티벌만 선택(섹션/날짜/검색 없음): 섹션 제공 순서 → 제목
    const isFestivalOnly =
      edition !== 'all' &&
      !sectionCsv && !dateCsv &&
      !(q && q.trim().length);

    if (isFestivalOnly) {
      const order = edition === 'edition_jiff_2025' ? ORDER_JIFF : ORDER_BIFF;
      const idx = (s?: string | null) => {
        if (!s) return 9999;
        const i = order.indexOf(s);
        return i >= 0 ? i : 9999;
      };
      return list.sort((a, b) => {
        const sa = idx(a.entry?.section);
        const sb = idx(b.entry?.section);
        if (sa !== sb) return sa - sb;
        return (a.f.title_en ?? a.f.title).localeCompare(b.f.title_en ?? b.f.title);
      });
    }

    // 그 외: 제목 기준
    return list.sort((a, b) =>
      (a.f.title_en ?? a.f.title).localeCompare(b.f.title_en ?? b.f.title)
    );
  }, [
    filteredFilmIds, filmById, entriesByFilmAndEdition, screeningsByEntry,
    edition, sectionCsv, dateCsv, q
  ]);

  // 평가 여부 세트
  const ratedSet = useMemo(
    () => new Set(ratedFilmIds.map((x) => normId(x))),
    [ratedFilmIds]
  );

  // 검색 핸들러
  const doSearch = (valueFromUi: string) => {
    const v = valueFromUi.trim();
    setQuery(router, pathname, search, { q: v || undefined });
  };
  const clearSearch = () => {
    setQLocal('');
    setQuery(router, pathname, search, { q: undefined });
  };

  return (
    <>
      {/* 필터 바 */}
      <div className="bg-white border rounded-lg p-3 space-y-3">
        {/* Festival 라디오: 붙여쓰기 라벨 + 손모양 */}
        <div className="flex flex-wrap items-center gap-3 radio-accent-orange">
          <span className="text-sm text-gray-600 mr-2">Festival</span>
          {radioOptions.map((opt) => (
            <label key={opt.id} className="inline-flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="radio"
                name="edition"
                className="cursor-pointer"
                checked={edition === opt.id}
                onChange={() =>
                  setQuery(router, pathname, search, {
                    edition: opt.id,
                    section: undefined,
                    date: undefined,
                  })
                }
              />
              {opt.label}
            </label>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch(qLocal); }}
            placeholder="Search title/director/tags/credits"
            className="flex-1 min-w-0 border rounded px-3 py-2 text-base md:text-sm"
            inputMode="search"
          />
          <button
            type="button"
            aria-label="Search"
            title="Search"
            onClick={() => doSearch(qLocal)}
            className="inline-flex items-center justify-center p-1.5 md:p-1 bg-transparent border-0 rounded-none hover:bg-transparent focus:outline-none focus:ring-0 cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
          {q && (
            <button
              className="text-xs underline text-gray-600 whitespace-nowrap cursor-pointer"
              onClick={clearSearch}
              title="Clear search"
            >
              Clear
            </button>
          )}
        </div>

        {/* Section: 글씨 축소 + 손모양 */}
        {edition !== 'all' && (
          <details>
            <summary className="cursor-pointer select-none text-[11px] text-gray-700 py-1">Section</summary>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {availableSections.length === 0 ? (
                <span className="text-[11px] text-gray-400">None</span>
              ) : (
                <>
                  <button
                    onClick={() => {
                      const allNow = isAllSelected(sectionCsv, availableSections);
                      setQuery(router, pathname, search, { section: allNow ? undefined : csvOfAll(availableSections) });
                    }}
                    className={`px-2 py-1 rounded border text-[11px] cursor-pointer ${isAllSelected(sectionCsv, availableSections) ? 'bg-black text-white' : 'bg-white'}`}
                    title="Select all sections"
                  >
                    All
                  </button>
                  {availableSections.map((sec) => {
                    const checked = sectionSet.has(sec);
                    return (
                      <button
                        key={sec}
                        onClick={() => setQuery(router, pathname, search, { section: toggleCsv(search.get('section'), sec) })}
                        className={`px-2 py-1 rounded border text-[11px] cursor-pointer ${checked ? 'bg-black text-white' : 'bg-white'}`}
                        title={sec}
                      >
                        {sec}
                      </button>
                    );
                  })}
                </>
              )}
              {sectionCsv && (
                <button
                  className="ml-2 text-[11px] underline text-gray-600 whitespace-nowrap cursor-pointer"
                  onClick={() => setQuery(router, pathname, search, { section: undefined })}
                  title="Reset sections"
                >
                  Reset
                </button>
              )}
            </div>
          </details>
        )}

        {/* Date: 글씨 축소, 표시는 “M월 D일” + 손모양 */}
        {edition !== 'all' && (
          <details>
            <summary className="cursor-pointer select-none text-[11px] text-gray-700 py-1">Date</summary>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {availableDates.length === 0 ? (
                <span className="text-[11px] text-gray-400">None</span>
              ) : (
                <>
                  <button
                    onClick={() => {
                      const allNow = isAllSelected(dateCsv, availableDates);
                      setQuery(router, pathname, search, { date: allNow ? undefined : csvOfAll(availableDates) });
                    }}
                    className={`px-2 py-1 rounded border text-[11px] cursor-pointer ${isAllSelected(dateCsv, availableDates) ? 'bg-black text-white' : 'bg-white'}`}
                    title="Select all dates"
                  >
                    All
                  </button>
                  {availableDates.map((d) => {
                    const checked = dateSet.has(d);
                    return (
                      <button
                        key={d}
                        onClick={() => setQuery(router, pathname, search, { date: toggleCsv(search.get('date'), d) })}
                        className={`px-2 py-1 rounded border text-[11px] cursor-pointer ${checked ? 'bg-black text-white' : 'bg-white'}`}
                        title={d}
                      >
                        {mdK(d)}
                      </button>
                    );
                  })}
                </>
              )}
              {dateCsv && (
                <button
                  className="ml-2 text-[11px] underline text-gray-600 whitespace-nowrap cursor-pointer"
                  onClick={() => setQuery(router, pathname, search, { date: undefined })}
                  title="Reset dates"
                >
                  Reset
                </button>
              )}
            </div>
          </details>
        )}

        {/* Clear all */}
        {edition !== 'all' && (sectionCsv || dateCsv) ? (
          <div>
            <button
              className="text-xs underline text-gray-600 whitespace-nowrap cursor-pointer"
              onClick={() => setQuery(router, pathname, search, { section: undefined, date: undefined })}
              title="Clear all filters"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      {/* Results */}
      <div className="text-sm text-gray-600 mb-6">Results {rows.length}</div>

      <ul className="space-y-3">
        {rows.map(({ f, entry, ratingHint }) => (
          <FilmListCard
            key={f.id}
            film={f}
            entry={entry}
            ratingHint={ratingHint ?? null}
            isRated={ratedSet.has(normId(f.id))}
          />
        ))}
      </ul>
    </>
  );
}
