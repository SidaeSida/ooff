// components/Header.tsx
import Link from "next/link";
import { auth } from "@/auth";
import NavClient from "./NavClient";

export default async function Header() {
  const session = await auth();
  const isLoggedIn = !!session;

  return (
    <header className="w-full border-b sticky top-0 bg-white z-[2000]">
      <div className="mx-auto max-w-[390px] px-4 py-3">
        <a
          href="/"
          className="block font-semibold text-base sm:text-lg whitespace-nowrap"
        >
          OOFF · Our Own Film Festival
        </a>
        <nav className="mt-2 flex justify-end gap-4 text-sm sm:mt-0">
          <NavClient
            items={[
              { href: "/films", label: "Films" },
              { href: "/screenings", label: "Screenings" },
              { href: "/timetable", label: "Timetable" },
              isLoggedIn
                ? { href: "/my", label: "My" }
                : { href: "/login", label: "Login" },
            ]}
          />
        </nav>
      </div>
    </header>
  );
}
