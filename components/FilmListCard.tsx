'use client';

type Film = {
  id: string;
  title: string;
  title_ko?: string;
  title_en?: string;
  year: number;
  countries?: string[];
  runtime?: number;
  genres?: string[];
  festivalBadges?: string[]; // ["JIFF 2025","BIFF 2025"]
  credits?: { directors?: string[] };
};

type EntryLite = {
  id: string;
  filmId: string;
  editionId: string;
  section?: string | null;
  format?: string | null;
  color?: string | null;
  premiere?: string | null;
};

type Props = {
  film: Film;
  entry?: EntryLite;          // 선택된 페스티벌 컨텍스트(섹션/포맷/프리미어)
  ratingHint?: string | null; // 대표 등급(없으면 생략)
  isRated?: boolean;          // 평가 여부에 따라 카드 배경/보더/텍스트 변경
};

function metaJoin(parts: (string | number | null | undefined)[]) {
  return parts.filter(Boolean).join(' | ');
}

export default function FilmListCard({ film, entry, ratingHint, isRated }: Props) {
  const directors = film.credits?.directors ?? [];
  const meta = metaJoin([
    (film.countries ?? []).join(', ') || null,
    film.year,
    film.runtime ? `${film.runtime}min` : null,
    entry?.format ?? null,
    entry?.color ?? null,
    (film.genres ?? []).join(', ') || null,
    ratingHint ?? null,
    entry?.premiere ?? null,
  ]);

  const bg = isRated ? 'var(--bg-rated)' : 'var(--bg-unrated)';
  const bd = isRated ? 'var(--bd-rated)' : 'var(--bd-unrated)';
  const hover = isRated ? 'var(--bg-hover-r)' : 'var(--bg-hover-u)';

  const clsSection = isRated ? 'text-[11px] text-white/80' : 'text-[11px] text-gray-700';
  const clsKoTitle = isRated ? 'font-semibold text-[1.0rem] leading-snug text-white truncate'
                             : 'font-semibold text-[1.0rem] leading-snug truncate';
  const clsEnTitle = isRated ? 'font-medium text-[1.0rem] leading-snug text-white/90 truncate'
                             : 'font-medium text-[1.0rem] leading-snug text-gray-800 truncate';
  const clsDirector = isRated ? 'text-[0.875rem] text-white/90 mt-1 truncate'
                              : 'text-[0.875rem] text-gray-700 mt-1 truncate';
  const clsMeta = isRated ? 'text-[0.875rem] text-white/80 mt-1 whitespace-pre-wrap break-words'
                          : 'text-[0.875rem] text-gray-600 mt-1 whitespace-pre-wrap break-words';
  const clsBadge = isRated ? 'text-[10px] px-1.5 py-0.5 rounded-full border border-white/50 text-white/90'
                           : 'text-[10px] px-1.5 py-0.5 rounded-full border';

  return (
    <li
      className="border rounded-lg p-4 transition"
      style={{ background: bg, borderColor: bd }}
    >
      <a
        href={`/films/${encodeURIComponent(film.id)}`}
        className="block no-underline cursor-pointer"
        onMouseEnter={(e) => ((e.currentTarget.parentElement as HTMLLIElement).style.background = hover)}
        onMouseLeave={(e) => ((e.currentTarget.parentElement as HTMLLIElement).style.background = bg)}
      >
        {/* 섹션 */}
        {entry?.section && (
          <div className={`${clsSection} mb-1 truncate`}>{entry.section}</div>
        )}

        {/* 한글 / 영어 제목 */}
        <div className={clsKoTitle}>
          {film.title_ko ?? film.title}
        </div>
        {film.title_en && (
          <div className={clsEnTitle}>
            {film.title_en}
          </div>
        )}

        {/* 감독 */}
        {!!directors.length && (
          <div className={clsDirector}>
            Director : {directors.join(', ')}
          </div>
        )}

        {/* 메타라인: 줄바꿈 허용 */}
        {meta && (
          <div className={clsMeta}>
            {meta}
          </div>
        )}

        {/* 배지: 출품 페스티벌 */}
        {!!(film.festivalBadges?.length) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {film.festivalBadges!.map((b) => (
              <span key={b} className={clsBadge}>
                {b}
              </span>
            ))}
          </div>
        )}
      </a>
    </li>
  );
}
