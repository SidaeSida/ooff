'use client';

import { useParams } from 'next/navigation';
import filmsData from '../../../data/films.json';
import screenings from '../../../data/screenings.json';

type Film = { id: string; title: string; year: number; section: string; runtime: number; synopsis: string };
const films = filmsData as Film[];

export default function FilmDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id?.toString();
  if (!id) return <div className="p-4">Param missing</div>;

  const film = films.find(f => f.id === id);
  if (!film) return <div className="p-4">Not found (id: {id})</div>;

  const shows = screenings.filter(s => s.filmId === film.id);

  return (
    <article className="space-y-4 p-2">
      <h1 className="text-xl font-semibold">
        {film.title} <span className="text-gray-500 text-base">({film.year})</span>
      </h1>
      <div className="text-gray-600">{film.section} · {film.runtime}min</div>
      <p className="text-gray-800">{film.synopsis}</p>
      <section>
        <h3 className="font-medium mb-2">상영 일정</h3>
        <ul className="space-y-1 text-sm">
          {shows.map((s, i) => (
            <li key={i}>{s.date} · {s.time} · {s.theater}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
