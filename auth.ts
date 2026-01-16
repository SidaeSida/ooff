import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// 닉네임 생성 함수
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
  // [옵션 A 유지] allowDangerousEmailAccountLinking 옵션 없음 -> 계정 분리 (보안)
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
      }
      return true;
    },

    async session({ session, user }) {
      if (session.user && user.email) {
        session.user.id = user.id;

        // DB에서 최신 정보 조회
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });

        if (dbUser) {
          // 닉네임 복구 로직
          if (!dbUser.nickname) {
             console.log("Recovering missing nickname...");
             const newNick = await ensureNickname(user.email, user.id);
             session.user.nickname = newNick;
          } else {
             session.user.nickname = dbUser.nickname;
          }

          // 약관 동의 여부 세션에 포함 (가드용)
          (session.user as any).termsAcceptedAt = dbUser.termsAcceptedAt;
        }
      }
      return session;
    },
  },
});