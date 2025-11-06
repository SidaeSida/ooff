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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
function roundTo(n: number, step: number) {
  return Math.round(n / step) * step;
}

/** ▶ 슬라이더 길이: 여기만 바꾸세요. 예) 'w-[80%]' / 'w-[320px]' / 'max-w-[360px] w-full' */
const BAR_WIDTH_CLASS = 'w-[85%]';

export default function RatingEditorClient({ filmId }: { filmId: string }) {
  const [loading, setLoading] = useState(true);

  // 서버 스냅샷(저장/리셋 기준)
  const [savedRating, setSavedRating] = useState<number | null>(null);
  const [savedReview, setSavedReview] = useState<string>('');

  // 편집 상태
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState<string>('');

  // 드래그 상태
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const dragMoved = useRef(false);
  const suppressNextClick = useRef(false);

  const barRef = useRef<HTMLDivElement | null>(null);

  // ─── 초기 로드 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/user-entry?filmId=${encodeURIComponent(filmId)}`, { cache: 'no-store' });
        if (res.status === 204) {
          if (!alive) return;
          setSavedRating(null);
          setSavedReview('');
          setRating(null);
          setReview('');
        } else if (res.ok) {
          const data: Entry = await res.json();
          if (!alive) return;
          const r = data.rating != null ? Number(data.rating) : null;
          const sr = data.shortReview ?? '';
          const rOk = Number.isFinite(r as number) ? (r as number) : null;
          setSavedRating(rOk);
          setSavedReview(sr);
          setRating(rOk);
          setReview(sr);
        } else {
          if (!alive) return;
          setSavedRating(null);
          setSavedReview('');
          setRating(null);
          setReview('');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [filmId]);

  // ─── 좌표→값: step(0.1/0.5), minZero 허용 ──────────────────────────────────
  const valueFromPointer = (clientX: number, step: 0.1 | 0.5, allowZero: boolean) => {
    const el = barRef.current;
    if (!el) return rating ?? 0;
    const rect = el.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const raw = (x / rect.width) * 5.0; // 0.0~5.0
    const snapped = roundTo(raw, step);
    const min = allowZero ? 0.0 : 0.1; // 클릭은 0.1부터, 드래그는 0.0까지
    return clamp(snapped < min ? min : snapped, min, 5.0);
  };

  // 표시용 값: 드래그 중이면 dragValue, 아니면 rating
  const displayValue = dragValue ?? rating ?? 0;
  const fillRatio = useMemo(() => clamp(displayValue / 5.0, 0, 1), [displayValue]);

  // ─── 상호작용 (모바일 스크롤 잠금 포함) ────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault(); // 터치 시작 시 스크롤/줌 억제
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragMoved.current = false;
    setDragging(true);
    // 드래그 시작: 0.1 단위, 0.0까지 허용
    setDragValue(valueFromPointer(e.clientX, 0.1, true));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    e.preventDefault(); // 드래그 중 스크롤 억제
    dragMoved.current = true;
    setDragValue(valueFromPointer(e.clientX, 0.1, true)); // 드래그는 항상 0.1, 0.0 허용
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    // 드래그로 실제 움직였으면 클릭 억제 → 0.1 값 유지
    if (dragMoved.current) suppressNextClick.current = true;
    setRating((prev) => dragValue ?? prev);
    setDragValue(null);
    setTimeout(() => { suppressNextClick.current = false; }, 0);
  };

  // 클릭: **항상 0.5 스냅**, 최솟값은 0.1
  const onClickBar = (e: React.MouseEvent) => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    if (dragging) return;
    const v = valueFromPointer(e.clientX, 0.5, false); // 0.1~5.0, 0.5 스냅
    setRating(v);
  };

  // 더블클릭 초기화 **차단** (아무 동작 안 함)
  const onDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return;
  };

  // 키보드: ←/→ (Shift:0.5, 기본:0.1) — 저장은 버튼으로만
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const delta = e.shiftKey ? 0.5 : 0.1;
    const base = rating ?? 0.1;
    const next = clamp(roundTo(base + (e.key === 'ArrowRight' ? delta : -delta), e.shiftKey ? 0.5 : 0.1), 0.0, 5.0);
    setRating(next < 0.1 ? 0.1 : next); // 키보드는 최소 0.1 유지
  };

  // ─── Save / Reset ──────────────────────────────────────────────────────────
  const dirty = (rating ?? null) !== (savedRating ?? null) || review !== savedReview;

  const blurActive = () => {
    const el = document.activeElement as HTMLElement | null;
    if (el && typeof el.blur === 'function') el.blur();
  };

  const onSave = async () => {
    blurActive(); // 모바일에서 키보드/줌 종료
    try {
      const resp = await fetch('/api/user-entry', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ filmId, rating, shortReview: review }),
      });
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(msg || `HTTP ${resp.status}`);
      }
      setSavedRating(rating);
      setSavedReview(review);
    } catch (err: any) {
      alert(`Save failed: ${err?.message ?? err}`);
    }
  };

  // 서버 기록 삭제(null, '')
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
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(msg || `HTTP ${resp.status}`);
      }
      setSavedRating(null);
      setSavedReview('');
    } catch (err: any) {
      alert(`Reset failed: ${err?.message ?? err}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-7 rounded-full bg-gray-100 animate-pulse" />
        <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 점수: 0 또는 null은 '–'로 표기 */}
      <div className="w-full text-center">
        <span className="text-lg font-semibold tabular-nums tracking-tight">
          {!displayValue ? '–' : displayValue.toFixed(1)}
        </span>
      </div>

      {/* Rating bar (모바일 스크롤 잠금: touch-none) */}
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
          {/* 5칸(정수 위치) + 4개 경계선 + 중앙 별 */}
          <div className="absolute inset-0 grid grid-cols-5 pointer-events-none">
            {[0,1,2,3,4].map((i) => (
              <div key={i} className="relative">
                <div className="absolute inset-0 flex items-center justify-center text-[15px] opacity-70">★</div>
                {i < 4 && <div className="absolute right-0 top-0 h-full w-px bg-gray-200/80" />}
              </div>
            ))}
          </div>

          {/* 채움 */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-gray-900/60"
            style={{ width: `${fillRatio * 100}%`, transition: dragging ? 'none' : 'width 90ms linear' }}
          />

          {/* 현재 위치 표식 */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-white/90 border"
            style={{ left: `calc(${fillRatio * 100}% - 1px)` }}
          />
        </div>
      </div>

      {/* Review + Actions 〔모바일 16px로 확대방지, 저장/리셋 시 blur()〕 */}
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
          <button
            onClick={onSave}
            disabled={!dirty}
            className={`px-3 py-1.5 rounded-md border text-sm ${dirty ? 'hover:bg-gray-50' : 'opacity-60 cursor-not-allowed'}`}
          >
            Save
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
