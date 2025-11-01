// app/page.tsx
'use client';

import { useEffect, useState } from "react";

const imgs = ["/main1.jpg", "/main2.jpg", "/main3.jpg", "/main4.jpg"];

function pickNext(current?: string) {
  if (imgs.length === 1) return imgs[0];
  let next = current;
  while (next === current) {
    next = imgs[Math.floor(Math.random() * imgs.length)];
  }
  return next as string;
}

export default function Home() {
  // 1) 서버/클라이언트 최초 렌더를 동일하게: 고정값으로 시작
  const [src, setSrc] = useState<string>(imgs[0]);

  // 2) 마운트 이후에만 랜덤으로 교체 → hydration mismatch 방지
  useEffect(() => {
    setSrc(pickNext(imgs[0]));
  }, []);

  return (
    <section className="p-0">
      <img
        src={src}
        alt="OOFF cover"
        className="w-full h-auto block rounded-md select-none"
        onClick={() => setSrc(pickNext(src))}
        role="button"
        aria-label="Change cover image"
        draggable={false}
      />
    </section>
  );
}
