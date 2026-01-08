// auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// 닉네임 생성 함수 (유저 아이디어 반영)
async function generateUniqueNickname(email: string) {
  // 1. 이메일 @ 앞부분 가져오기
  const localPart = email.split("@")[0];

  // 2. 앞 3자리 자르고, 3자리보다 짧으면 뒤에 '0' 붙이기 (User Idea)
  // 예: kssup -> kss, me -> me0, a -> a00
  const prefix = localPart.slice(0, 3).padEnd(3, "0");

  let nickname = "";
  let isUnique = false;

  // 3. 중복 안 될 때까지 무한 루프 (안전장치)
  while (!isUnique) {
    // 1000 ~ 9999 사이 난수 생성
    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    nickname = `${prefix}${randomSuffix}`;

    // DB 중복 검사
    const existingUser = await prisma.user.findUnique({
      where: { nickname },
    });

    if (!existingUser) {
      isUnique = true;
    }
  }

  return nickname;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google,
    Kakao,
  ],
  callbacks: {
    // 1. 로그인 시 실행되는 함수
    async signIn({ user }) {
      if (!user.email) return true; // 이메일 없으면 패스 (거의 없음)

      // DB에서 최신 유저 정보 조회 (닉네임 있는지 확인)
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      // 닉네임이 없으면 새로 생성해서 저장!
      if (dbUser && !dbUser.nickname) {
        const newNickname = await generateUniqueNickname(user.email);
        
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { nickname: newNickname },
        });
        console.log(`[Nickname Generated] ${user.email} -> ${newNickname}`);
      }

      return true;
    },

    // 2. 세션 체크 시 실행 (프론트엔드에 닉네임 전달)
    async session({ session, user }) {
      if (session.user && user.email) {
        // DB에서 최신 정보 다시 긁어오기 (닉네임 포함)
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });
        
        if (dbUser) {
          session.user.id = dbUser.id;
          // @ts-ignore: NextAuth 타입 기본값엔 nickname이 없어서 무시 처리
          session.user.nickname = dbUser.nickname; 
        }
      }
      return session;
    },
  },
});