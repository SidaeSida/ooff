// components/Header.tsx
import Link from "next/link";
import { auth } from "@/auth";
import NavClient from "./NavClient"; // ★ 추가(아래 새 파일)

export default async function Header() {
  const session = await auth();
  const isLoggedIn = !!session;

  return (
    <header className="w-full border-b sticky top-0 bg-white">
      <div className="mx-auto max-w-[390px] px-4 py-3">
        <a href="/" className="block font-semibold text-base sm:text-lg whitespace-nowrap">
          OOFF · Our Own Film Festival
        </a>
        {/* 메뉴: 제목과 다른 줄, 위치/간격 원복 */}
        <nav className="mt-2 flex justify-end gap-4 text-sm sm:mt-0">
          <NavClient
            items={[
              { href: "/films", label: "Films" },
              { href: "/timetable", label: "Timetable" },
              isLoggedIn ? { href: "/my", label: "My" } : { href: "/login", label: "Login" },
            ]}
          />
        </nav>
      </div>
    </header>
  );
}
