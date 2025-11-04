// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import argon2 from "argon2";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" }, // DB 세션 미사용, JWT로 간단 운영
  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email || "").trim().toLowerCase();
        const password = credentials?.password || "";

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        const ok = await argon2.verify(user.passwordHash, password);
        if (!ok) return null;

        // authorize는 최소 id/email을 반환
        return { id: user.id, email: user.email };
      },
    }),
  ],
  pages: {
    signIn: "/login", // 실패 시 기본 라우팅
  },
  callbacks: {
    async jwt({ token, user }) {
      // 최초 로그인 시 user가 들어오므로 토큰에 반영
      if (user?.email) {
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      // 클라이언트에서 session.user.email 접근 가능
      if (token?.email) {
        session.user = { ...(session.user || {}), email: token.email } as any;
      }
      return session;
    },
  },
  // 개발 환경에서는 NEXTAUTH_SECRET 필수
  // production(Vercel)에서는 환경변수로 설정
};
