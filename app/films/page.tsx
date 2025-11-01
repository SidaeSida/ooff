import films from "../../data/films.json";

export default function Films() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Films</h2>
      <ul className="space-y-3">
        {films.map(f => (
          <li key={f.id} className="border rounded-lg p-4 bg-white">
            <a href={`/films/${f.id}`} className="block">
              <div className="font-medium">{f.title} <span className="text-gray-500">({f.year})</span></div>
              <div className="text-sm text-gray-600">{f.section} · {f.runtime}min</div>
              <p className="text-sm mt-2 line-clamp-2">{f.synopsis}</p>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
