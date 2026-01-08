// app/login/page.tsx
import { Suspense } from "react";
import LoginClient from "./LoginClient";
import { auth } from "@/auth"; 
// import { redirect } from "next/navigation"; // 루프 방지를 위해 일단 끄기

export default async function LoginPage() {
  const session = await auth();
  
  // 디버깅: 서버 터미널에 세션이 잘 찍히는지 확인
  console.log("Login Page Session Check:", session);

  // [중요] 무한 로딩 해결될 때까지 이 부분 주석 처리 유지!
  // if (session?.user) {
  //   redirect("/my");
  // }

  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <LoginClient />
    </Suspense>
  );
}