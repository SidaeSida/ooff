'use client';

import { useState } from 'react';
import Link from 'next/link';

// FilmsClient.tsx의 Film 타입과 호환되도록 정의 (posters 포함)
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
  posters?: string[];
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
  entry?: EntryLite;
  ratingHint?: string | null;
  isRated?: boolean;
};

export default function FilmListCard({ film, entry, ratingHint, isRated }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const directors = film.credits?.directors ?? [];
  
  // 숨겨진 상세 정보 조합
  const hiddenMeta = [
    film.title_en || null,
    (film.countries ?? []).join(', ') || null,
    film.year,
    film.runtime ? `${film.runtime}min` : null,
    entry?.format ?? null,
    entry?.color ?? null,
    (film.genres ?? []).join(', ') || null,
    entry?.premiere ?? null,
  ].filter(Boolean);

  // 태그 포맷팅 (공백 제거: JIFF 2025 -> JIFF2025)
  const formattedBadges = (film.festivalBadges ?? []).map(b => b.replace(/\s+/g, ''));

  // 스타일 변수 (CSS Variable 활용)
  const bg = isRated ? 'var(--bg-rated)' : 'var(--bg-unrated)';
  const bd = isRated ? 'var(--bd-rated)' : 'var(--bd-unrated)';

  // 텍스트 색상 (Rated 상태에 따라 반전)
  const textPrimary = isRated ? 'text-white' : 'text-gray-900';
  const textSecondary = isRated ? 'text-white/80' : 'text-gray-600';
  const iconColor = isRated ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-gray-700';

  const posterSrc = film.posters?.[0];

  return (
    <li
      className="rounded-lg transition-colors duration-200 overflow-hidden"
      style={{ background: bg, border: `1px solid ${bd}` }}
    >
      <div className="flex p-3 sm:p-4 gap-3">
        {/* [Left] 텍스트 정보 영역 */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* 상단: 섹션 + 확장 버튼 */}
          <div className="flex items-start justify-between mb-1">
            <div className="flex flex-wrap gap-2 items-center min-w-0">
              {entry?.section && (
                <span className={`text-[11px] font-medium truncate border px-1.5 py-0.5 rounded ${isRated ? 'border-white/30 text-white/90' : 'border-gray-300 text-gray-500'}`}>
                  {entry.section}
                </span>
              )}
            </div>
            
            {/* [Interaction] 접기/펼치기 버튼 */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className={`p-1 -mr-2 -mt-1 rounded-full transition-transform duration-200 ${iconColor} ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
              aria-label="Toggle details"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>

          {/* [Link] 메인 링크 (제목/감독) */}
          <Link href={`/films/${encodeURIComponent(film.id)}`} className="block group">
            <h3 className={`font-bold text-[1.05rem] leading-snug break-keep ${textPrimary} group-hover:underline`}>
              {film.title_ko ?? film.title}
            </h3>
            
            {!!directors.length && (
              <p className={`text-[0.85rem] mt-0.5 truncate ${textSecondary}`}>
                {directors.join(', ')}
              </p>
            )}
          </Link>

          {/* [Expanded] 숨겨진 정보 영역 */}
          <div 
            className={`grid transition-all duration-300 ease-in-out ${
              isExpanded ? "grid-rows-[1fr] opacity-100 mt-2 pb-1" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className={`text-[0.8rem] space-y-1 ${textSecondary} border-t ${isRated ? 'border-white/20' : 'border-gray-200'} pt-2`}>
                <div className="leading-tight break-words">{hiddenMeta.join(' | ')}</div>
              </div>
              <div className="pt-2">
                 <Link 
                   href={`/films/${film.id}`}
                   className={`text-xs underline hover:no-underline ${isRated ? "text-white" : "text-black"}`}
                 >
                   View Details →
                 </Link>
              </div>
            </div>
          </div>

          {/* 하단: 태그 & Rating Hint (수정됨: 별표 제거 및 배지 스타일) */}
          <div className="mt-auto pt-2 flex flex-wrap gap-1.5 items-center">
             {/* Rating Hint (관람 등급) */}
             {ratingHint && (
               <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                 isRated 
                   ? 'border-white/50 text-white/90' 
                   : 'border-gray-400 text-gray-600'
               }`}>
                 {ratingHint}
               </span>
             )}

            {/* Badges (JIFF2025 등) */}
            {formattedBadges.map((badge) => (
              <span 
                key={badge} 
                className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                  isRated 
                    ? 'border-white/40 text-white/80' 
                    : 'border-gray-300 text-gray-500'
                }`}
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* [Right] 포스터 이미지 */}
        <Link 
          href={`/films/${encodeURIComponent(film.id)}`} 
          className="shrink-0 w-[60px] self-start"
        >
          {posterSrc ? (
            <img
              src={`/${posterSrc}`}
              alt={film.title}
              className="w-full h-auto rounded-md shadow-sm object-cover aspect-[2/3]"
              loading="lazy"
            />
          ) : (
            <div 
              className={`w-full aspect-[2/3] rounded-md border flex items-center justify-center text-[9px] ${
                isRated 
                  ? 'bg-white/10 border-white/10 text-white/40' 
                  : 'bg-gray-100 border-gray-200 text-gray-400'
              }`}
            >
              No Img
            </div>
          )}
        </Link>
      </div>
    </li>
  );
}