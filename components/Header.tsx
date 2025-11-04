// components/Header.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Header() {
  const session = await getServerSession(authOptions);
  const isLoggedIn = !!session;

  return (
    <header className="w-full border-b sticky top-0 bg-white">
      <div className="mx-auto max-w-[390px] px-4 py-3">
        {/* Title */}
        <a href="/" className="block font-semibold text-base sm:text-lg whitespace-nowrap">
          OOFF · Our Own Film Festival
        </a>
        {/* Menu (right-aligned) */}
        <nav className="mt-2 flex justify-end gap-4 text-sm sm:mt-0">
          <a href="/films" className="hover:underline">Films</a>
          <a href="/timetable" className="hover:underline">Timetable</a>
          {isLoggedIn ? (
            <Link href="/my" className="hover:underline">My</Link>
          ) : (
            <Link href="/login" className="hover:underline">Login</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
