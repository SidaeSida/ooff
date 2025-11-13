// app/api/favorite-screening/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// 선택된 상영들에 대한 하트 상태 조회용 (지금은 안 써도 되지만 대비용)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('screeningIds');

  if (!idsParam) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const screeningIds = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (screeningIds.length === 0) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const rows = await prisma.favoriteScreening.findMany({
    where: {
      userId: session.user.id,
      screeningId: { in: screeningIds },
    },
    select: {
      screeningId: true,
      priority: true,
    },
  });

  return NextResponse.json({ items: rows }, { status: 200 });
}

// 하트 토글(추가/삭제)용
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { screeningId, favorite, priority } = body as {
    screeningId?: string;
    favorite?: boolean | null;
    priority?: number | null;
  };

  if (!screeningId) {
    return NextResponse.json({ error: 'screeningId required' }, { status: 400 });
  }

  const userId = session.user.id;
  const wantFavorite = favorite !== false; // 기본값: true

  // false → 삭제 (없어도 조용히 통과)
  if (!wantFavorite) {
    await prisma.favoriteScreening.deleteMany({
      where: { userId, screeningId },
    });
    return new NextResponse(null, { status: 204 });
  }

  // true → upsert
  const saved = await prisma.favoriteScreening.upsert({
    where: { userId_screeningId: { userId, screeningId } },
    update: { priority: priority ?? null },
    create: {
      userId,
      screeningId,
      priority: priority ?? null,
    },
    select: {
      id: true,
      screeningId: true,
      priority: true,
    },
  });

  return NextResponse.json(saved, { status: 200 });
}
