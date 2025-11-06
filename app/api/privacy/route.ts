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

  try {
    const row = await prisma.userPrivacy.findUnique({
      where: { userId: session.user.id },
    });

    // 없으면 기본값만 반환(생성은 하지 않음)
    return NextResponse.json(
      row ?? { userId: session.user.id, ratingVisibility: "private", reviewVisibility: "private" },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

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

  try {
    // ▶ 세션의 user.id가 실제 User 테이블에 있는지 확인 (FK 오류 예방)
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json(
        { error: `User not found for session id=${session.user.id}. Check auth callbacks / database.` },
        { status: 409 }
      );
    }

    const saved = await prisma.userPrivacy.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        ratingVisibility: data.ratingVisibility ?? "private",
        reviewVisibility: data.reviewVisibility ?? "private",
      },
      update: data,
    });

    return NextResponse.json(saved, { status: 200 });
  } catch (e: any) {
    // 예: FK 오류(P2003), 테이블 미존재(P2021), 기타
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
