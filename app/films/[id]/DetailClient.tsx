'use client';

import { useMemo, useState } from 'react';
import creditOrder from '@/data/credit_order.json';

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
  startsAt?: string | null; // ISO
  endsAt?: string | null;   // ISO or null
  venue?: string | null;
  rating?: string | null;   // All | 12 | 15 | 19
  dialogue?: string | null; // JIFF: E/H/K/KE/X, BIFF: 거의 미제공
  subtitles?: string | null; // JIFF: E/K/KE/X,  BIFF: Y/N
  withGV?: boolean;
};

type EntryToFilm = Record<string, { filmId: string; title_ko: string; title_en: string }>;

type CreditRow = { filmId: string; role: string; value: string; order?: number | null };

function ymd(iso?: string | null) {
  return iso ? iso.slice(0, 10) : '';
}
function mdK(iso?: string | null) {
  if (!iso) return '';
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return `${m}월 ${d}일`;
}
function hm(iso?: string | null) {
  return iso ? iso.slice(11, 16) : '';
}
function makeBadges(rating?: string, lang?: string, withGV?: boolean) {
  const out: Array<{ key: string; type: 'rating' | 'lang' | 'gv'; label: string }> = [];
  if (rating) out.push({ key: `r:${rating}`, type: 'rating', label: rating });
  if (lang) out.push({ key: `l:${lang}`, type: 'lang', label: lang });
  if (withGV) out.push({ key: 'gv', type: 'gv', label: 'GV' });
  return out;
}
// label 길이에 따라 원형(<=2글자) 또는 알약형(>2글자) 자동 선택
function badgeClass(t: 'rating' | 'lang' | 'gv', label: string) {
  const isCircle = (label?.length ?? 0) <= 2; // '12','KE','GV' 등
  const base = 'inline-flex items-center justify-center border leading-none';

  // 공통 폰트(원형은 더 작게)
  const font = isCircle ? ' text-[10px]' : ' text-[11px]';
  // 굵기
  const weight = t === 'rating' ? ' font-medium' : t === 'gv' ? ' font-semibold' : '';

  if (isCircle) {
    // 완전 원형: 폭=높이(24px), 패딩 제거
    return base + font + weight + ' rounded-full h-6 w-6 p-0';
  }
  // 알약형: 높이 고정, 좌우 여백
  return base + font + weight + ' rounded-full h-6 px-2';
}
// 역할 라벨을 Title Case로 통일
function formatRoleLabel(role: string) {
  return role.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DetailClient({
  film,
  entries,
  screenings,
  entryToFilm,
  creditRows,
  initialFavoriteIds,
}: {
  film: Film;
  entries: Entry[];
  screenings: Screening[];
  entryToFilm: EntryToFilm;
  creditRows: CreditRow[];
  initialFavoriteIds: string[];
}) {
  // 상영 묶기: 동일 code 묶음(+ 코드 없음은 날짜/시간/장소로 Fallback), 날짜 기준 정렬
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

  // entryId -> editionId 맵 (언어/자막 표기 정규화용)
  const editionByEntryId = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of entries) m.set(e.id, e.editionId);
    return m;
  }, [entries]);

  // 언어/자막 라벨 정규화
  function makeLangLabel(dialogue?: string | null, subtitles?: string | null, editionId?: string) {
    const d = (dialogue ?? '').trim();
    const s = (subtitles ?? '').trim();

    if (editionId?.startsWith('edition_jiff_')) {
      // JIFF: dialogue {E/H/K/KE/X}, subtitles {E/K/KE/X}; X=없음 → 숨김
      const dShow = d && d !== 'X' ? d : '';
      const sShow = s && s !== 'X' ? s : '';
      if (dShow && sShow) return `${dShow}/${sShow}`;
      return dShow || sShow || '';
    }

    if (editionId?.startsWith('edition_biff_')) {
      // BIFF: 값이 subtitles 또는 dialogue 어느 쪽으로 와도 처리
      // 정책: 'N' → 미표시, 'Y' → 'KE'로 표시, 그 외(KE/K/E 등)는 그대로 표시
      const markRaw = (s || d || '').trim().toUpperCase();
      if (!markRaw || markRaw === 'N') return '';
      if (markRaw === 'Y') return 'KE';
      return markRaw;
    }

    // 기본
    if (d && s) return `${d}/${s}`;
    return d || s || '';
  }

  // 크레딧: 역할별 그룹 + 정렬(credit_order.json 우선, 나머지는 알파벳)
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
        }),
      );
    }
    return map;
  }, [creditRows]);

  const orderedRoles = useMemo(() => {
    const present = Array.from(creditByRole.keys());
    const preferred: string[] = Array.isArray(creditOrder) ? creditOrder.filter(Boolean) : [];
    const head = preferred.filter((r) => present.includes(r));
    const tail = present.filter((r) => !head.includes(r)).sort((a, b) => a.localeCompare(b));
    return [...head, ...tail];
  }, [creditByRole]);

  // 하트 상태 (screeningId 기준)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(initialFavoriteIds ?? []),
  );
  // 상영별 로딩 상태
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  async function toggleFavorite(screeningId: string) {
    if (!screeningId) return;

    // 이 순간 기준으로 이전 상태 저장
    const wasFavorite = favoriteIds.has(screeningId);

    // optimistic update
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(screeningId);
      else next.add(screeningId);
      return next;
    });

    // pending 표시
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.add(screeningId);
      return next;
    });

    try {
      const resp = await fetch('/api/favorite-screening', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screeningId,
          favorite: !wasFavorite,
        }),
      });

      if (!resp.ok) {
        // 실패 시 롤백
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(screeningId);
          else next.delete(screeningId);
          return next;
        });
      }
    } catch {
      // 네트워크 등 에러 시 롤백
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.add(screeningId);
        else next.delete(screeningId);
        return next;
      });
    } finally {
      // 로딩 해제 (해당 상영만)
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(screeningId);
        return next;
      });
    }
  }

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
            const editionId = editionByEntryId.get(a.entryId);
            const lang = makeLangLabel(a.dialogue, a.subtitles, editionId);

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

            const isFavorite = favoriteIds.has(a.id);
            const isPending = pendingIds.has(a.id);

            return (
              <article key={code} className="border rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {pieces.length > 0 && (
                      <div className="text-[0.9rem] font-medium mb-0.5">
                        {pieces
                          .join(' + ')
                          .split('**')
                          .map((chunk, i) =>
                            i % 2 === 1 ? (
                              <strong key={i}>{chunk}</strong>
                            ) : (
                              <span key={i}>{chunk}</span>
                            ),
                          )}
                      </div>
                    )}
                    <div className="text-[12px] text-gray-700">
                      {dateLabel} · {timeLabel} · {venue}
                    </div>
                    {/* 등급/언어/GV — 동그란 배지 */}
                    <div className="mt-1 flex items-center gap-1.5 text-gray-700">
                      {makeBadges(rating, lang, a.withGV).map((b) => (
                        <span key={b.key} className={badgeClass(b.type, b.label)}>
                          {b.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* 즐겨찾기(타임테이블 후보) */}
                  <button
                    type="button"
                    onClick={() => toggleFavorite(a.id)}
                    disabled={isPending}
                    aria-pressed={isFavorite}
                    className={
                      'shrink-0 rounded-full border px-2 py-1 text-[12px]' +
                      (isFavorite
                        ? ' bg-black text-white border-black'
                        : ' bg-white text-gray-700') +
                      (isPending ? ' opacity-60 cursor-default' : ' cursor-pointer')
                    }
                    title={
                      isFavorite
                        ? '타임테이블 후보에서 제거'
                        : '타임테이블 후보에 추가'
                    }
                  >
                    {isFavorite ? '♥' : '♡'}
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
          <div className="space-y-1">
            {orderedRoles.map((role) => {
              const vals = creditByRole.get(role) ?? [];
              if (vals.length === 0) return null;
              return (
                <div key={role} className="text-[0.85rem] leading-tight">
                  <span className="font-semibold">{formatRoleLabel(role)}</span>
                  <span className="font-normal text-gray-700"> : {vals.join(', ')}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
