"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Pricing that pays for itself with one collection</h1>
        <p className="mt-2 max-w-2xl text-base text-slate-700">
          One recovered invoice covers years of ProfitPilot. Distributor tier costs less than a
          single spoiled carton of stock per month — and it watches every cedi.
        </p>
      </div>

      <section aria-label="Return calculator" className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="font-bold">What is one avoided cash gap worth to you?</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Overdue receivables right now (GH₵)
            <input
              type="number"
              min={0}
              value={overdue}
              onChange={(e) => setOverdue(e.target.value)}
              className="mt-1 min-h-[48px] w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            />
          </label>
          <label className="text-sm">
            Share you could recover with ranked reminders: <strong>{recovery}%</strong>
            <input
              type="range"
              min={5}
              max={90}
              value={recovery}
              onChange={(e) => setRecovery(Number(e.target.value))}
              className="mt-3 w-full accent-emerald-800"
            />
          </label>
        </div>
        <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          Recoverable cash: <strong className="text-base">{formatMoney(recovered.toFixed(2))}</strong>
          {" "}— about <strong>{recovered > 0 ? Math.max(1, Math.round(recovered / 450)) : 0}×</strong> the
          monthly Distributor plan.
        </p>
      </section>

      <section aria-label="Plans" className="space-y-3">
        {TIERS.map((tier) => (
          <article
            key={tier.name}
            className={`rounded-lg border p-4 sm:p-5 ${tier.featured ? "border-emerald-800 bg-white" : "border-slate-200 bg-white"}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-bold">
                {tier.name}
                {tier.featured && (
                  <span className="ml-2 rounded-full bg-emerald-800 px-2 py-0.5 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}
              </h2>
              <p><span className="text-2xl font-bold">{tier.price}</span><span className="text-sm text-slate-500"> {tier.period}</span></p>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {tier.lines.map((line) => (
                <li key={line}>✓ {line}</li>
              ))}
            </ul>
            <Link
              href={tier.href}
              className={`mt-3 inline-block min-h-[44px] rounded-md px-4 py-2.5 text-sm font-medium ${
                tier.featured ? "bg-emerald-800 text-white hover:bg-emerald-900" : "border border-slate-300 hover:bg-slate-100"
              }`}
            >
              {tier.cta}
            </Link>
          </article>
        ))}
      </section>

      <section aria-label="Guarantee" className="text-sm leading-relaxed text-slate-700">
        <h2 className="font-bold text-slate-900">The honest guarantee</h2>
        <p className="mt-1">
          If a month passes without a single verified finding you act on, that month is free.
          Verification cuts both ways: we only win when the evidence does.
        </p>
      </section>
    </div>
  );
}
