// app/api/user-entry/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filmId = searchParams.get('filmId');
  if (!filmId) return NextResponse.json({ error: 'filmId required' }, { status: 400 });

  const entry = await prisma.userEntry.findUnique({
    where: { userId_filmId: { userId: session.user.id, filmId } },
    select: { id: true, userId: true, filmId: true, rating: true, shortReview: true, updatedAt: true },
  });

  if (!entry) return new NextResponse(null, { status: 204 });
  return NextResponse.json(entry, { status: 200 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { filmId, rating, shortReview } = body as {
    filmId?: string;
    rating?: number | null;
    shortReview?: string | null;
  };
  if (!filmId) return NextResponse.json({ error: 'filmId required' }, { status: 400 });

  const normalizedRating =
    rating === null || rating === undefined ? null : (Number(rating) <= 0 ? null : Number(rating));
  const sr =
    typeof shortReview === 'string'
      ? shortReview.slice(0, 200)
      : shortReview === null
      ? ''
      : '';

  const saved = await prisma.userEntry.upsert({
    where: { userId_filmId: { userId: session.user.id, filmId } },
    update: { rating: normalizedRating, shortReview: sr, updatedAt: new Date() },
    create: { userId: session.user.id, filmId, rating: normalizedRating, shortReview: sr },
    select: { id: true, userId: true, filmId: true, rating: true, shortReview: true, updatedAt: true },
  });

  return NextResponse.json(saved, { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filmId = searchParams.get('filmId');
  if (!filmId) return NextResponse.json({ error: 'filmId required' }, { status: 400 });

  try {
    await prisma.userEntry.delete({
      where: { userId_filmId: { userId: session.user.id, filmId } },
    });
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    // P2025(없음)도 204로 처리
    return new NextResponse(null, { status: 204 });
  }
}
