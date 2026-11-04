"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Review",
    icon: (
      <path
        d="M10.5 3a7.5 7.5 0 1 0 4.9 13.1l3.2 3.2a1 1 0 0 0 1.4-1.4l-3.2-3.2A7.5 7.5 0 0 0 10.5 3Zm0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z"
        fill="currentColor"
      />
    ),
  },
  {
    href: "/history",
    label: "History",
    icon: (
      <path
        d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3Zm1 4a1 1 0 0 0-2 0v5.4l3.4 2a1 1 0 0 0 1-1.7L13 11.6V7Z"
        fill="currentColor"
      />
    ),
  },
  {
    href: "/actions",
    label: "Actions",
    icon: (
      <path
        d="M12 2 4.5 5v6c0 5 3.2 8.7 7.5 11 4.3-2.3 7.5-6 7.5-11V5L12 2Zm0 2.2 5.5 2.3v4.5c0 3.9-2.5 7-5.5 8.9-3-1.9-5.5-5-5.5-8.9V6.5L12 4.2Zm-1.2 8.3a1 1 0 0 0-1.4 1.4l2.5 2.5a1 1 0 0 0 1.4 0l4.5-4.5a1 1 0 1 0-1.4-1.4L12 13.9l-2.2-2.4Z"
        fill="currentColor"
      />
    ),
  },
  {
    href: "/pricing",
    label: "Pricing",
    icon: (
      <path
        d="M4 4h7.6L20 12.4a2 2 0 0 1 0 2.8l-4.8 4.8a2 2 0 0 1-2.8 0L4 11.6V4Zm2 2v6.2l7 7 3.6-3.6-7-7H6Zm3.5 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"
        fill="currentColor"
      />
    ),
  },
];

export default function TabBar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <div className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center gap-1 px-2 pb-2.5 pt-2 text-[11px] font-semibold transition active:bg-pine-50 ${
                active ? "text-pine-800" : "text-ink/45"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-x-8 top-0 h-0.5 rounded-full transition ${
                  active ? "bg-pine-700" : "bg-transparent"
                }`}
              />
              <svg viewBox="0 0 24 24" className="h-6 w-6" role="img" aria-label="">
                {tab.icon}
              </svg>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
