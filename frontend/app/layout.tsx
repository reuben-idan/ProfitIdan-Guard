import type { Metadata, Viewport } from "next";
import Link from "next/link";
import TabBar from "@/components/TabBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProfitPilot AI — the AI CFO for distributors",
  description:
    "Investigates profit leaks, verifies every figure, forecasts cash risk, and drafts your next action. Built for African distributors.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#083527",
};

const NAV = [
  { href: "/", label: "Review" },
  { href: "/history", label: "History" },
  { href: "/actions", label: "Actions" },
  { href: "/pricing", label: "Pricing" },
];

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-pine-900 font-display text-lg font-bold text-white"
    >
      P
    </span>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-ink/10 bg-white/90 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5" aria-label="Site">
            <Link href="/" className="flex items-center gap-2 py-1 pr-2">
              <BrandMark />
              <span className="text-[17px] font-bold tracking-tight text-ink">
                ProfitPilot
              </span>
            </Link>
            <div className="ml-auto hidden items-center gap-1 sm:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3.5 py-2 text-sm font-semibold text-ink/65 transition hover:bg-pine-50 hover:text-pine-900"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/"
                className="ml-2 rounded-full bg-pine-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-pine-900 active:scale-[0.98]"
              >
                New review
              </Link>
            </div>
            <Link
              href="/"
              className="ml-auto inline-flex min-h-[44px] items-center rounded-full bg-pine-800 px-4 py-2 text-sm font-bold text-white transition active:scale-[0.98] sm:hidden"
            >
              New review
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-6 sm:pb-14 sm:pt-8">
          {children}
        </main>
        <footer className="border-t border-ink/10 bg-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-5 text-xs leading-relaxed text-ink/55 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>ProfitPilot AI — verified answers for distributors. Demo data is fictional.</p>
            <p>Nothing executes without owner approval. Delivery is simulated in the demo.</p>
          </div>
          <div className="h-[env(safe-area-inset-bottom)] sm:hidden" />
        </footer>
        <TabBar />
      </body>
    </html>
  );
}
