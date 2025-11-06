import filmsData from '@/data/films.json';
import RatingEditorClient from './RatingEditorClient';

type Film = {
  id: string;
  title: string;
  year?: number;
  runtime?: number;
  credits?: { directors?: string[] };
  synopsis?: string;
};

export const dynamic = 'force-dynamic';

export default async function FilmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const film = (filmsData as Film[]).find(f => f.id === id);

  if (!film) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Not Found</h1>
        <p className="text-sm text-gray-600">
          Couldn’t find the film. <a className="underline" href="/films">Back to Films</a>.
        </p>
      </main>
    );
  }

  const title = `${film.title}${film.year ? ` (${film.year})` : ''}`;
  const directors = film.credits?.directors?.length ? film.credits.directors.join(', ') : undefined;

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {directors && <div className="text-sm text-gray-700">{directors}</div>}
        {film.runtime ? <div className="text-xs text-gray-500">· {film.runtime} min</div> : null}
      </header>

      {/* Synopsis (바로 위로 올림) */}
      {film.synopsis && (
        <section className="text-[0.94rem] leading-7 text-gray-800">
          <h2 className="sr-only">Synopsis</h2>
          <p>{film.synopsis}</p>
        </section>
      )}

      {/* Rating 카드 (맨 아래, 컴팩트) */}
      <section className="border rounded-xl p-4 sm:p-5 bg-white">
        <RatingEditorClient filmId={film.id} />
      </section>
    </main>
  );
}
