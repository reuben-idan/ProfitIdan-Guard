import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProfitPilot AI — the AI CFO for distributors",
  description:
    "Investigates profit leaks, verifies every figure, forecasts cash risk, and drafts your next action. Built for African distributors.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#065f46",
};

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </Link>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2">
            <Link href="/" className="mr-2 flex items-center gap-2 py-2 pr-2">
              <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-800 text-sm font-bold text-white">
                P
              </span>
              <span className="font-bold text-emerald-900">ProfitPilot AI</span>
            </Link>
            <div className="ml-auto flex items-center">
              <NavLink href="/">Investigate</NavLink>
              <NavLink href="/history">History</NavLink>
              <NavLink href="/actions">Actions</NavLink>
              <NavLink href="/pricing">Pricing</NavLink>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:pb-12">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>ProfitPilot AI — verified answers for distributors. Demo data is fictional.</p>
            <p>Nothing executes without owner approval. Delivery is simulated in the demo.</p>
          </div>
        </footer>
        <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
          <div className="grid grid-cols-4 text-center text-xs font-medium">
            <Link href="/" className="px-2 py-3 text-slate-700 active:bg-slate-100">Investigate</Link>
            <Link href="/history" className="px-2 py-3 text-slate-700 active:bg-slate-100">History</Link>
            <Link href="/actions" className="px-2 py-3 text-slate-700 active:bg-slate-100">Actions</Link>
            <Link href="/pricing" className="px-2 py-3 text-slate-700 active:bg-slate-100">Pricing</Link>
          </div>
        </nav>
      </body>
    </html>
  );
}
