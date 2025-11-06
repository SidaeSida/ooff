'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Film = {
  id: string;
  title: string;
  year: number;
  credits?: { directors?: string[] };
};

type Props = { film: Film; myScore?: number };

/**
 * UX
 * - 탭/클릭: +0.5(순환, 5.0→0.0)
 * - 드래그(좌↔우): 0.1 단위 미세조정
 * - 더블탭/더블클릭: 초기화(null)
 * - 저장: Optimistic + 하단 토스트(Undo)
 */
export default function FilmCard({ film, myScore }: Props) {
  // 내부 점수 상태 (null = 미평가)
  const [score, setScore] = useState<number | null>(myScore ?? null);
  useEffect(() => setScore(myScore ?? null), [myScore]);

  // 토스트 상태
  const [toast, setToast] = useState<null | { msg: string; undo: () => void }>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 저장 중 플래그
  const [saving, setSaving] = useState(false);

  // 표시용 텍스트
  const scoreText = score == null ? '–' : score.toFixed(1);
  const directors = film.credits?.directors ?? [];
  const directorTxt = directors.length ? directors.join(', ') : '';

  // 서버 저장(최종 커밋)
  const commit = useCallback(async (filmId: string, next: number | null) => {
    setSaving(true);
    try {
      const res = await fetch('/api/user-entry', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filmId, rating: next }),
      });
      if (!res.ok) throw new Error('save failed');
    } catch (e) {
      // 롤백 메시지
      setToast({
        msg: 'Save failed',
        undo: () => {},
      });
    } finally {
      setSaving(false);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2200);
    }
  }, []);

  // Optimistic + Undo 토스트
  const saveWithUndo = useCallback(
    (next: number | null) => {
      const prev = score;
      setScore(next); // optimistic
      // 토스트: Undo 누르면 되돌리고 저장
      const doUndo = () => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setScore(prev);
        commit(film.id, prev);
        setToast(null);
      };
      setToast({ msg: 'Saved', undo: doUndo });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2200);
      // 실제 저장
      commit(film.id, next);
    },
    [commit, film.id, score]
  );

  // 클릭: +0.5 순환
  const onClickStep = useCallback(() => {
    let next: number | null;
    if (score == null) next = 0.5;
    else next = score + 0.5;
    if (next > 5.0) next = 0.0;
    // 0.0도 허용(표시는 0.0)
    saveWithUndo(Number(next.toFixed(1)));
  }, [saveWithUndo, score]);

  // 더블클릭: 초기화(null)
  const onDouble = useCallback(() => {
    if (score == null) return; // 이미 없음
    saveWithUndo(null);
  }, [saveWithUndo, score]);

  // 드래그로 0.1 단위 설정
  const dragRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const dragRect = useRef<DOMRect | null>(null);

  const startDrag = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRect.current = dragRef.current?.getBoundingClientRect() ?? null;
    handleDrag(e);
  }, []);

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      handleDrag(e, true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleDrag = useCallback(
    (e: React.PointerEvent, final = false) => {
      if (!dragging.current || !dragRect.current) return;
      const rect = dragRect.current;
      // x 위치 → 0~1 → 0~5.0
      const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
      const ratio = rect.width <= 0 ? 0 : x / rect.width;
      let val = Math.round((ratio * 5.0) * 10) / 10; // 0.1 단위
      // 경계 보정
      if (val < 0) val = 0;
      if (val > 5) val = 5;
      setScore(val);
      if (final) saveWithUndo(val);
    },
    [saveWithUndo]
  );

  // 진행바 퍼센트 (시각 힌트)
  const percent = useMemo(() => {
    if (score == null) return 0;
    return (score / 5) * 100;
  }, [score]);

  return (
    <div className="relative">
      <a
        href={`/films/${film.id}`}
        className="block rounded-xl border bg-white p-4 hover:shadow-sm transition"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium truncate">
              {film.title} <span className="text-gray-500">({film.year})</span>
            </div>
            {directorTxt && (
              <div className="text-sm text-gray-600 truncate">{directorTxt}</div>
            )}
          </div>

          {/* 점수 배지(클릭/더블클릭) */}
          <div
            className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium select-none ${
              saving ? 'opacity-70' : ''
            }`}
            onClick={(e) => {
              e.preventDefault();
              onClickStep();
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              onDouble();
            }}
            title="Tap: +0.5 · Double-tap: reset · Drag bar for 0.1 steps"
          >
            {scoreText}
          </div>
        </div>

        {/* 드래그 바 */}
        <div
          ref={dragRef}
          className="mt-3 h-8 rounded-lg border relative select-none touch-none"
          onPointerDown={startDrag}
          onPointerMove={handleDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          // 링크 클릭 방지
          onClick={(e) => e.preventDefault()}
        >
          <div
            className="absolute left-0 top-0 bottom-0 rounded-l-lg bg-black/10"
            style={{ width: `${percent}%` }}
          />
          <div className="absolute inset-0 grid place-items-center text-xs text-gray-600">
            드래그로 0.1단위 조정
          </div>
        </div>
      </a>

      {/* 토스트 (하단 고정) */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-4 z-50">
          <div className="rounded-full border bg-white shadow px-3 py-2 text-sm flex items-center gap-3">
            <span>{toast.msg}</span>
            <button
              className="underline"
              onClick={() => {
                toast.undo();
              }}
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
