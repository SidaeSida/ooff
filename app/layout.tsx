// app/layout.tsx
export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "../components/Header";
import AuthProvider from "../components/AuthProvider";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OOFF",
  description: "Our Own Film Festival",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-50 text-gray-900`}>
        <AuthProvider session={session}>
          <div className="mx-auto w-full max-w-[420px] px-4">
            <Header />
            <main className="py-6">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
