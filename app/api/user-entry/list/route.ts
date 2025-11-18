//app/api/user-entry/list/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.userEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  // ★ 평점=null 이고 리뷰가 비어있으면 목록에서 제외
  const filtered = rows.filter((r) => !(r.rating === null && (!r.shortReview || r.shortReview.trim() === "")));

  return NextResponse.json(filtered, { status: 200 });
}
