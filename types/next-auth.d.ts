// types/next-auth.d.ts
import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * 세션에 포함되는 유저 정보 확장
   */
  interface Session {
    user: {
      id: string
      nickname?: string | null
    } & DefaultSession["user"]
  }
}