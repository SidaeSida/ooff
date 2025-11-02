import films from "../../data/films.json";
import entries from "../../data/entries.json";
import screeningsRaw from "../../data/screenings.json";

type Film = { id: string; title: string };
type Entry = { id: string; filmId: string; section?: string };
type Screening = {
  id: string;
  entryId: string;
  startsAt: string; // ISO
  endsAt: string;   // ISO
  venue: string;
  city?: string;
  screenCode?: string;
  withGV?: boolean;
  subtitles?: string;
};

export default function Timetable() {
  // 인덱스(성능/가독성)
  const filmById: Record<string, Film> = Object.fromEntries(
    (films as Film[]).map(f => [f.id, f])
  );
  const entryById: Record<string, Entry> = Object.fromEntries(
    (entries as Entry[]).map(e => [e.id, e])
  );

  // 상영 + 영화정보 결합
  const screenings = (screeningsRaw as Screening[]).map(s => {
    const entry = entryById[s.entryId];
    const film = entry ? filmById[entry.filmId] : undefined;
    const date = s.startsAt.slice(0, 10);        // YYYY-MM-DD
    const time = s.startsAt.slice(11, 16);       // HH:mm
    return {
      ...s,
      date,
      time,
      filmTitle: film?.title ?? entry?.filmId ?? s.entryId,
      section: entry?.section ?? ""
    };
  });

  // 날짜 목록(유니크)
  const days = Array.from(new Set(screenings.map(s => s.date)));

  return (
    <section className="space-y-4 p-2">
      <h2 className="text-xl font-semibold">Timetable</h2>
      {days.map(d => (
        <div key={d} className="bg-white border rounded-lg">
          <div className="px-4 py-2 border-b font-medium">{d}</div>
          <ul className="p-4 space-y-2">
            {screenings
              .filter(s => s.date === d)
              .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))
              .map(s => (
                <li key={s.id} className="border rounded p-3">
                  <div className="text-sm text-gray-500">
                    {s.time} · {s.venue}{s.section ? ` · ${s.section}` : ""}
                  </div>
                  <div className="font-medium">{s.filmTitle}</div>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
