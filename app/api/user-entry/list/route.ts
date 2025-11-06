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

  // 목록 API는 항상 200 + 배열로 응답
  return NextResponse.json(rows, { status: 200 });
}
