'use client';

import { useParams } from 'next/navigation';
import filmsData from '../../../data/films.json';
import entriesData from '../../../data/entries.json';
import screeningsData from '../../../data/screenings.json';
import editionsData from '../../../data/editions.json';

type Film = { id: string; title: string; year: number; runtime: number; synopsis?: string };
type Entry = { id: string; filmId: string; editionId: string; section?: string };
type Screening = {
  id: string;
  entryId: string;
  startsAt: string; // ISO
  endsAt?: string;
  venue: string;
  city?: string;
  withGV?: boolean;
  subtitles?: string;
};
type Edition = { id: string; festivalId: string; year: number; editionNumber?: number };

const films = filmsData as Film[];
const entries = entriesData as Entry[];
const screenings = screeningsData as Screening[];
const editions = editionsData as Edition[];

function fmt(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export default function FilmDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id?.toString();
  if (!id) return <div className="p-4">Param missing</div>;

  const film = films.find(f => f.id === id);
  if (!film) return <div className="p-4">Not found (id: {id})</div>;

  // 영화 → 해당 entry들
  const filmEntries = entries.filter(e => e.filmId === film.id);

  // entry → screenings 결합(+ edition/section 표시)
  const editionById: Record<string, Edition> = Object.fromEntries(editions.map(e => [e.id, e]));
  const shows = filmEntries
    .flatMap(e =>
      screenings
        .filter(s => s.entryId === e.id)
        .map(s => ({
          id: s.id,
          startsAt: s.startsAt,
          venue: s.venue,
          city: s.city,
          section: e.section ?? '',
          edition: editionById[e.editionId],
          editionId: e.editionId
        }))
    )
    .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));

  return (
    <article className="space-y-4 p-2">
      <h1 className="text-xl font-semibold">
        {film.title} <span className="text-gray-500 text-base">({film.year})</span>
      </h1>
      <div className="text-gray-600">· {film.runtime}min</div>
      {film.synopsis && <p className="text-gray-800">{film.synopsis}</p>}

      <section>
        <h3 className="font-medium mb-2">상영 일정</h3>
        {shows.length === 0 ? (
          <div className="text-sm text-gray-500">등록된 상영 정보가 없습니다.</div>
        ) : (
          <ul className="space-y-1 text-sm">
            {shows.map(s => (
              <li key={s.id}>
                {fmt(s.startsAt)} · {s.venue}
                {s.city ? ` (${s.city})` : ''}{s.section ? ` · ${s.section}` : ''} · {s.edition?.id ?? s.editionId}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
