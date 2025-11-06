// app/api/dev/upsert-user/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import argon2 from "argon2";

/**
 * 로컬 개발용 임시 가입/갱신 엔드포인트
 * - NODE_ENV !== 'development'이면 403
 * - POST { email, password, id? }  → User upsert
 * - id가 주어지면 그 id로 강제 생성(세션 id와 맞추기용)
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const id = body.id ? String(body.id) : undefined;
  if (!email || !password) {
    return NextResponse.json({ error: "email/password required" }, { status: 400 });
  }

  const passwordHash = await argon2.hash(password);

  // id 지정 upsert: 기존 email이 있으면 update, 없으면 create(+지정 id)
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    const saved = existing
      ? await prisma.user.update({
          where: { email },
          data: { passwordHash },
          select: { id: true, email: true },
        })
      : await prisma.user.create({
          data: { id, email, passwordHash },
          select: { id: true, email: true },
        });

    return NextResponse.json(saved, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
