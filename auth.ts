// auth.ts (NextAuth v5)
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import argon2 from "argon2";

// (선택) 타입 경고 줄이기용 — 세션에 id 추가 선언
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

type Creds = { email?: string; password?: string };

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      // credentials 성공 시 user.id 주입
      if (user && (user as any).id) token.sub = (user as any).id;
      return token;
    },
    async session({ session, token }) {
      if (token?.sub) (session.user as any).id = token.sub;
      return session;
    },
  },
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

        // 잠금 상태면 즉시 거절
        if (attempt?.lockedUntil && attempt.lockedUntil > now) {
          const remain = Math.max(1, Math.ceil((attempt.lockedUntil.getTime() - now.getTime()) / 1000));
          throw new CredentialsSignin(
            JSON.stringify({ code: "TooManyAttempts", remain, count: attempt.failCount ?? 5 })
          );
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // 사용자 없음
        if (!user || !user.passwordHash) {
          const count = (attempt?.failCount ?? 0) + 1;
          const lock = count >= 5 ? new Date(now.getTime() + 3 * 60 * 1000) : null;
          await prisma.loginAttempt.upsert({
            where: { email },
            create: { email, failCount: count, lockedUntil: lock },
            update: { failCount: count, lockedUntil: lock },
          });
          if (lock) throw new CredentialsSignin(JSON.stringify({ code: "TooManyAttempts", remain: 180, count }));
          throw new CredentialsSignin("CredentialsSignin");
        }

        // 비밀번호 검증
        const ok = await argon2.verify(user.passwordHash, password);
        if (!ok) {
          const count = (attempt?.failCount ?? 0) + 1;
          const lock = count >= 5 ? new Date(now.getTime() + 3 * 60 * 1000) : null;
          await prisma.loginAttempt.upsert({
            where: { email },
            create: { email, failCount: count, lockedUntil: lock },
            update: { failCount: count, lockedUntil: lock },
          });
          if (lock) throw new CredentialsSignin(JSON.stringify({ code: "TooManyAttempts", remain: 180, count }));
          throw new CredentialsSignin("CredentialsSignin");
        }

        // 성공 → 카운터 초기화
        if (attempt) {
          await prisma.loginAttempt.update({
            where: { email },
            data: { failCount: 0, lockedUntil: null },
          });
        }

        // 세션에 쓸 최소 정보(id, email)
        return { id: user.id, email: user.email };
      },
    }),
  ],
  pages: { signIn: "/login" },
});
