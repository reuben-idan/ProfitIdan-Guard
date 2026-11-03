export default function LoadingSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-slate-200" style={{ width: `${92 - i * 12}%` }} />
      ))}
    </div>
  );
}
