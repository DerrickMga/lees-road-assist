import type { Metadata } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { NotificationProvider } from "@/lib/notifications";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lee's Express Courier",
  description: "On-demand roadside assistance & courier platform",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head />
      <body className={`${manrope.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <NotificationProvider>
            {/* Top navigation bar */}
            <header
              style={{
                background:
                  "linear-gradient(120deg, var(--brand-navy) 0%, #183563 62%, #214b88 100%)",
              }}
              className="sticky top-0 z-50 border-b border-white/10 shadow-lg shadow-slate-900/15"
            >
              <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3">
                  <Image
                    src="/logo.png"
                    alt="Lee's Express Courier"
                    width={120}
                    height={45}
                    priority
                    className="object-contain"
                  />
                </Link>
                <nav className="hidden md:flex items-center gap-2 text-sm font-semibold text-white/90">
                  <Link href="/customer/dashboard" className="rounded-lg px-3 py-1.5 hover:bg-white/10 transition">Dashboard</Link>
                  <Link href="/customer/requests" className="rounded-lg px-3 py-1.5 hover:bg-white/10 transition">My Requests</Link>
                  <Link href="/customer/profile" className="rounded-lg px-3 py-1.5 hover:bg-white/10 transition">Profile</Link>
                </nav>
              </div>
            </header>
            <main className="min-h-screen">{children}</main>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

