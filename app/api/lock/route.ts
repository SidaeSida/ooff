// app/api/lock/route.ts
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  if (!email) {
    return new Response(JSON.stringify({ error: "email is required" }), { status: 400 });
  }

  const now = new Date();
  const attempt = await prisma.loginAttempt.findUnique({ where: { email } });

  if (!attempt || !attempt.lockedUntil) {
    return new Response(JSON.stringify({ locked: false, remain: 0, count: attempt?.failCount ?? 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const remain =
    attempt.lockedUntil > now
      ? Math.max(1, Math.ceil((attempt.lockedUntil.getTime() - now.getTime()) / 1000))
      : 0;

  return new Response(
    JSON.stringify({
      locked: remain > 0,
      remain,
      count: attempt.failCount ?? 0,
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
