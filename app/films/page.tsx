// app/films/page.tsx
import { Suspense } from 'react';
import FilmsClient from './FilmsClient';

export const dynamic = 'force-dynamic';

export default function FilmsPage() {
  return (
    <>
      <h2 className="text-xl font-semibold mb-2">Films</h2>
      <Suspense fallback={null}>
        <FilmsClient />
      </Suspense>
    </>
  );
}
