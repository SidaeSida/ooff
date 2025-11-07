'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import filmsData from '@/data/films.json';
import entriesData from '@/data/entries.json';
import screeningsData from '@/data/screenings.json';

type Film = {
  id: string;
  title: string;
  year: number;
  runtime: number;
  genres?: string[];
  tags?: string[];
  synopsis?: string;
  credits?: { directors?: string[] };
};
type Entry = { id: string; filmId: string; editionId: string; section?: string };
type Screening = { id: string; entryId: string; startsAt: string; venue: string };

const films = filmsData as Film[];
const entries = entriesData as Entry[];
const screenings = screeningsData as Screening[];

const DEFAULT_EDITION = 'edition_hiff_2026';

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
function ymd(iso: string) { return iso.slice(0, 10); }
function normId(s: string) {
  try {
    return decodeURIComponent(String(s)).trim().toLowerCase();
  } catch {
    return String(s).trim().toLowerCase();
  }
}

export default function FilmsClient({ ratedFilmIds }: { ratedFilmIds: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // URL에 edition이 없으면 “표시”만 기본값으로; URL은 변경하지 않음
  const edition = search.get('edition') ?? DEFAULT_EDITION;
  const sectionCsv = search.get('section');
  const dateCsv = search.get('date');
  const q = (search.get('q') ?? '').trim();

  // (1,3) 모바일 확대 방지 + Clear 동기화를 위해 로컬 상태로 제어
  const [qLocal, setQLocal] = useState(q);

  const sectionSet = useMemo(
    () => new Set((sectionCsv ?? '').split(',').filter(Boolean)),
    [sectionCsv]
  );
  const dateSet = useMemo(
    () => new Set((dateCsv ?? '').split(',').filter(Boolean)),
    [dateCsv]
  );

  const screeningsByEntry = useMemo(() => {
    const m = new Map<string, Screening[]>();
    for (const s of screenings)
      (m.get(s.entryId) ?? m.set(s.entryId, []).get(s.entryId)!).push(s);
    return m;
  }, []);
  const filmById = useMemo(
    () => Object.fromEntries(films.map((f) => [normId(f.id), f])),
    []
  );

  const editionEntries = useMemo(
    () => (edition === 'all' ? entries : entries.filter((e) => e.editionId === edition)),
    [edition]
  );

  const availableSections = useMemo(() => {
    if (edition === 'all') return [];
    const set = new Set<string>();
    for (const e of editionEntries) if (e.section) set.add(e.section);
    return Array.from(set).sort();
  }, [edition, editionEntries]);

  const availableDates = useMemo(() => {
    if (edition === 'all') return [];
    const set = new Set<string>();
    for (const e of editionEntries)
      for (const s of screeningsByEntry.get(e.id) ?? []) set.add(ymd(s.startsAt));
    return Array.from(set).sort();
  }, [edition, editionEntries, screeningsByEntry]);

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
        const hay = [f.title, ...(f.credits?.directors ?? []), ...(f.tags ?? [])]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
  }, [edition, sectionSet, dateSet, q, filmById, screeningsByEntry]);

  const filmsResult = useMemo(
    () => filteredFilmIds
      .map((id) => filmById[normId(id)])
      .filter(Boolean)
      .sort((a, b) => a.title.localeCompare(b.title)),
    [filteredFilmIds, filmById]
  );

  // ★ rated 강조: 서버 주입 값 이미 정규화되어 들어옴; 비교도 정규화
  const ratedSet = useMemo(() => new Set(ratedFilmIds), [ratedFilmIds]);

  // 공용 핸들러
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
        {/* Festival 라디오: 전용 클래스로 주황 accent 적용 */}
        <div className="flex flex-wrap items-center gap-3 radio-accent-orange">
          <span className="text-sm text-gray-600 mr-2">Festival</span>
          {[
            { id: DEFAULT_EDITION, label: 'HIFF 2026' },
            { id: 'edition_wiff_2025', label: 'WIFF 2025' },
            { id: 'all', label: 'All' }
          ].map((opt) => (
            <label key={opt.id} className="inline-flex items-center gap-1 text-sm">
              <input
                type="radio"
                name="edition"
                checked={edition === opt.id}
                onChange={() => setQuery(router, pathname, search, { edition: opt.id, section: undefined, date: undefined })}
              />
              {opt.label}
            </label>
          ))}
        </div>

        {/* Search 입력 + 아이콘 버튼 + Clear */}
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch(qLocal); }}
            placeholder="Search title/director/tags"
            className="flex-1 min-w-0 border rounded px-3 py-2 text-base md:text-sm"
            inputMode="search"
          />
          <button
            type="button"
            aria-label="Search"
            title="Search"
            onClick={() => doSearch(qLocal)}
            className="h-9 w-9 md:h-8 md:w-8 rounded-full border inline-flex items-center justify-center hover:bg-gray-50 focus:outline-none"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
          {q && (
            <button className="text-xs underline text-gray-600 whitespace-nowrap" onClick={clearSearch}>
              Clear
            </button>
          )}
        </div>

        {/* Section */}
        {edition !== 'all' && (
          <details>
            <summary className="cursor-pointer select-none text-sm text-gray-700 py-1">Section</summary>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {availableSections.length === 0 ? (
                <span className="text-sm text-gray-400">None</span>
              ) : (
                <>
                  <button
                    onClick={() => {
                      const allNow = isAllSelected(sectionCsv, availableSections);
                      setQuery(router, pathname, search, { section: allNow ? undefined : csvOfAll(availableSections) });
                    }}
                    className={`px-2 py-1 rounded border text-sm ${isAllSelected(sectionCsv, availableSections) ? 'bg-black text-white' : 'bg-white'}`}
                  >
                    All
                  </button>
                  {availableSections.map((sec) => {
                    const checked = sectionSet.has(sec);
                    return (
                      <button
                        key={sec}
                        onClick={() => setQuery(router, pathname, search, { section: toggleCsv(search.get('section'), sec) })}
                        className={`px-2 py-1 rounded border text-sm ${checked ? 'bg-black text-white' : 'bg-white'}`}
                      >
                        {sec}
                      </button>
                    );
                  })}
                </>
              )}
              {sectionCsv && (
                <button className="ml-2 text-xs underline text-gray-600 whitespace-nowrap" onClick={() => setQuery(router, pathname, search, { section: undefined })}>
                  Reset
                </button>
              )}
            </div>
          </details>
        )}

        {/* Date */}
        {edition !== 'all' && (
          <details>
            <summary className="cursor-pointer select-none text-sm text-gray-700 py-1">Date</summary>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {availableDates.length === 0 ? (
                <span className="text-sm text-gray-400">None</span>
              ) : (
                <>
                  <button
                    onClick={() => {
                      const allNow = isAllSelected(dateCsv, availableDates);
                      setQuery(router, pathname, search, { date: allNow ? undefined : csvOfAll(availableDates) });
                    }}
                    className={`px-2 py-1 rounded border text-sm ${isAllSelected(dateCsv, availableDates) ? 'bg-black text-white' : 'bg-white'}`}
                  >
                    All
                  </button>
                  {availableDates.map((d) => {
                    const checked = dateSet.has(d);
                    return (
                      <button
                        key={d}
                        onClick={() => setQuery(router, pathname, search, { date: toggleCsv(search.get('date'), d) })}
                        className={`px-2 py-1 rounded border text-sm ${checked ? 'bg-black text-white' : 'bg-white'}`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </>
              )}
              {dateCsv && (
                <button className="ml-2 text-xs underline text-gray-600 whitespace-nowrap" onClick={() => setQuery(router, pathname, search, { date: undefined })}>
                  Reset
                </button>
              )}
            </div>
          </details>
        )}

        {/* (4) All일 때는 하단 Clear all 숨김 */}
        {edition !== 'all' && (sectionCsv || dateCsv) ? (
          <div>
            <button
              className="text-xs underline text-gray-600 whitespace-nowrap"
              onClick={() => setQuery(router, pathname, search, { section: undefined, date: undefined })}
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      {/* (5) Results 라벨에 명시적 하단 여백 부여 */}
      <div className="text-sm text-gray-600 mb-6">Results {filmsResult.length}</div>

      <ul className="space-y-3">
        {filmsResult.map((f) => {
          const isRated = ratedSet.has(normId(f.id));
          return (
            <li
              key={f.id}
              className="border rounded-lg p-4 transition-colors duration-300 ease-out"
              style={{
                background: isRated ? 'var(--bg-rated)' : 'var(--bg-unrated)',
                borderColor: isRated ? 'var(--bd-rated)' : 'var(--bd-unrated)',
              }}
            >
              <a href={`/films/${encodeURIComponent(f.id)}`} className="block">
                <div className={`font-medium ${isRated ? 'text-white' : ''}`}>
                  {f.title}{' '}
                  <span className={isRated ? 'text-white/80' : 'text-gray-500'}>({f.year})</span>
                </div>

                <div className={`text-sm ${isRated ? 'text-white/80' : 'text-gray-600'}`}>
                  · {f.runtime}min
                </div>

                {f.synopsis && (
                  <p className={`text-sm mt-2 line-clamp-2 ${isRated ? 'text-white/90' : ''}`}>
                    {f.synopsis}
                  </p>
                )}

                {f.genres?.length ? (
                  <div className={`mt-2 text-xs ${isRated ? 'text-white/70' : 'text-gray-500'}`}>
                    Genre: {f.genres.join(', ')}
                  </div>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}
