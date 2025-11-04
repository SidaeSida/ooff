// auth.ts (v5)
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import argon2 from "argon2";

// Credentials 폼 입력 타입 정의
type Creds = {
  email?: string;
  password?: string;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      // v5: credentials는 unknown → 안전 파싱 + 기본값
      authorize: async (credentials) => {
        const c = (credentials as Creds) || {};
        const email = (c.email ?? "").trim().toLowerCase();
        const password = c.password ?? "";

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        const ok = await argon2.verify(user.passwordHash, password);
        if (!ok) return null;

        return { id: user.id, email: user.email };
      },
    }),
  ],
  pages: { signIn: "/login" },
});
