"use client";

import { useRef, useState } from "react";

type Vis = "private" | "friends" | "public";

const pillBase =
  "inline-flex items-center justify-center h-7 px-3 rounded-xl border text-[11px] sm:text-xs";
const pillOn = "bg-gray-900 text-white border-gray-900";
const pillOff = "bg-white text-gray-800 border-gray-300 hover:bg-gray-50";

export default function PrivacyControlsClient({
  initial,
}: {
  initial: { ratingVisibility: Vis; reviewVisibility: Vis };
}) {
  const [rating, setRating] = useState<Vis>(initial.ratingVisibility);
  const [review, setReview] = useState<Vis>(initial.reviewVisibility);
  const [pending, setPending] = useState(false);

  // 느릴 때만 표시되는 진행바
  const slowTimer = useRef<number | null>(null);
  const [showBar, setShowBar] = useState(false);

  async function save(
    patch: Partial<{ ratingVisibility: Vis; reviewVisibility: Vis }>,
    rollback: () => void
  ) {
    setPending(true);
    if (slowTimer.current) window.clearTimeout(slowTimer.current);
    slowTimer.current = window.setTimeout(() => setShowBar(true), 400);

    try {
      const r = await fetch("/api/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        cache: "no-store",
        credentials: "same-origin",
      });

      // 실패해도 throw 하지 말고 사용자에게 안내 + 롤백
      if (!r.ok) {
        const msg = await r.text().catch(() => "");
        rollback();
        alert(
          `Save failed (${r.status})${
            msg ? `\n\n${msg.slice(0, 200)}` : ""
          }`
        );
        return;
      }
      // 성공 시 아무 것도 안 함(낙관적 상태 유지)
    } catch (e: any) {
      rollback();
      alert(`Save failed\n\n${e?.message ?? e}`);
    } finally {
      if (slowTimer.current) {
        window.clearTimeout(slowTimer.current);
        slowTimer.current = null;
      }
      setShowBar(false);
      setPending(false);
    }
  }

  const Group = ({
    label,
    value,
    onChange,
  }: {
    label: "Rating" | "Review";
    value: Vis;
    onChange: (v: Vis) => void;
  }) => (
    <div className="flex items-center gap-2 py-2">
      <span className="text-sm text-gray-600 w-[54px]">{label}</span>
      <div className="flex items-center gap-2">
        {(["private", "friends", "public"] as Vis[]).map((v) => (
          <button
            key={v}
            type="button"
            disabled={pending}
            onClick={() => onChange(v)}
            className={`${pillBase} ${value === v ? pillOn : pillOff} ${
              pending ? "opacity-80 pointer-events-none" : ""
            }`}
            aria-pressed={value === v}
          >
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {showBar && (
        <div className="h-0.5 w-full bg-gray-200 overflow-hidden mb-1">
          <div className="h-full w-1/2 bg-gray-900 animate-[progress_0.8s_linear_infinite]" />
        </div>
      )}

      <div className="border-t border-gray-200 pt-2" />

      <Group
        label="Rating"
        value={rating}
        onChange={(v) => {
          if (rating === v) return;
          const prev = rating;
          // 낙관적 반영
          setRating(v);
          // 실패 시 롤백
          save({ ratingVisibility: v }, () => setRating(prev));
        }}
      />
      <Group
        label="Review"
        value={review}
        onChange={(v) => {
          if (review === v) return;
          const prev = review;
          setReview(v);
          save({ reviewVisibility: v }, () => setReview(prev));
        }}
      />

      <div className="border-b border-gray-200 pb-1" />

      <style jsx>{`
        @keyframes progress {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
    </>
  );
}
