// app/my/PrivacyControlsClient.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Vis = "private" | "friends" | "public";

const pillBase =
  "inline-flex items-center justify-center h-7 px-3 rounded-xl border text-[11px] sm:text-xs";
const pillOn =
  "bg-gray-900 text-white border-gray-900";
const pillOff =
  "bg-white text-gray-800 border-gray-300 hover:bg-gray-50";

export default function PrivacyControlsInline() {
  const [rating, setRating] = useState<Vis>("private");
  const [review, setReview] = useState<Vis>("private");
  const [pending, setPending] = useState(false);

  // 느릴 때만 표시되는 2px 진행바
  const [showBar, setShowBar] = useState(false);
  const slowTimer = useRef<number | null>(null);

  useEffect(() => {
    // 초기값 로드
    (async () => {
      const r = await fetch("/api/privacy", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setRating(j.ratingVisibility as Vis);
      setReview(j.reviewVisibility as Vis);
    })();
  }, []);

  async function save(next: Partial<{ ratingVisibility: Vis; reviewVisibility: Vis }>) {
    setPending(true);
    if (slowTimer.current) window.clearTimeout(slowTimer.current);
    slowTimer.current = window.setTimeout(() => setShowBar(true), 400);

    try {
      await fetch("/api/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
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
            onClick={() => {
              if (value === v) return;
              onChange(v);
            }}
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
      {/* 얇은 진행바 (느릴 때만 노출) */}
      {showBar && (
        <div className="h-0.5 w-full bg-gray-200 overflow-hidden mb-1">
          <div className="h-full w-1/2 bg-gray-900 animate-[progress_0.8s_linear_infinite]" />
        </div>
      )}

      {/* 상단/하단에 매우 얇은 구분선만 */}
      <div className="border-t border-gray-200 pt-2" />

      <Group
        label="Rating"
        value={rating}
        onChange={(v) => {
          setRating(v); // 낙관적 반영
          save({ ratingVisibility: v });
        }}
      />
      <Group
        label="Review"
        value={review}
        onChange={(v) => {
          setReview(v); // 낙관적 반영
          save({ reviewVisibility: v });
        }}
      />

      <div className="border-b border-gray-200 pb-1" />

      {/* 진행바 애니메이션 키프레임 */}
      <style jsx>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </>
  );
}
