// app/films/page.tsx
import { Suspense } from 'react';
import FilmsClient from './FilmsClient';

export default function FilmsPage() {
  return (
    <section className="space-y-4 p-2">
      <h2 className="text-xl font-semibold">Films</h2>
      {/* 클라이언트 훅을 쓰는 부분은 반드시 Suspense로 감쌉니다 */}
      <Suspense fallback={null}>
        <FilmsClient />
      </Suspense>
    </section>
  );
}
