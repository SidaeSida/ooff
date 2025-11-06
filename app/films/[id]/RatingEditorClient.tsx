// app/films/[id]/RatingEditorClient.tsx
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

const BAR_WIDTH_CLASS = 'w-[85%]';

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
    return () => { alive = false; };
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
    const v = valueFromPointer(e.clientX, 0.5, false);
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

  // 편집이 시작되면 committed=false
  useEffect(() => {
    if (dirty) setCommitted(false);
  }, [dirty]);

  const blurActive = () => {
    const el = document.activeElement as HTMLElement | null;
    if (el && typeof el.blur === 'function') el.blur();
  };

  const onSave = async () => {
    blurActive();
    try {
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
      setCommitted(true); // 저장 성공 → Saved 고정(다시 편집 전까지)
    } catch (err: any) {
      alert(`Save failed: ${err?.message ?? err}`);
    }
  };

  const onReset = async () => {
    blurActive();
    try {
      setRating(null);
      setReview('');
      const resp = await fetch('/api/user-entry', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ filmId, rating: null, shortReview: '' }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      setSavedRating(null);
      setSavedReview('');
      setCommitted(true); // 리셋도 커밋임
    } catch (err: any) {
      alert(`Reset failed: ${err?.message ?? err}`);
    }
  };

  // 배경색: “저장된 값” 기준 (편집 중엔 바뀌지 않음)
  const isSavedRated = (savedRating ?? null) !== null;

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-7 rounded-full bg-gray-100 animate-pulse" />
        <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border p-4 transition-colors duration-300 ease-out"
      style={{
        background: isSavedRated ? 'var(--bg-rated)' : 'var(--bg-unrated)',
        borderColor: isSavedRated ? 'var(--bd-rated)' : 'var(--bd-unrated)',
      }}
    >
      <div className="space-y-4">
        <div className="w-full text-center">
          <span className="text-xl font-semibold tabular-nums tracking-tight">
            {! (dragValue ?? rating) ? '–' : (dragValue ?? rating)!.toFixed(1)}
          </span>
        </div>

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
            className={`relative h-9 ${BAR_WIDTH_CLASS} rounded-full border select-none bg-white touch-none`}
          >
            <div className="absolute inset-0 grid grid-cols-5 pointer-events-none">
              {[0,1,2,3,4].map((i) => (
                <div key={i} className="relative">
                  <div className="absolute inset-0 flex items-center justify-center text-[18px] opacity-70">★</div>
                  {i < 4 && <div className="absolute right-0 top-0 h-full w-px bg-gray-200/80" />}
                </div>
              ))}
            </div>
            <div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{
                width: `${fillRatio * 100}%`,
                background: isSavedRated ? 'var(--bar-fill-rated)' : 'var(--bar-fill-unrated)',
                opacity: 'var(--bar-fill-opacity)',
                transition: dragging ? 'none' : 'width 90ms linear, background-color 200ms ease-out, opacity 200ms ease-out',
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-white/90 border"
              style={{ left: `calc(${((dragValue ?? rating ?? 0) / 5) * 100}% - 1px)` }}
            />
          </div>
        </div>

        <div>
          <label className="sr-only" htmlFor="review">Review</label>
          <textarea
            id="review"
            rows={2}
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Add a short note"
            className="w-full rounded-lg border px-3 py-2 text-base sm:text-sm resize-none"
            inputMode="text"
            autoCorrect="on"
            spellCheck={false}
            maxLength={200}
          />
          <div className="mt-2 flex items-center justify-between">
            <button onClick={onReset} className="px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50">
              Reset
            </button>
            <button
              onClick={onSave}
              disabled={!dirty}
              className={`px-3 py-1.5 rounded-md border text-sm ${
                !dirty ? 'opacity-60 cursor-default' : 'hover:bg-gray-50'
              }`}
            >
              {(!dirty && committed) ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
