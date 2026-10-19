"use client";

import { useState } from "react";
import { Check, ArrowRight, ShieldCheck, Zap, Sparkles, Building2, HelpCircle } from "lucide-react";
import type { PublicCatalog, PublicPlan } from "@/lib/plan-catalog";

const CONSOLE = "https://console.satelink.network";

interface PlanCardsProps {
  catalog: PublicCatalog;
  period?: "monthly" | "yearly";
  currency?: "INR" | "USD";
  onSelectEnterprise?: () => void;
}

export function PlanCards({
  catalog,
  period = "monthly",
  currency = "INR",
  onSelectEnterprise,
}: PlanCardsProps) {
  // Find canonical plans
  const free = catalog.plans.find((p) => p.id === "free");
  const proMonthly = catalog.plans.find((p) => p.id === "pro");
  const proYearly = catalog.plans.find((p) => p.id === "pro_yearly");
  const max5xMonthly = catalog.plans.find((p) => p.id === "max_5x") || catalog.plans.find((p) => p.id === "max");
  const max5xYearly = catalog.plans.find((p) => p.id === "max_5x_yearly") || catalog.plans.find((p) => p.id === "max_yearly");
  const max20xMonthly = catalog.plans.find((p) => p.id === "max_20x");
  const max20xYearly = catalog.plans.find((p) => p.id === "max_20x_yearly");

  const isYearly = period === "yearly";

  const tiers = [
    {
      id: "free",
      name: "Free",
      tagline: "Controlled discovery tier for testing and evaluation.",
      badge: null,
      priceInr: 0,
      priceUsd: 0,
      effectiveInr: 0,
      effectiveUsd: 0,
      weeklyAllowance: free?.allowance.weeklyTiRequests || 50,
      sessionAllowance: free?.allowance.sessionTiRequests || 10,
      sessionHours: free?.allowance.sessionHours || 5,
      weeklyUu: free?.allowance.weeklyUu || 500,
      sessionUu: free?.allowance.sessionUu || 100,
      concurrency: 1,
      apiKeys: 1,
      models: "Standard fast routing (Gemini 1.5 Flash, Haiku, Llama 3.3)",
      reasoning: "No unrestricted reasoning",
      memory: "Basic session memory",
      features: [
        "Up to 50 requests / week",
        "10 requests per 5-hour session",
        "1 active API key",
        "Deterministic rate limits",
        "Web search & document tools",
        "Machine-readable discovery"
      ],
      purchasable: true,
      cta: "Start free",
      featured: false,
    },
    {
      id: "pro",
      name: "Pro",
      tagline: "Normal AI assistance, research, and moderate agent workflows.",
      badge: "Most popular",
      priceInr: isYearly ? 9990 : 999,
      priceUsd: isYearly ? 120 : (proMonthly?.priceUsd || 19),
      effectiveInr: isYearly ? 832.5 : 999,
      effectiveUsd: isYearly ? 10 : (proMonthly?.priceUsd || 19),
      weeklyAllowance: proMonthly?.allowance.weeklyTiRequests || 750,
      sessionAllowance: proMonthly?.allowance.sessionTiRequests || 150,
      sessionHours: proMonthly?.allowance.sessionHours || 5,
      weeklyUu: proMonthly?.allowance.weeklyUu || 7500,
      sessionUu: proMonthly?.allowance.sessionUu || 1500,
      concurrency: 3,
      apiKeys: 5,
      models: "Workhorse models (Claude 3.5 Sonnet, GPT-4o)",
      reasoning: "5 premium reasoning passes / month",
      memory: "Persistent structured memory (5 projects)",
      features: [
        "7,500 UU (~750 requests) / week",
        "1,500 UU per 5-hour session",
        "Workhorse models: Sonnet 3.5 & GPT-4o",
        "5 premium reasoning passes / month",
        "Up to 3 concurrent agent runs",
        "5 API keys with spend alerts & caps",
        "Full web search, sandbox & data tools"
      ],
      purchasable: proMonthly?.purchasable ?? false,
      cta: "Choose Pro",
      featured: true,
    },
    {
      id: "max_5x",
      name: "Max 5×",
      tagline: "Substantially higher execution allowance for frequent users and power workflows.",
      badge: "5× Pro allowance",
      priceInr: isYearly ? 39990 : 3999,
      priceUsd: isYearly ? 480 : 48,
      effectiveInr: isYearly ? 3332.5 : 3999,
      effectiveUsd: isYearly ? 40 : 48,
      weeklyAllowance: max5xMonthly?.allowance.weeklyTiRequests || 3750,
      sessionAllowance: max5xMonthly?.allowance.sessionTiRequests || 750,
      sessionHours: max5xMonthly?.allowance.sessionHours || 5,
      weeklyUu: max5xMonthly?.allowance.weeklyUu || 37500,
      sessionUu: max5xMonthly?.allowance.sessionUu || 7500,
      concurrency: 10,
      apiKeys: 20,
      models: "All Pro models + Priority traffic routing",
      reasoning: "25 premium reasoning passes / month",
      memory: "Extended memory, unlimited projects",
      features: [
        "37,500 UU (~3,750 requests) / week",
        "7,500 UU per 5-hour session (5× burst)",
        "Priority traffic routing during peak hours",
        "25 premium reasoning passes / month",
        "Up to 10 concurrent agent runs",
        "20 API keys with granular budget gates",
        "Automated browser & execution sandbox"
      ],
      purchasable: max5xMonthly?.purchasable ?? false,
      cta: "Choose Max 5×",
      featured: false,
    },
    {
      id: "max_20x",
      name: "Max 20×",
      tagline: "Heavy research and continuous multi-step autonomous agent execution.",
      badge: "20× Pro allowance",
      priceInr: isYearly ? 79990 : 7999,
      priceUsd: isYearly ? 960 : 96,
      effectiveInr: isYearly ? 6665.83 : 7999,
      effectiveUsd: isYearly ? 80 : 96,
      weeklyAllowance: max20xMonthly?.allowance.weeklyTiRequests || 15000,
      sessionAllowance: max20xMonthly?.allowance.sessionTiRequests || 3000,
      sessionHours: max20xMonthly?.allowance.sessionHours || 5,
      weeklyUu: max20xMonthly?.allowance.weeklyUu || 150000,
      sessionUu: max20xMonthly?.allowance.sessionUu || 30000,
      concurrency: 25,
      apiKeys: 50,
      models: "All models + Dedicated routing queues",
      reasoning: "60 premium reasoning passes / month",
      memory: "Long-term vector & structured team memory",
      features: [
        "150,000 UU (~15,000 requests) / week",
        "30,000 UU per 5-hour session (20× burst)",
        "Dedicated routing queue with lowest latency",
        "60 premium reasoning passes / month",
        "Up to 25 concurrent agent runs",
        "50 API keys with programmatic allocation",
        "Team memory pooling & BYOK integration"
      ],
      purchasable: max20xMonthly?.purchasable ?? false,
      cta: "Choose Max 20×",
      featured: false,
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-4" data-testid="plan-cards">
      {tiers.map((t) => {
        const href =
          t.id === "free"
            ? `${CONSOLE}/sign-in?mode=signup`
            : `${CONSOLE}/sign-in?mode=signup&next=${encodeURIComponent(`/billing/add?plan=${t.id}${isYearly ? "_yearly" : ""}`)}`;

        const displayPrice = currency === "INR" ? `₹${(isYearly ? t.priceInr : t.priceInr).toLocaleString("en-IN")}` : `$${isYearly ? t.priceUsd : t.priceUsd}`;
        const effectiveSubtext =
          isYearly && t.id !== "free"
            ? currency === "INR"
              ? `₹${Math.round(t.effectiveInr).toLocaleString("en-IN")}/mo effective · save ~16.7%`
              : `$${Math.round(t.effectiveUsd)}/mo effective · save ~16.7%`
            : null;

        return (
          <article
            key={t.id}
            data-plan={t.id}
            className={`relative flex flex-col justify-between rounded-[var(--sl-radius-lg)] border bg-sl-surface p-6 transition-all duration-200 hover:shadow-lg ${
              t.featured
                ? "border-sl-accent shadow-md ring-1 ring-sl-accent/30"
                : "border-sl-border hover:border-sl-border-strong"
            }`}
          >
            {t.badge && (
              <div className="absolute -top-3 left-6">
                <span className="inline-flex items-center gap-1 rounded-full bg-sl-accent px-3 py-0.5 text-[11px] font-semibold text-sl-accent-ink uppercase tracking-wide">
                  <Sparkles className="size-3" />
                  {t.badge}
                </span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-sl-display text-xl font-bold text-sl-text">{t.name}</h3>
              </div>
              <p className="mt-2 min-h-[2.75rem] text-[13px] leading-relaxed text-sl-text-muted">{t.tagline}</p>

              <div className="mt-5 border-t border-sl-border/60 pt-5">
                <div className="flex items-baseline gap-1">
                  <span className="font-sl-display text-3xl font-bold tracking-tight text-sl-text">{displayPrice}</span>
                  <span className="text-[13px] text-sl-text-muted">
                    {t.id === "free" ? "forever" : isYearly ? "/year upfront" : "/month"}
                  </span>
                </div>
                {effectiveSubtext && (
                  <p className="mt-1.5 text-[12px] font-medium text-sl-accent">{effectiveSubtext}</p>
                )}
                {t.id !== "free" && (
                  <p className="mt-1 text-[11px] text-sl-text-subtle">+ applicable taxes (18% GST in India)</p>
                )}
              </div>

              <div className="mt-5 space-y-2.5 border-t border-sl-border/60 pt-5">
                <div className="rounded-md bg-sl-bg-raised p-2.5 text-[12px] text-sl-text">
                  <span className="font-medium text-sl-text">Included allowance:</span>
                  <p className="mt-0.5 text-sl-text-muted">
                    {t.weeklyUu.toLocaleString()} UU/wk (~{t.weeklyAllowance.toLocaleString()} tasks)
                  </p>
                  <p className="text-[11px] text-sl-text-subtle">
                    Refills up to {t.sessionUu.toLocaleString()} UU per {t.sessionHours}h session
                  </p>
                </div>

                <ul className="space-y-2 pt-2 text-[13px] text-sl-text">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-sl-accent" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6 border-t border-sl-border/60 pt-5">
              {t.id === "free" ? (
                <a
                  href={href}
                  className="inline-flex w-full h-11 items-center justify-center rounded-[var(--sl-radius)] border border-sl-border-strong bg-sl-surface text-[14px] font-semibold text-sl-text transition-colors hover:bg-sl-bg-raised hover:border-sl-text"
                >
                  {t.cta}
                </a>
              ) : t.purchasable ? (
                <a
                  href={href}
                  className={`inline-flex w-full h-11 items-center justify-center rounded-[var(--sl-radius)] text-[14px] font-semibold transition-colors ${
                    t.featured
                      ? "bg-sl-accent text-sl-accent-ink hover:bg-sl-accent-strong"
                      : "border border-sl-border-strong bg-sl-surface text-sl-text hover:bg-sl-bg-raised hover:border-sl-text"
                  }`}
                >
                  {t.cta}
                </a>
              ) : (
                <span className="inline-flex w-full h-11 items-center justify-center rounded-[var(--sl-radius)] border border-dashed border-sl-border text-[13px] text-sl-text-muted">
                  Available soon
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
