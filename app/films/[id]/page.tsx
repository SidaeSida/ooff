// app/films/[id]/page.tsx
import { notFound } from 'next/navigation';
import filmsData from '@/data/films.json';
import RatingEditorClient from './RatingEditorClient';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Film = {
  id: string;
  title: string;
  year: number;
  runtime: number;
  synopsis?: string;
  credits?: { directors?: string[] };
};

function norm(s: string) {
  return decodeURIComponent(String(s)).trim().toLowerCase();
}

// ✅ Next.js 16: params는 Promise 입니다. 반드시 await 해서 꺼내야 합니다.
export default async function FilmDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;              // ← 여기서 await
  const films = filmsData as Film[];
  const target = norm(id);

  const film = films.find((f) => norm(f.id) === target);
  if (!film) return notFound();

  const title = `${film.title} (${film.year})`;
  const directors = film.credits?.directors?.join(', ');
  const runtime = film.runtime;

  return (
    <section className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {directors && <p className="text-gray-700">{directors}</p>}
        <p className="text-gray-500">· {runtime} min</p>
      </header>

      {film.synopsis && (
        <p className="text-lg leading-relaxed text-gray-800">{film.synopsis}</p>
      )}

      <div className="rounded-2xl border p-4">
        <RatingEditorClient filmId={film.id} />
      </div>
    </section>
  );
}
