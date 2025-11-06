// app/api/privacy/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await prisma.userPrivacy.findUnique({
    where: { userId: session.user.id },
  });

  // 기본값: private/private
  return NextResponse.json(
    row ?? { userId: session.user.id, ratingVisibility: "private", reviewVisibility: "private" },
    { status: 200 }
  );
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid json" }, { status: 400 });

  const r = body.ratingVisibility;
  const v = body.reviewVisibility;
  const ok = (x: any) => ["private", "friends", "public"].includes(x);

  const data: any = {};
  if (r !== undefined) {
    if (!ok(r)) return NextResponse.json({ error: "invalid ratingVisibility" }, { status: 400 });
    data.ratingVisibility = r;
  }
  if (v !== undefined) {
    if (!ok(v)) return NextResponse.json({ error: "invalid reviewVisibility" }, { status: 400 });
    data.reviewVisibility = v;
  }
  if (!("ratingVisibility" in data) && !("reviewVisibility" in data)) {
    return NextResponse.json({ error: "no changes" }, { status: 400 });
  }

  const saved = await prisma.userPrivacy.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ratingVisibility: data.ratingVisibility ?? "private", reviewVisibility: data.reviewVisibility ?? "private" },
    update: data,
  });

  return NextResponse.json(saved, { status: 200 });
}
