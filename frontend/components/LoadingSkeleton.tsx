export default function LoadingSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-2.5 py-1">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-12 rounded-xl"
          style={{ width: `${100 - (i % 3) * 9}%` }}
        />
      ))}
    </div>
  );
}
