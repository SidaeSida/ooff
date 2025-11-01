import screenings from "../../data/screenings.json";
import films from "../../data/films.json";

export default function Timetable() {
  const titleOf = (id: string) => films.find(f => f.id === id)?.title || id;
  const days = Array.from(new Set(screenings.map(s => s.date)));

  return (
    <section className="space-y-4 p-2">
      <h2 className="text-xl font-semibold">Timetable</h2>
      {days.map(d => (
        <div key={d} className="bg-white border rounded-lg">
          <div className="px-4 py-2 border-b font-medium">{d}</div>
          <ul className="p-4 space-y-2">
            {screenings.filter(s => s.date === d).map((s, i) => (
              <li key={i} className="border rounded p-3">
                <div className="text-sm text-gray-500">{s.time} · {s.theater}</div>
                <div className="font-medium">{titleOf(s.filmId)}</div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
