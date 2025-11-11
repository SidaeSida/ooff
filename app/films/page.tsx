import { Suspense } from 'react';
import FilmsClient from './FilmsClient';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function normId(s: string) {
  try { return decodeURIComponent(String(s)).trim().toLowerCase(); }
  catch { return String(s).trim().toLowerCase(); }
}

export default async function FilmsPage() {
  let ratedFilmIds: string[] = [];
  const session = await auth();
  if (session?.user?.id) {
    const rows = await prisma.userEntry.findMany({
      where: { userId: session.user.id, rating: { not: null } },
      select: { filmId: true },
    });
    ratedFilmIds = Array.from(new Set(rows.map(r => normId(r.filmId))));
  }

  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Films</h2>
      <Suspense fallback={null}>
        <FilmsClient ratedFilmIds={ratedFilmIds} />
      </Suspense>
    </section>
  );
}
