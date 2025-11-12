// app/films/[id]/page.tsx
import { notFound } from 'next/navigation';

import filmsData from '@/data/films.json';
import entriesData from '@/data/entries.json';
import screeningsData from '@/data/screenings.json';
import creditsFull from '@/data/credits_full.json';

// 동시상영 코드→묶음 추론을 위한 원본 스냅샷
import ooffJIFF from '@/data/ooff_jiff2025.json';
import ooffBIFF from '@/data/ooff_biff2025.json';

import DetailClient from './DetailClient';
import RatingEditorClient from './RatingEditorClient';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Film = {
  id: string;
  title: string;
  title_ko?: string;
  title_en?: string;
  year: number;
  runtime?: number | null;
  countries?: string[];
  genres?: string[];
  synopsis?: string;
  credits?: { directors?: string[] };
  posters?: string[];               // 예: ["JIFF2025/images/film_5754.png", ...]
  film_num_id?: string;             // 단일 id 보강 시
  film_num_ids?: string[];          // 복수 id 보강 시
};

type Entry = {
  id: string;
  filmId: string;
  editionId: string;                // edition_jiff_2025 | edition_biff_2025
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
  startsAt?: string | null;         // ISO
  endsAt?: string | null;           // ISO or null
  venue?: string | null;
  rating?: string | null;           // All | 12 | 15 | 19
  dialogue?: string | null;         // E/H/K/KE/X
  subtitles?: string | null;        // E/K/KE/X
  withGV?: boolean;
};

type CreditFullRow = {
  filmId: string;                   // "5754" 등 숫자 문자열
  role: string;
  value: string;
  order?: number | null;
};

function normId(v: unknown): string {
  try { return decodeURIComponent(String(v ?? '')).trim().toLowerCase(); }
  catch { return String(v ?? '').trim().toLowerCase(); }
}
function edLabel(editionId: string) {
  if (editionId === 'edition_jiff_2025') return 'JIFF2025';
  if (editionId === 'edition_biff_2025') return 'BIFF2025';
  return editionId;
}
function isJIFF(editionId: string) { return editionId.startsWith('edition_jiff_'); }
function isBIFF(editionId: string) { return editionId.startsWith('edition_biff_'); }

function extractPosterNumIds(posters?: string[] | null): Set<string> {
  const out = new Set<string>();
  for (const p of posters ?? []) {
    const s = String(p);
    const re = /film_(\d+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) out.add(m[1]);
  }
  return out;
}

// 원본 JSON에서 code -> bundleFilmIds 인덱스 생성
function buildCodeToBundleMap(ooff: any): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const arr: any[] = Array.isArray(ooff) ? ooff : [];
  for (const item of arr) {
    const scrs: any[] = Array.isArray(item?.screenings) ? item.screenings : [];
    for (const s of scrs) {
      const code = (s?.code ?? '').toString().trim();
      if (!code) continue;
      const ids: string[] = Array.isArray(s?.bundleFilmIds) ? s.bundleFilmIds.map((x: any) => String(x)) : [];
      if (!ids.length) continue;
      const cur = map.get(code) ?? new Set<string>();
      ids.forEach(id => cur.add(id));
      map.set(code, cur);
    }
  }
  return map;
}
const codeToBundle_JIFF = buildCodeToBundleMap(ooffJIFF);
const codeToBundle_BIFF = buildCodeToBundleMap(ooffBIFF);

export default async function FilmDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // Next 16: params가 Promise일 수 있음
  const p = (params as any)?.then ? await (params as Promise<{ id: string }>) : (params as { id: string });
  const paramId = normId(p?.id);
  if (!paramId) return notFound();

  const films = filmsData as Film[];
  const entries = entriesData as Entry[];
  const screenings = screeningsData as Screening[];

  const film = films.find((f) => normId(f.id) === paramId);
  if (!film) return notFound();

  // 이 작품의 엔트리/에디션
  const filmEntries = entries.filter((e) => normId(e.filmId) === paramId);
  const allowedEditionIds = new Set(filmEntries.map((e) => e.editionId));

  // entryId -> editionId
  const entryIdToEdition = new Map<string, string>();
  for (const e of entries) entryIdToEdition.set(e.id, e.editionId);

  // entryId -> screenings
  const screeningsByEntry = new Map<string, Screening[]>();
  for (const s of screenings) {
    const key = s.entryId;
    if (!key) continue;
    (screeningsByEntry.get(key) ?? screeningsByEntry.set(key, []).get(key)!).push(s);
  }
  const screeningsThisFilm = filmEntries.flatMap((e) => screeningsByEntry.get(e.id) ?? []);

  // 동시상영(A+B+C): 이 영화가 포함된 code 집합(문자열 그대로)
  const codeSet = new Set<string>(
    screeningsThisFilm.map((s) => (s.code ?? '').toString().trim()).filter(Boolean)
  );

  // 같은 code 이더라도 **같은 에디션**인 상영만 포함
  const screeningsForCodes = screenings.filter((s) => {
    const c = (s.code ?? '').toString().trim();
    if (!c || !codeSet.has(c)) return false;
    const ed = entryIdToEdition.get(s.entryId);
    return ed ? allowedEditionIds.has(ed) : false;
  });

  // 코드 없음은 이 영화분만 포함(Fallback)
  const screeningsNoCode = screeningsThisFilm.filter((s) => !((s.code ?? '').toString().trim()));
  const screeningsForDetail = [...screeningsForCodes, ...screeningsNoCode];

  // entryId -> film 타이틀 매핑(동시상영 타 작품 표기용)
  const filmById = new Map(films.map((f) => [normId(f.id), f]));
  const entryToFilm: Record<string, { filmId: string; title_ko: string; title_en: string }> = {};
  for (const e of entries) {
    const f = filmById.get(normId(e.filmId));
    entryToFilm[e.id] = {
      filmId: f?.id ?? e.filmId,
      title_ko: f?.title_ko ?? '',
      title_en: f?.title_en ?? f?.title ?? '',
    };
  }

  // 대표 등급(상영정보 최빈값)
  const ratingFreq = new Map<string, number>();
  for (const s of screeningsThisFilm) {
    const r = (s.rating ?? '').toString().trim();
    if (!r) continue;
    ratingFreq.set(r, (ratingFreq.get(r) ?? 0) + 1);
  }
  let topRating: string | undefined;
  let topN = -1;
  for (const [k, v] of ratingFreq) if (v > topN) { topRating = k; topN = v; }

  // 메타라인
  const first = filmEntries[0];
  const metaBits = [
    (film.countries ?? []).join(', '),
    film.year ? String(film.year) : undefined,
    film.runtime != null ? `${film.runtime}min` : undefined,
    (first?.format ?? '') || undefined,
    (first?.color ?? '') || undefined,
    (film.genres?.length ? film.genres.join(', ') : undefined),
    (topRating ?? undefined),
    (first?.premiere ?? undefined),
  ].filter(Boolean) as string[];

  // 포스터 후보(원본 비율 그대로 표시)
  const posterCandidates = (film.posters ?? []).map((p) => `/${p}`);

  // 섹션 배지
  const sectionBadges = filmEntries
    .filter((e) => e.section && e.section.trim().length)
    .map((e, idx) => ({
      key: `${e.id}::${e.editionId}::${e.section ?? ''}::${idx}`,
      label: `${edLabel(e.editionId)} ${e.section!.trim()}`,
    }));

  // 시놉시스/Program Note 라벨
  const hasBIFF = filmEntries.some((e) => e.editionId === 'edition_biff_2025');
  const synopsisLabel = film.synopsis ? '시놉시스' : (hasBIFF ? 'Program Note' : '시놉시스');

  // ===== Credit 매칭: 명시 ID(단일/복수) ∪ code 기반 bundle ∪ 포스터 숫자 =====
  const explicitIds = new Set<string>();
  if ((film as any).film_num_id) explicitIds.add(String((film as any).film_num_id));
  if (Array.isArray((film as any).film_num_ids)) {
    for (const v of (film as any).film_num_ids) if (v != null) explicitIds.add(String(v));
  }

  // 이 작품 상영들의 code 집합(문자열 그대로)
  const thisCodes = new Set<string>(
    screeningsThisFilm.map(s => (s.code ?? '').toString().trim()).filter(Boolean)
  );

  // 에디션 스코프에 맞춰 원본 맵에서 bundleFilmIds 수집
  const bundleIds = new Set<string>();
  for (const e of filmEntries) {
    for (const c of thisCodes) {
      if (isJIFF(e.editionId)) codeToBundle_JIFF.get(c)?.forEach(id => bundleIds.add(String(id)));
      else if (isBIFF(e.editionId)) codeToBundle_BIFF.get(c)?.forEach(id => bundleIds.add(String(id)));
    }
  }

  // 포스터 파일명에서 추출한 숫자도 보강
  const posterIds = extractPosterNumIds(film.posters);
  posterIds.forEach(id => bundleIds.add(id));

  const allIds = new Set<string>([...explicitIds, ...bundleIds]);

  // credits_full.json → 매칭되는 행만
  const creditRows = (creditsFull as CreditFullRow[]).filter((c) => allIds.has(String(c.filmId)));

  return (
    <section className="max-w-3xl mx-auto pt-0 pb-4 px-3 sm:px-4 space-y-3">
      {/* 히어로: 그라데이션/배경 제거, 원본 비율 그대로 */}
      {posterCandidates.length > 0 && (
        <div className="-mt-px relative overflow-hidden rounded-none">
          <img
            src={posterCandidates[0]}
            alt={`${film.title_ko ?? film.title} poster`}
            className="relative z-10 w-full h-auto object-contain"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        </div>
      )}

      {/* 배지/타이틀/메타 */}
      <header className="space-y-1">
        {!!sectionBadges.length && (
          <div className="flex flex-wrap gap-1 -mt-1">
            {sectionBadges.map((b) => (
              <span key={b.key} className="text-[11px] px-2 py-0.5 rounded-full border">
                {b.label}
              </span>
            ))}
          </div>
        )}

        <h1 className="text-[1.25rem] sm:text-[1.35rem] font-semibold leading-snug">
          {film.title_ko ?? film.title}
        </h1>

        {film.title_en && (
          <div className="text-[0.95rem] sm:text-[1.0rem] leading-snug text-gray-800">
            {film.title_en}
          </div>
        )}

        {!!(film.credits?.directors?.length) && (
          <div className="text-[0.875rem] text-gray-700">
            Director : {film.credits!.directors!.join(', ')}
          </div>
        )}

        {metaBits.length > 0 && (
          <p className="text-[0.875rem] text-gray-600 whitespace-pre-wrap break-words">
            {metaBits.join(' | ')}
          </p>
        )}
      </header>

      {/* 시놉시스 / Program Note */}
      {(film.synopsis || hasBIFF) && (
        <section>
          <h2 className="text-base font-semibold mb-1">{synopsisLabel}</h2>
          {film.synopsis ? (
            <p className="text-[0.875rem] leading-relaxed text-gray-800">{film.synopsis}</p>
          ) : hasBIFF ? (
            <p className="text-[0.875rem] leading-relaxed text-gray-800">
              Program note is not separately provided in JSON. Please refer to festival source if needed.
            </p>
          ) : null}
        </section>
      )}

      {/* 상영시간 + 크레딧 */}
      <DetailClient
        film={{
          id: film.id,
          title: film.title,
          title_ko: film.title_ko ?? '',
          title_en: film.title_en ?? '',
          year: film.year,
          countries: film.countries ?? [],
          runtime: film.runtime ?? undefined,
          genres: film.genres ?? [],
          synopsis: film.synopsis ?? '',
          credits: film.credits ?? { directors: [] },
        }}
        entries={filmEntries}
        screenings={screeningsForDetail}
        entryToFilm={entryToFilm}
        creditRows={creditRows}
      />
      <div className="mt-6 sm:mt-8">
        <RatingEditorClient filmId={film.id} />
      </div>
    </section>
  );
}
