import type { Metadata } from 'next';
import './globals.css';
import { Geist, Geist_Mono } from 'next/font/google';
import Header from '@/components/Header';
import AuthProvider from '@/components/AuthProvider';
import { auth } from "@/auth"; // [추가] 세션 가져오기
import OnboardingGuard from "@/components/OnboardingGuard"; // [추가] 온보딩 가드

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'OOFF · Our Own Film Festival',
  description: 'Personal festival archive',
};

// [수정] async 함수로 변경 (서버 세션 조회를 위해)
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth(); // [추가] 서버 세션 조회

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <AuthProvider>
          {/* [추가] 로그인 후 약관 미동의자를 감시하는 가드 */}
          <OnboardingGuard session={session} />
          
          <div className="mx-auto w-full max-w-[420px] px-4">
            <Header />
            <div className="py-6">
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}