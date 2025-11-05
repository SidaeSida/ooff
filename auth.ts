// auth.ts (v5)
import NextAuth from "next-auth";
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
        if (attempt?.lockedUntil && attempt.lockedUntil > now) {
          // 커스텀 에러 코드 → 클라이언트에서 문구 분기
          throw new Error("TooManyAttempts");
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
          const count = (attempt?.failCount ?? 0) + 1;
          const lock = count >= 5 ? new Date(now.getTime() + 3 * 60 * 1000) : null;
          await prisma.loginAttempt.upsert({
            where: { email },
            create: { email, failCount: count, lockedUntil: lock },
            update: { failCount: count, lockedUntil: lock },
          });
          throw new Error("CredentialsSignin");
        }

        const ok = await argon2.verify(user.passwordHash, password);
        if (!ok) {
          const count = (attempt?.failCount ?? 0) + 1;
          const lock = count >= 5 ? new Date(now.getTime() + 3 * 60 * 1000) : null;
          await prisma.loginAttempt.upsert({
            where: { email },
            create: { email, failCount: count, lockedUntil: lock },
            update: { failCount: count, lockedUntil: lock },
          });
          throw new Error("CredentialsSignin");
        }

        // 성공 → 카운터 초기화
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
