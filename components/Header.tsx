export default function Header() {
  return (
    <header className="w-full border-b sticky top-0 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <a href="/" className="font-semibold">OOFF · Our Own Film Festival</a>
        <nav className="flex gap-4 text-sm">
          <a href="/films" className="hover:underline">Films</a>
          <a href="/timetable" className="hover:underline">Timetable</a>
        </nav>
      </div>
    </header>
  );
}
