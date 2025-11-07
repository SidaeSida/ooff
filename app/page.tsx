// app/page.tsx
'use client';

import { useEffect, useState } from 'react';

const imgs = ['/main1.jpg', '/main2.jpg', '/main3.jpg', '/main4.jpg'];

function pickNext(current?: string) {
  if (imgs.length === 1) return imgs[0];
  let next = current;
  while (next === current) next = imgs[Math.floor(Math.random() * imgs.length)];
  return next as string;
}

export default function Home() {
  // SSR/CSR 불일치 방지: 고정값 → 마운트 후 교체
  const [src, setSrc] = useState<string>(imgs[0]);
  useEffect(() => { setSrc(pickNext(imgs[0])); }, []);

  return (
    <main className="px-4">
      {/* 폭 고정 컨테이너: 배포 사이트와 동일 느낌(조절지점: maxWidth) */}
      <div className="mx-auto" style={{ maxWidth: 560 }}>
        {/* 메뉴 아래 간격(조절지점: mt-6) */}
        <img
          src={src}
          alt="OOFF cover"
          className="block w-full h-auto mt-6 rounded-md select-none"
          onClick={() => setSrc(pickNext(src))}
          role="button"
          aria-label="Change cover image"
          draggable={false}
        />
      </div>
    </main>
  );
}
