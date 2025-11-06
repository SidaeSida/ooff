// app/films/[id]/page.tsx
import { notFound } from 'next/navigation';
import filmsData from '@/data/films.json';
import RatingEditorClient from './RatingEditorClient';

type Film = {
  id: string;
  title: string;
  year: number;
  runtime: number;
  synopsis?: string;
  credits?: { directors?: string[] };
};

export default function FilmDetailPage({ params }: { params: { id: string } }) {
  const films = filmsData as Film[];
  const film = films.find((f) => f.id === params.id);
  if (!film) return notFound();

  const title = `${film.title} (${film.year})`;
  const directors = film.credits?.directors?.join(', ');
  const runtime = film.runtime;

  return (
    // ✅ 최상단을 <section>으로 — 레이아웃의 <main> 안에 또 <main>을 만들지 않음
    <section className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-gray-700">{directors}</p>
        <p className="text-gray-500">· {runtime} min</p>
      </header>

      {/* Synopsis */}
      {film.synopsis && (
        <p className="text-lg leading-relaxed text-gray-800">{film.synopsis}</p>
      )}

      {/* Rating / Review */}
      <div className="rounded-2xl border p-4">
        <RatingEditorClient filmId={film.id} />
      </div>
    </section>
  );
}
