"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";

/** Animated money figure: eases 0 → amount once mounted. Static when
 * reduced motion is preferred. */
export default function CountUp({
  amount,
  currency = "GHS",
  className = "",
}: {
  amount: number;
  currency?: string;
  className?: string;
}) {
  const [shown, setShown] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(amount);
      return;
    }
    const start = performance.now();
    const duration = 800;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(amount * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [amount]);

  return (
    <span className={`font-display tabular-nums ${className}`}>
      {formatMoney(shown.toFixed(2), currency)}
    </span>
  );
}
