export default function Header() {
  return (
    <header className="w-full border-b sticky top-0 bg-white">
      <div className="mx-auto max-w-[390px] px-4 py-3">
        {/* 한 줄 제목 (모바일은 글자 작게 + 줄바꿈 금지) */}
        <a href="/" className="block font-semibold text-base sm:text-lg whitespace-nowrap">
          OOFF · Our Own Film Festival
        </a>
        {/* 메뉴는 아래 줄 (모바일), 큰 화면에선 오른쪽 정렬 */}
        <nav className="mt-2 flex gap-4 text-sm sm:mt-0 sm:justify-end">
          <a href="/films" className="hover:underline">Films</a>
          <a href="/timetable" className="hover:underline">Timetable</a>
        </nav>
      </div>
    </header>
  );
}
