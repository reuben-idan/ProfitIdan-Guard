import Link from "next/link";
import { btnPrimary } from "./ui";

export default function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/20 bg-white px-6 py-10 text-center shadow-card">
      <svg viewBox="0 0 48 48" className="mx-auto h-12 w-12 text-pine-200" aria-hidden="true">
        <circle cx="21" cy="21" r="13" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M31 31l9 9" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M15 21h12" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <h2 className="mt-3 text-lg font-bold tracking-tight">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-ink/65">{body}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className={`${btnPrimary} mt-4`}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
