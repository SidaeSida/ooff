'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import filmsData from '../../data/films.json';
import entriesData from '../../data/entries.json';
import screeningsData from '../../data/screenings.json';
import editionsData from '../../data/editions.json';

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
type Screening = { id: string; entryId: string; startsAt: string; venue: string; city?: string };
type Edition = { id: string; festivalId: string; year: number; editionNumber?: number };

const films = filmsData as Film[];
const entries = entriesData as Entry[];
const screenings = screeningsData as Screening[];
const editions = editionsData as Edition[];

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
function ymd(iso: string) {
  return iso.slice(0, 10);
}

export default function FilmsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // URL에 edition이 없으면 첫 마운트에 기본값 주입
  useEffect(() => {
    if (!search.get('edition')) {
      const sp = new URLSearchParams(search.toString());
      sp.set('edition', DEFAULT_EDITION);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const edition = search.get('edition') ?? DEFAULT_EDITION;
  const sectionCsv = search.get('section');
  const dateCsv = search.get('date');
  const genreCsv = search.get('genre');
  const q = (search.get('q') ?? '').trim();

  const sectionSet = useMemo(() => new Set((sectionCsv ?? '').split(',').filter(Boolean)), [sectionCsv]);
  const dateSet = useMemo(() => new Set((dateCsv ?? '').split(',').filter(Boolean)), [dateCsv]);
  const genreSet = useMemo(() => new Set((genreCsv ?? '').split(',').filter(Boolean)), [genreCsv]);

  // 인덱스
  const screeningsByEntry = useMemo(() => {
    const m = new Map<string, Screening[]>();
    for (const s of screenings) {
      (m.get(s.entryId) ?? m.set(s.entryId, []).get(s.entryId)!).push(s);
    }
    return m;
  }, []);
  const filmById = useMemo(() => Object.fromEntries(films.map(f => [f.id, f])), []);

  // 옵션 소스
  const editionEntries = useMemo(
    () => (edition === 'all' ? entries : entries.filter(e => e.editionId === edition)),
    [edition]
  );

  const availableSections = useMemo(() => {
    const set = new Set<string>();
    for (const e of editionEntries) if (e.section) set.add(e.section);
    return Array.from(set).sort();
  }, [editionEntries]);

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const e of editionEntries)
      for (const s of screeningsByEntry.get(e.id) ?? []) set.add(ymd(s.startsAt));
    return Array.from(set).sort();
  }, [editionEntries, screeningsByEntry]);

  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    for (const f of films) (f.genres ?? []).forEach(g => set.add(g));
    return Array.from(set).sort();
  }, []);

  // 필터 체인
  const filteredFilmIds = useMemo(() => {
    let es = edition === 'all' ? entries : entries.filter(e => e.editionId === edition);
    if (sectionSet.size) es = es.filter(e => e.section && sectionSet.has(e.section));
    if (dateSet.size) {
      const ok = new Set<string>();
      for (const e of es)
        if ((screeningsByEntry.get(e.id) ?? []).some(s => dateSet.has(ymd(s.startsAt)))) ok.add(e.id);
      es = es.filter(e => ok.has(e.id));
    }
    const filmIds = Array.from(new Set(es.map(e => e.filmId)));
    const text = q.toLowerCase();
    return filmIds.filter(fid => {
      const f = filmById[fid];
      if (!f) return false;
      if (genreSet.size) {
        const genres = new Set(f.genres ?? []);
        if (![...genreSet].some(g => genres.has(g))) return false;
      }
      if (text) {
        const hay = [f.title, ...(f.credits?.directors ?? []), ...(f.tags ?? [])].join(' ').toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
  }, [edition, sectionSet, dateSet, genreSet, q, filmById, screeningsByEntry]);

  const filmsResult = useMemo(
    () => filteredFilmIds.map(id => filmById[id]).filter(Boolean).sort((a, b) => a.title.localeCompare(b.title)),
    [filteredFilmIds, filmById]
  );

  return (
    <>
      {/* FILTER BAR */}
      <div className="bg-white border rounded-lg p-3 space-y-3">
        {/* Festival (라디오) */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600 mr-2">Festival</span>
          {[
            { id: DEFAULT_EDITION, label: 'HIFF 2026' },
            { id: 'edition_wiff_2025', label: 'WIFF 2025' },
            { id: 'all', label: 'All' }
          ].map(opt => (
            <label key={opt.id} className="inline-flex items-center gap-1 text-sm">
              <input
                type="radio"
                name="edition"
                checked={edition === opt.id}
                onChange={() => setQuery(router, pathname, search, { edition: opt.id })}
              />
              {opt.label}
            </label>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <input
            type="search"
            defaultValue={q}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const v = (e.target as HTMLInputElement).value.trim();
                setQuery(router, pathname, search, { q: v || undefined });
              }
            }}
            placeholder="Search title/director/tags"
            className="flex-1 min-w-0 border rounded px-3 py-2 text-sm"
          />
          {q && (
            <button
              className="text-xs underline text-gray-600 whitespace-nowrap"
              onClick={() => setQuery(router, pathname, search, { q: undefined })}
            >
              Clear
            </button>
          )}
        </div>

        {/* Section */}
        <details>
          <summary className="cursor-pointer select-none text-sm text-gray-700 py-1">Section</summary>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {availableSections.length === 0 ? (
              <span className="text-sm text-gray-400">None</span>
            ) : (
              availableSections.map(sec => {
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
              })
            )}
            {sectionCsv && (
              <button
                className="ml-2 text-xs underline text-gray-600 whitespace-nowrap"
                onClick={() => setQuery(router, pathname, search, { section: undefined })}
              >
                Reset
              </button>
            )}
          </div>
        </details>

        {/* Date */}
        <details>
          <summary className="cursor-pointer select-none text-sm text-gray-700 py-1">Date</summary>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {availableDates.length === 0 ? (
              <span className="text-sm text-gray-400">None</span>
            ) : (
              availableDates.map(d => {
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
              })
            )}
            {dateCsv && (
              <button
                className="ml-2 text-xs underline text-gray-600 whitespace-nowrap"
                onClick={() => setQuery(router, pathname, search, { date: undefined })}
              >
                Reset
              </button>
            )}
          </div>
        </details>

        {/* Genre */}
        <details>
          <summary className="cursor-pointer select-none text-sm text-gray-700 py-1">Genre</summary>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {availableGenres.length === 0 ? (
              <span className="text-sm text-gray-400">None</span>
            ) : (
              availableGenres.map(g => {
                const checked = genreSet.has(g);
                return (
                  <button
                    key={g}
                    onClick={() => setQuery(router, pathname, search, { genre: toggleCsv(search.get('genre'), g) })}
                    className={`px-2 py-1 rounded border text-sm ${checked ? 'bg-black text-white' : 'bg-white'}`}
                  >
                    {g}
                  </button>
                );
              })
            )}
            {genreCsv && (
              <button
                className="ml-2 text-xs underline text-gray-600 whitespace-nowrap"
                onClick={() => setQuery(router, pathname, search, { genre: undefined })}
              >
                Reset
              </button>
            )}
          </div>
        </details>

        {/* Clear all */}
        {(sectionCsv || dateCsv || genreCsv || q) && (
          <div>
            <button
              className="text-xs underline text-gray-600 whitespace-nowrap"
              onClick={() =>
                setQuery(router, pathname, search, {
                  section: undefined,
                  date: undefined,
                  genre: undefined,
                  q: undefined,
                })
              }
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-600">Results {filmsResult.length}</div>

      <ul className="space-y-3">
        {filmsResult.map(f => (
          <li key={f.id} className="border rounded-lg p-4 bg-white">
            <a href={`/films/${f.id}`} className="block">
              <div className="font-medium">
                {f.title} <span className="text-gray-500">({f.year})</span>
              </div>
              <div className="text-sm text-gray-600">· {f.runtime}min</div>
              {f.synopsis && <p className="text-sm mt-2 line-clamp-2">{f.synopsis}</p>}
              {f.genres?.length ? <div className="mt-2 text-xs text-gray-500">Genre: {f.genres.join(', ')}</div> : null}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
