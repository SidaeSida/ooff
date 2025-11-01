import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "../components/Header";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OOFF",
  description: "Our Own Film Festival",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* 모바일 뷰포트 고정 */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-50 text-gray-900`}>
        <div className="mx-auto w-full max-w-[420px] px-4">
          {/* 모바일 기준 좁은 폭 컨테이너 */}
          <Header />
          <main className="py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
