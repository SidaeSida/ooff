// auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// 닉네임 생성 함수 (분리됨)
async function ensureNickname(email: string, userId: string) {
  const localPart = email.split("@")[0];
  const prefix = localPart.slice(0, 3).padEnd(3, "0");
  
  let nickname = "";
  let isUnique = false;

  // 중복 안 될 때까지 시도
  while (!isUnique) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    nickname = `${prefix}${randomSuffix}`;

    const existing = await prisma.user.findUnique({ where: { nickname } });
    if (!existing) isUnique = true;
  }

  // DB 업데이트
  await prisma.user.update({
    where: { id: userId },
    data: { nickname },
  });
  
  return nickname;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google, Kakao],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return true;

      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        // 닉네임 없으면 생성 시도
        if (dbUser && !dbUser.nickname) {
          await ensureNickname(user.email, dbUser.id);
        }
      } catch (e) {
        console.error("Nickname generation failed during signIn:", e);
        // 여기서 에러가 나도 로그인은 시켜줌 (session 콜백에서 복구할 것이므로)
      }
      return true;
    },

    async session({ session, user }) {
      if (session.user && user.email) {
        session.user.id = user.id; // user.id는 adapter가 보장

        // DB에서 최신 정보 조회
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });

        if (dbUser) {
          // [핵심] 만약 여전히 닉네임이 없다? (signIn 때 실패했다면) -> 지금 만든다
          if (!dbUser.nickname) {
             console.log("Recovering missing nickname...");
             const newNick = await ensureNickname(user.email, user.id);
             session.user.nickname = newNick;
          } else {
             session.user.nickname = dbUser.nickname;
          }
        }
      }
      return session;
    },
  },
});