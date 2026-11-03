import Link from "next/link";

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
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{body}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-3 inline-block rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
