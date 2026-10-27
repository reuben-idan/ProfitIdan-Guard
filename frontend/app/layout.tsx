import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "ProfitPilot AI" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-bold text-emerald-700">
              ProfitPilot AI
            </Link>
            <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
              Investigate
            </Link>
            <Link href="/actions" className="text-sm text-slate-600 hover:text-slate-900">
              Actions
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
