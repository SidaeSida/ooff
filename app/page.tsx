'use client';

import { useState } from "react";

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
  const [src, setSrc] = useState<string>(() => pickNext());

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
