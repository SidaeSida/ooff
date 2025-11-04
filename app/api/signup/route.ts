// app/api/signup/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import argon2 from "argon2";

// 반드시 Node 런타임에서 실행(Edge에서는 argon2가 실패할 수 있음)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function POST(req: Request) {
  try {
    // 입력 파싱
    const { email, password } = await req.json().catch(() => ({} as any));
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !password || password.length < 8) {
      return NextResponse.json(
        { error: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    // 중복 이메일 체크
    const exists = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (exists) {
      return NextResponse.json(
        { error: "EMAIL_EXISTS" },
        { status: 409 }
      );
    }

    // 비밀번호 해시(argon2id)
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    // 사용자 생성
    await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: any) {
    // 프로덕션 임시 디버그용: 최소한의 에러 코드 반환
    const code =
      e?.code ||
      e?.name ||
      "INTERNAL_ERROR";
    return NextResponse.json(
      { error: code },
      { status: 500 }
    );
  }
}