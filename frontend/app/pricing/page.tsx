"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Money, Pill } from "@/components/ui";

const TIERS = [
  {
    name: "Try",
    price: "GH₵0",
    period: "free",
    lines: ["Demo dataset + 3 instant reviews", "TradeGuard verdicts on every claim", "1 action draft with WhatsApp text"],
    cta: "Start free",
    href: "/",
    featured: false,
  },
  {
    name: "Distributor",
    price: "GH₵450",
    period: "/month",
    lines: [
      "Unlimited instant reviews, 40 AI investigations",
      "Your own CSVs + live cash snapshot",
      "Unlimited WhatsApp-ready drafts + audit trail",
      "Weekly cash-risk email before payables hit",
    ],
    cta: "Start 14-day trial",
    href: "/",
    featured: true,
  },
  {
    name: "Accountant",
    price: "GH₵1,800",
    period: "/month",
    lines: ["5 client businesses in one login", "Exportable evidence packs per client", "Priority support on WhatsApp"],
    cta: "Talk to us",
    href: "/",
    featured: false,
  },
];

export default function PricingPage() {
  const [overdue, setOverdue] = useState("27000");
  const [recovery, setRecovery] = useState(40);
  const recovered = (Number(overdue) || 0) * (recovery / 100);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="max-w-xl font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Pricing that pays for itself with one collection
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink/70">
          One recovered invoice covers years of ProfitPilot. The Distributor tier costs less than a
          single spoiled carton of stock per month — and it watches every cedi.
        </p>
      </div>

      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-bold tracking-tight">What is one avoided cash gap worth to you?</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Overdue receivables right now (GH₵)
            <input
              type="number"
              min={0}
              inputMode="decimal"
              value={overdue}
              onChange={(e) => setOverdue(e.target.value)}
              className="mt-1.5 min-h-[48px] w-full rounded-lg border border-ink/15 bg-white px-3.5 py-2 text-base tabular-nums"
            />
          </label>
          <label className="text-sm font-medium">
            Share you could recover with ranked reminders:{" "}
            <strong className="font-display text-base tabular-nums">{recovery}%</strong>
            <input
              type="range"
              min={5}
              max={90}
              value={recovery}
              onChange={(e) => setRecovery(Number(e.target.value))}
              className="mt-4 w-full accent-pine-800"
            />
          </label>
        </div>
        <p className="mt-3 rounded-xl bg-pine-50 px-4 py-3 text-sm text-pine-900">
          Recoverable cash:{" "}
          <Money amount={recovered.toFixed(2)} className="text-lg font-bold" /> — about{" "}
          <strong className="font-display tabular-nums">
            {recovered > 0 ? Math.max(1, Math.round(recovered / 450)) : 0}×
          </strong>{" "}
          the monthly Distributor plan.
        </p>
      </Card>

      <section aria-label="Plans" className="grid gap-3 lg:grid-cols-3">
        {TIERS.map((tier) => (
          <article
            key={tier.name}
            className={`flex flex-col rounded-2xl border p-5 ${
              tier.featured
                ? "border-pine-900 bg-pine-900 text-white shadow-pop"
                : "border-ink/10 bg-white shadow-card"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-bold">{tier.name}</h2>
              {tier.featured && (
                <Pill tone="ok" className="bg-white/15 text-white">
                  Most popular
                </Pill>
              )}
            </div>
            <p className="mt-1">
              <span className="font-display text-3xl font-bold tabular-nums">{tier.price}</span>{" "}
              <span className={`text-sm ${tier.featured ? "text-pine-100/80" : "text-ink/55"}`}>
                {tier.period}
              </span>
            </p>
            <ul className={`mt-3 flex-1 space-y-2 text-sm leading-relaxed ${tier.featured ? "text-pine-50" : "text-ink/75"}`}>
              {tier.lines.map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden="true" className={tier.featured ? "text-pine-200" : "text-pine-700"}>
                    ✓
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <Link
              href={tier.href}
              className={`mt-4 inline-flex min-h-[48px] items-center justify-center rounded-lg px-4 py-2.5 text-sm font-bold transition active:scale-[0.98] ${
                tier.featured
                  ? "bg-white text-pine-900 hover:bg-pine-50"
                  : "bg-pine-800 text-white hover:bg-pine-900"
              }`}
            >
              {tier.cta}
            </Link>
          </article>
        ))}
      </section>

      <section aria-label="Guarantee" className="max-w-xl text-sm leading-relaxed">
        <h2 className="font-bold">The honest guarantee</h2>
        <p className="mt-1 text-ink/70">
          If a month passes without a single verified finding you act on, that month is free.
          Verification cuts both ways: we only win when the evidence does.
        </p>
      </section>
    </div>
  );
}
