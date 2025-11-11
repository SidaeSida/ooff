import type { Metadata } from 'next';
import './globals.css';
import { Geist, Geist_Mono } from 'next/font/google';
import Header from '@/components/Header';
import AuthProvider from '@/components/AuthProvider';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'OOFF · Our Own Film Festival',
  description: 'Personal festival archive',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AuthProvider>
          <div className="mx-auto w-full max-w-[420px] px-4">
            <Header />
            {/* 서버/클라이언트 DOM 차이 억제 */}
            <main className="py-6" suppressHydrationWarning>
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
