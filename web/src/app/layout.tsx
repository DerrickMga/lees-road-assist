import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { NotificationProvider } from "@/lib/notifications";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <NotificationProvider>
            {/* Top navigation bar */}
            <header
              style={{ background: "var(--brand-navy)" }}
              className="sticky top-0 z-50 shadow-md"
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
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-white/80">
                  <Link href="/customer/dashboard" className="hover:text-white transition">Dashboard</Link>
                  <Link href="/customer/requests"   className="hover:text-white transition">My Requests</Link>
                  <Link href="/customer/profile"    className="hover:text-white transition">Profile</Link>
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

