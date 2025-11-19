// app/screenings/page.tsx
import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ScreeningsClient from "./ScreeningsClient";

export const dynamic = "force-dynamic";

export default async function ScreeningsPage() {
  let favoriteIds: string[] = [];

  const session = await auth();
  if (session?.user?.id) {
    try {
      const rows = await prisma.favoriteScreening.findMany({
        where: { userId: session.user.id },
        select: { screeningId: true },
      });
      favoriteIds = Array.from(new Set(rows.map((r) => r.screeningId)));
    } catch {
      favoriteIds = [];
    }
  }

  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Screenings</h2>
      <Suspense fallback={null}>
        <ScreeningsClient initialFavoriteIds={favoriteIds} />
      </Suspense>
    </section>
  );
}
