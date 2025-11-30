// components/NavClient.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

export default function NavClient({ items }: { items: Item[] }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return false; // Home은 활성표시 없음
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {items.map((it) => {
        const active = isActive(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            // 활성: 밑줄(보더)만, 텍스트 밑줄은 인라인 스타일로 차단
            className={
              active
                ? "border-b-2 border-[--accent] pb-[1px] no-underline hover:no-underline"
                : "hover:underline"
            }
            style={active ? { textDecoration: "none" } : undefined}
          >
            {it.label}
          </Link>
        );
      })}
    </>
  );
}
