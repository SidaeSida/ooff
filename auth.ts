// auth.ts (v5)
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import argon2 from "argon2";

type Creds = { email?: string; password?: string };

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const c = (credentials as Creds) || {};
        const email = (c.email ?? "").trim().toLowerCase();
        const password = (c.password ?? "").trim();
        if (!email || !password) return null;

        const now = new Date();
        const attempt = await prisma.loginAttempt.findUnique({ where: { email } });

        // ① 이미 잠금 중이면 남은 시간/누적 횟수 전달
        if (attempt?.lockedUntil && attempt.lockedUntil > now) {
          const remain = Math.max(1, Math.ceil((attempt.lockedUntil.getTime() - now.getTime()) / 1000));
          throw new CredentialsSignin(JSON.stringify({
            code: "TooManyAttempts",
            remain,
            count: attempt.failCount ?? 5,
          }));
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // ② 사용자 없음 → 실패 카운트 + 필요 시 잠금 시작
        if (!user || !user.passwordHash) {
          const count = (attempt?.failCount ?? 0) + 1;
          const lock = count >= 5 ? new Date(now.getTime() + 3 * 60 * 1000) : null;
          await prisma.loginAttempt.upsert({
            where: { email },
            create: { email, failCount: count, lockedUntil: lock },
            update: { failCount: count, lockedUntil: lock },
          });
          if (lock) {
            throw new CredentialsSignin(JSON.stringify({ code: "TooManyAttempts", remain: 180, count }));
          }
          throw new CredentialsSignin("CredentialsSignin");
        }

        // ③ 비밀번호 불일치 → 실패 카운트 + 필요 시 잠금 시작
        const ok = await argon2.verify(user.passwordHash, password);
        if (!ok) {
          const count = (attempt?.failCount ?? 0) + 1;
          const lock = count >= 5 ? new Date(now.getTime() + 3 * 60 * 1000) : null;
          await prisma.loginAttempt.upsert({
            where: { email },
            create: { email, failCount: count, lockedUntil: lock },
            update: { failCount: count, lockedUntil: lock },
          });
          if (lock) {
            throw new CredentialsSignin(JSON.stringify({ code: "TooManyAttempts", remain: 180, count }));
          }
          throw new CredentialsSignin("CredentialsSignin");
        }

        // ④ 성공 → 카운터 초기화
        if (attempt) {
          await prisma.loginAttempt.update({
            where: { email },
            data: { failCount: 0, lockedUntil: null },
          });
        }

        return { id: user.id, email: user.email };
      },
    }),
  ],
  pages: { signIn: "/login" },
});
