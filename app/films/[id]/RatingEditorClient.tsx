// films/[id]/RatingEditorClient.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Entry = {
  id: string;
  userId: string;
  filmId: string;
  rating?: string | number | null;
  shortReview?: string | null;
  updatedAt?: string;
};

function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)); }
function roundTo(n: number, step: number) { return Math.round(n / step) * step; }

const BAR_WIDTH_CLASS = 'w-[70%]';
const MAX_REVIEW = 200; // 한줄평 최대 글자수(현행 유지)

export default function RatingEditorClient({ filmId }: { filmId: string }) {
  const [loading, setLoading] = useState(true);

  // 서버 스냅샷(저장/리셋 기준)
  const [savedRating, setSavedRating] = useState<number | null>(null);
  const [savedReview, setSavedReview] = useState<string>('');

  // 편집 상태
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState<string>('');

  // “최근 커밋됨” 플래그: 저장/리셋 성공 후 true, 편집 시작되면 false
  const [committed, setCommitted] = useState(false);

  // “삭제 완료” 토스트 대체: Save 버튼 라벨을 3초간 Deleted로
  const [recentlyDeleted, setRecentlyDeleted] = useState(false);
  const deletedTimerRef = useRef<number | null>(null);

  // 드래그 상태
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const dragMoved = useRef(false);
  const suppressNextClick = useRef(false);

  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/user-entry?filmId=${encodeURIComponent(filmId)}`, { cache: 'no-store' });
        if (res.status === 204) {
          if (!alive) return;
          setSavedRating(null); setSavedReview(''); setRating(null); setReview(''); setCommitted(false);
        } else if (res.ok) {
          const data: Entry = await res.json();
          if (!alive) return;
          const r = data.rating != null ? Number(data.rating) : null;
          const rOk = Number.isFinite(r as number) ? (r as number) : null;
          const sr = data.shortReview ?? '';
          setSavedRating(rOk); setSavedReview(sr); setRating(rOk); setReview(sr); setCommitted(!!(rOk!=null || sr));
        } else {
          if (!alive) return;
          setSavedRating(null); setSavedReview(''); setRating(null); setReview(''); setCommitted(false);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; if (deletedTimerRef.current) window.clearTimeout(deletedTimerRef.current); };
  }, [filmId]);

  // 좌표→값
  const valueFromPointer = (clientX: number, step: 0.1 | 0.5, allowZero: boolean) => {
    const el = barRef.current;
    if (!el) return rating ?? 0;
    const rect = el.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const raw = (x / rect.width) * 5.0;
    const snapped = roundTo(raw, step);
    const min = allowZero ? 0.0 : 0.1;
    return clamp(snapped < min ? min : snapped, min, 5.0);
  };

  const displayValue = dragValue ?? rating ?? 0;
  const fillRatio = useMemo(() => clamp(displayValue / 5.0, 0, 1), [displayValue]);
  const fillPct = Math.round(fillRatio * 100);

  // 상호작용
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragMoved.current = false;
    setDragging(true);
    setDragValue(valueFromPointer(e.clientX, 0.1, true));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    e.preventDefault();
    dragMoved.current = true;
    setDragValue(valueFromPointer(e.clientX, 0.1, true));
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (dragMoved.current) suppressNextClick.current = true;
    setRating((prev) => dragValue ?? prev);
    setDragValue(null);
    setTimeout(() => { suppressNextClick.current = false; }, 0);
  };
  const onClickBar = (e: React.MouseEvent) => {
    if (suppressNextClick.current) { suppressNextClick.current = false; return; }
    if (dragging) return;
    const v = valueFromPointer((e as any).clientX, 0.5, false);
    setRating(v);
  };
  const onDoubleClick = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const delta = e.shiftKey ? 0.5 : 0.1;
    const base = rating ?? 0.1;
    const next = clamp(roundTo(base + (e.key === 'ArrowRight' ? delta : -delta), e.shiftKey ? 0.5 : 0.1), 0.0, 5.0);
    setRating(next < 0.1 ? 0.1 : next);
  };

  // Save / Reset
  const dirty = (rating ?? null) !== (savedRating ?? null) || review !== savedReview;
  useEffect(() => { if (dirty) setCommitted(false); }, [dirty]);

  const blurActive = () => {
    const el = document.activeElement as HTMLElement | null;
    if (el && typeof el.blur === 'function') el.blur();
  };

  const doShowDeletedBadge = () => {
    setRecentlyDeleted(true);
    if (deletedTimerRef.current) window.clearTimeout(deletedTimerRef.current);
    deletedTimerRef.current = window.setTimeout(() => setRecentlyDeleted(false), 3000);
  };

  const onSave = async () => {
    blurActive();
    // 삭제 조건: 평점 null 이고 리뷰가 빈 문자열
    const willDelete = (rating == null) && (review.trim() === '');
    try {
      if (willDelete) {
        const resp = await fetch(`/api/user-entry?filmId=${encodeURIComponent(filmId)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!resp.ok && resp.status !== 204) throw new Error(await resp.text());
        setSavedRating(null);
        setSavedReview('');
        setCommitted(true);
        doShowDeletedBadge(); // 3초간 Deleted 표시
      } else {
        const resp = await fetch('/api/user-entry', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          body: JSON.stringify({ filmId, rating, shortReview: review }),
        });
        if (!resp.ok) throw new Error(await resp.text());
        setSavedRating(rating);
        setSavedReview(review);
        setCommitted(true);
      }
    } catch (err: any) {
      alert(`Save failed: ${err?.message ?? err}`);
    }
  };

  const onReset = async () => {
    blurActive();
    try {
      // 편집 상태만 클리어(삭제는 Save에서 결정)
      setRating(null);
      setReview('');
      setCommitted(false);
    } catch (err: any) {
      alert(`Reset failed: ${err?.message ?? err}`);
    }
  };

  // 전환 조건: “저장된 평점 or 저장된 한줄평”
  const isSavedRated = (savedRating ?? null) !== null || (savedReview.trim().length > 0);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-7 rounded-full bg-gray-100 animate-pulse" />
        <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
      </div>
    );
  }

  // 마스크(별 레이어용) — iOS 포함
  const starMask = `linear-gradient(90deg, #000 ${fillPct}%, rgba(0,0,0,0) ${fillPct}%)`;

  return (
    <div
      className="rounded-2xl border p-4 transition-colors duration-300 ease-out"
      style={{
        background: isSavedRated ? 'var(--bg-rated)' : 'var(--bg-unrated)',
        borderColor: isSavedRated ? 'var(--bd-rated)' : 'var(--bd-unrated)',
      }}
    >
      <div className="space-y-3">
        {/* 점수 숫자 — 저장 후에는 흰색으로 */}
        <div className="w-full text-center">
          <span className={`text-2xl font-semibold tabular-nums tracking-tight ${isSavedRated ? 'text-white' : ''}`}>
            {!(dragValue ?? rating) ? '–' : (dragValue ?? rating)!.toFixed(1)}
          </span>
        </div>

        {/* 별/바 */}
        <div className="flex items-center justify-center">
          <div
            ref={barRef}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={5}
            aria-valuenow={rating ?? undefined}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={onClickBar}
            onDoubleClick={onDoubleClick}
            className={`relative h-9 ${BAR_WIDTH_CLASS} select-none bg-white touch-none overflow-hidden`}
            style={{ borderRadius: 'var(--rating-bar-radius)' }}
          >
            {/* 채움 바 */}
            <div
              className="absolute left-0 top-0 h-full"
              style={{
                width: `${fillPct}%`,
                background: isSavedRated ? 'var(--bar-fill-rated)' : 'var(--bar-fill-unrated)',
                opacity: 'var(--bar-fill-opacity)',
                transition: dragging ? 'none' : 'width 90ms linear, background-color 200ms ease-out, opacity 200ms ease-out',
                zIndex: 5,
              }}
            />
            {/* 별 레이어(연한 바닥) */}
            <div className="absolute inset-0 grid grid-cols-5 pointer-events-none z-20">
              {[0,1,2,3,4].map((i) => (
                <div key={`bg-${i}`} className="relative">
                  <div className="absolute inset-0 flex items-center justify-center text-[20px] leading-none star-nudge opacity-35">★</div>
                  {i < 4 && <div className="absolute right-0 top-0 h-full w-px bg-transparent" />}
                </div>
              ))}
            </div>
            {/* 별 레이어(진한, 채움 비율만 보이도록 마스크) */}
            <div
              className="absolute inset-0 grid grid-cols-5 pointer-events-none z-30"
              style={{
                WebkitMaskImage: starMask as any,
                maskImage: starMask as any,
                WebkitMaskRepeat: 'no-repeat' as any,
                maskRepeat: 'no-repeat' as any,
              }}
            >
              {[0,1,2,3,4].map((i) => (
                <div key={`fg-${i}`} className="relative">
                  <div className="absolute inset-0 flex items-center justify-center text-[20px] leading-none star-nudge opacity-100">★</div>
                  {i < 4 && <div className="absolute right-0 top-0 h-full w-px bg-transparent" />}
                </div>
              ))}
            </div>
            {/* 구분선(20/40/60/80%) — 이중 라인 */}
            <div className="absolute inset-0 pointer-events-none z-[60]">
              {['20%','40%','60%','80%'].map((left) => (
                <div key={left} className="absolute top-0 h-full" style={{ left }}>
                  <div className="absolute top-0 left-0 h-full w-px" style={{ background: 'rgba(0,0,0,0.14)' }} />
                  <div className="absolute top-0 left-0 h-full w-px" style={{ background: 'rgba(255,255,255,0.38)' }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 한줄평 */}
        <div>
          <label className="sr-only" htmlFor="review">Review</label>
          <textarea
            id="review"
            rows={3}
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Add a short note"
            className={`w-full rounded-lg border px-3 py-2 text-base sm:text-sm resize-none overflow-auto
              ${isSavedRated ? 'bg-transparent text-white placeholder-white/70 border-white/40 caret-white focus-soft' : ''}`}
            inputMode="text"
            autoCorrect="on"
            spellCheck={false}
            maxLength={MAX_REVIEW}
          />
          {review.length >= Math.floor(MAX_REVIEW * 0.9) && (
            <div className={`mt-1 text-[11px] ${isSavedRated ? 'text-white/80' : 'text-gray-500'} text-right`}>
              {review.length}/{MAX_REVIEW}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between">
            <button onClick={onReset} className="px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50">
              Reset
            </button>
            <button
              onClick={onSave}
              disabled={!dirty}
              className={`px-3 py-1.5 rounded-md border text-sm ${!dirty ? 'opacity-60 cursor-default' : 'hover:bg-gray-50'}`}
            >
              {recentlyDeleted ? 'Deleted' : (!dirty && committed) ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
