'use client';

import { useMemo, useState } from 'react';

type Film = {
  id: string;
  title: string;
  title_ko?: string;
  title_en?: string;
  year: number;
  countries?: string[];
  runtime?: number;
  genres?: string[];
  synopsis?: string;
  credits?: { directors?: string[] };
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
  startsAt?: string | null;    // ISO
  endsAt?: string | null;      // ISO or null
  venue?: string | null;
  rating?: string | null;      // All | 12 | 15 | 19
  dialogue?: string | null;    // E/H/K/KE/X
  subtitles?: string | null;   // E/K/KE/X
  withGV?: boolean;
};

type EntryToFilm = Record<string, { filmId: string; title_ko: string; title_en: string }>;

type CreditRow = { filmId: string; role: string; value: string; order?: number | null };

function ymd(iso?: string | null) { return iso ? iso.slice(0, 10) : ''; }
function mdK(iso?: string | null) {
  if (!iso) return '';
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return `${m}월 ${d}일`;
}
function hm(iso?: string | null) { return iso ? iso.slice(11, 16) : ''; }

export default function DetailClient({
  film,
  entries,
  screenings,
  entryToFilm,
  posterCandidates,
  creditRows,
}: {
  film: Film;
  entries: Entry[];
  screenings: Screening[];
  entryToFilm: EntryToFilm;
  posterCandidates: string[];
  creditRows: CreditRow[];
}) {
  // 포스터 onError 대체(후보 순회)
  const [posterIdx, setPosterIdx] = useState(0);
  const posterSrc = posterCandidates[posterIdx] ?? '';

  // 그룹핑: 동일 code 묶음(+ 코드 없음은 날짜/시간/장소로 Fallback), 날짜 기준 정렬
  const groups = useMemo(() => {
    const byCode = new Map<string, Screening[]>();
    for (const s of screenings) {
      const key = (s.code ?? '').trim();
      if (!key) continue;
      (byCode.get(key) ?? byCode.set(key, []).get(key)!).push(s);
    }
    for (const s of screenings) {
      const key = (s.code ?? '').trim();
      if (key) continue;
      const fb = `__${ymd(s.startsAt)}_${hm(s.startsAt)}_${s.venue ?? ''}`;
      (byCode.get(fb) ?? byCode.set(fb, []).get(fb)!).push(s);
    }
    const toKey = (s: Screening) => `${ymd(s.startsAt)} ${hm(s.startsAt)} ${s.venue ?? ''}`;
    const arr = Array.from(byCode.entries()).map(([code, items]) => {
      const ordered = [...items].sort((a, b) => toKey(a).localeCompare(toKey(b)));
      return { code, items: ordered };
    });
    arr.sort((a, b) => toKey(a.items[0]).localeCompare(toKey(b.items[0])));
    return arr;
  }, [screenings]);

  // 크레딧: 역할별 그룹 + 정렬(Director 우선, 나머지는 알파벳)
  const creditByRole = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of creditRows) {
      const role = (c.role || '').trim();
      const value = (c.value || '').trim();
      if (!role || !value) continue;
      (map.get(role) ?? map.set(role, []).get(role)!).push(value);
    }
    // 역할별 중복 제거(입력 순서 유지)
    for (const [k, arr] of map) {
      const seen = new Set<string>();
      map.set(
        k,
        arr.filter((v) => {
          const key = v.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
      );
    }
    return map;
  }, [creditRows]);

  const orderedRoles = useMemo(() => {
    const present = Array.from(creditByRole.keys());
    const preferred = ['Director', 'Cast', 'Producer', 'Screenwriter', 'Cinematography', 'Editor', 'Music', 'Sound', 'Art Director'];
    const head = preferred.filter((r) => present.includes(r));
    const tail = present.filter((r) => !head.includes(r)).sort((a, b) => a.localeCompare(b));
    return [...head, ...tail];
  }, [creditByRole]);

  return (
    <div className="space-y-8">
      {/* 상영시간 */}
      <section>
        <h2 className="text-base font-semibold mb-2">상영시간</h2>
        <div className="space-y-2">
          {groups.map(({ code, items }) => {
            const a = items[0];
            const dateLabel = mdK(a.startsAt);
            const timeLabel = a.endsAt ? `${hm(a.startsAt)}–${hm(a.endsAt)}` : `${hm(a.startsAt)}`;
            const venue = a.venue ?? '';

            const rating = (a.rating ?? '').trim();
            const dialog = (a.dialogue ?? '').trim();
            const subs = (a.subtitles ?? '').trim();
            const lang = dialog && subs ? `${dialog}/${subs}` : (dialog || subs || '');

            // 동시상영 묶음 타이틀(원본 순서 유지, 현재 작품만 굵게)
            const entryIds = Array.from(new Set(items.map((s) => s.entryId)));
            const pieces = entryIds
              .map((eid) => entryToFilm[eid])
              .filter(Boolean)
              .map((x) => {
                const t = x.title_ko || x.title_en || x.filmId;
                if (!t) return '';
                return x.filmId.toLowerCase() === film.id.toLowerCase() ? `**${t}**` : t;
              })
              .filter(Boolean);

            return (
              <article key={code} className="border rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {pieces.length > 0 && (
                      <div className="text-[0.9rem] font-medium mb-0.5">
                        {pieces.join(' + ').split('**').map((chunk, i) =>
                          i % 2 === 1 ? <strong key={i}>{chunk}</strong> : <span key={i}>{chunk}</span>
                        )}
                      </div>
                    )}
                    <div className="text-[12px] text-gray-700">
                      {dateLabel} · {timeLabel} · {venue}
                    </div>
                    <div className="text-[12px] text-gray-600 mt-0.5">
                      {[rating, lang].filter(Boolean).join(' · ')} {a.withGV ? <strong>· GV</strong> : null}
                    </div>
                  </div>
                  {/* 즐겨찾기(후속 연동) */}
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer rounded-full border px-2 py-1 text-[12px]"
                    title="즐겨찾기(추후 Timetable 연동)"
                  >
                    ♥
                  </button>
                </div>
                {code && !code.startsWith('__') && (
                  <div className="text-[11px] text-gray-500 mt-1">code: {code}</div>
                )}
              </article>
            );
          })}
          {groups.length === 0 && (
            <div className="text-sm text-gray-500">등록된 상영 정보가 없습니다.</div>
          )}
        </div>
      </section>

      {/* 크레딧 */}
      <section>
        <h2 className="text-base font-semibold mb-2">Credit</h2>
        {Array.from(creditByRole.keys()).length === 0 ? (
          <div className="text-sm text-gray-500">등록된 크레딧 정보가 없습니다.</div>
        ) : (
          <div className="space-y-1.5">
            {orderedRoles.map((role) => {
              const vals = creditByRole.get(role) ?? [];
              if (vals.length === 0) return null;
              return (
                <div key={role} className="text-[0.95rem] leading-relaxed">
                  <span className="font-medium">{role}</span>
                  <span className="text-gray-700"> : {vals.join(', ')}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
