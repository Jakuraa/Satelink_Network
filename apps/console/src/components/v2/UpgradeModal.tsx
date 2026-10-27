"use client";

import React, { useState } from "react";
import { Check, X, Zap, ShieldCheck, ArrowRight } from "lucide-react";
import type { PlanCatalog } from "@/lib/v2-shared";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlanId?: string;
  catalog?: PlanCatalog | null;
}

export function UpgradeModal({
  isOpen,
  onClose,
  currentPlanId = "pro",
  catalog: _catalog,
}: UpgradeModalProps) {
  const [targetTier, setTargetTier] = useState<"max_5x" | "max_20x">("max_5x");
  const [frequency, setFrequency] = useState<"monthly" | "yearly">("monthly");
  const [rail, setRail] = useState<"transacty" | "payram">("transacty");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Pricing details based on catalog or working baseline
  const planConfig = {
    max_5x: {
      name: "Max 5×",
      multiplier: "5×",
      description: "Substantially higher execution allowance for frequent agent workflows and high-frequency research.",
      monthlyInr: 3999,
      yearlyInr: 39990,
      monthlyUsd: 48,
      yearlyUsd: 480,
      weeklyUu: 37500,
      sessionUu: 7500,
      keys: 20,
      machines: 20,
      features: [
        "37,500 Usage Units / week (5× Pro allowance)",
        "7,500 UU per 5-hour rolling burst session",
        "20 active API keys and 20 autonomous agent machines",
        "Priority model routing (Claude 3.5 Sonnet, GPT-4o, DeepSeek R1)",
        "Full browser sandbox and Python code interpreter access",
      ],
    },
    max_20x: {
      name: "Max 20×",
      multiplier: "20×",
      description: "Highest execution capacity for autonomous pipelines, deep research sweeps, and continuous agent swarms.",
      monthlyInr: 7999,
      yearlyInr: 79990,
      monthlyUsd: 96,
      yearlyUsd: 960,
      weeklyUu: 150000,
      sessionUu: 30000,
      keys: 50,
      machines: 50,
      features: [
        "150,000 Usage Units / week (20× Pro allowance)",
        "30,000 UU per 5-hour rolling burst session",
        "50 active API keys and 50 autonomous agent machines",
        "Dedicated priority reasoning queue (o3-mini, o1-high)",
        "Up to 25 concurrent agent tasks and live sandbox orchestration",
        "Dedicated uptime SLA and high-throughput routing endpoints",
      ],
    },
  };

  const selected = planConfig[targetTier];
  const basePriceInr = frequency === "monthly" ? selected.monthlyInr : selected.yearlyInr;
  const gstInr = Math.round(basePriceInr * 0.18);
  const totalInr = basePriceInr + gstInr;

  const currentAllowanceUu = currentPlanId === "free" ? 500 : 7500;
  const allowanceIncreaseUu = selected.weeklyUu - currentAllowanceUu;

  const handleCheckout = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const PLAN_ID_MAP: Record<string, string> = {
        max_5x: "trading_ai_max",
        max_20x: "trading_ai_max",
        max: "trading_ai_max",
        pro: "trading_ai_pro",
        launch: "trading_ai_launch",
      };
      const planCatalogId = PLAN_ID_MAP[targetTier] ?? "trading_ai_max";
      if (rail === "payram") {
        window.location.href = `/billing/checkout?plan=${encodeURIComponent(planCatalogId)}&method=payram_usdt`;
        return;
      }
      if (rail === "transacty") {
        window.location.href = `/billing/checkout?plan=${encodeURIComponent(planCatalogId)}&method=transacty_upi`;
        return;
      }
      window.location.href = `/billing/checkout?plan=${encodeURIComponent(planCatalogId)}`;
      return;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to initiate checkout");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-2xl rounded-xl border border-sl-border bg-sl-surface p-6 shadow-2xl sm:p-8">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close upgrade modal"
          className="absolute top-5 right-5 rounded-lg p-1.5 text-sl-text-subtle transition-colors hover:bg-sl-surface-hover hover:text-sl-text"
        >
          <X className="size-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sl-accent">
          <Zap className="size-4" />
          <span>Scale Execution Allowance</span>
        </div>
        <h2 id="upgrade-modal-title" className="mt-1 font-sl-display text-2xl font-normal text-sl-text">
          Upgrade to Satelink Max
        </h2>
        <p className="mt-1 text-sm text-sl-text-muted">
          Increase weekly execution capacity and 5-hour session burst limits for demanding agent workflows.
        </p>

        {/* Plan Multiplier Switch */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTargetTier("max_5x")}
            className={`flex flex-col items-start rounded-lg border p-4 text-left transition-all ${
              targetTier === "max_5x"
                ? "border-sl-accent bg-sl-accent/10 ring-1 ring-sl-accent"
                : "border-sl-border bg-sl-bg hover:border-sl-border-strong"
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-semibold text-sl-text">Max 5×</span>
              <span className="rounded bg-sl-accent/20 px-2 py-0.5 text-xs font-bold text-sl-accent">
                5× Allowance
              </span>
            </div>
            <p className="mt-1 text-xs text-sl-text-muted">Power developers & frequent workflows</p>
            <div className="mt-3 text-lg font-bold text-sl-text">
              {frequency === "monthly" ? "₹3,999" : "₹39,990"}
              <span className="text-xs font-normal text-sl-text-subtle">
                /{frequency === "monthly" ? "mo" : "yr"}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTargetTier("max_20x")}
            className={`flex flex-col items-start rounded-lg border p-4 text-left transition-all ${
              targetTier === "max_20x"
                ? "border-sl-accent bg-sl-accent/10 ring-1 ring-sl-accent"
                : "border-sl-border bg-sl-bg hover:border-sl-border-strong"
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-semibold text-sl-text">Max 20×</span>
              <span className="rounded bg-sl-accent/20 px-2 py-0.5 text-xs font-bold text-sl-accent">
                20× Allowance
              </span>
            </div>
            <p className="mt-1 text-xs text-sl-text-muted">Autonomous swarms & deep sweeps</p>
            <div className="mt-3 text-lg font-bold text-sl-text">
              {frequency === "monthly" ? "₹7,999" : "₹79,990"}
              <span className="text-xs font-normal text-sl-text-subtle">
                /{frequency === "monthly" ? "mo" : "yr"}
              </span>
            </div>
          </button>
        </div>

        {/* Frequency Toggle */}
        <div className="mt-4 flex items-center justify-between rounded-lg border border-sl-border bg-sl-bg p-3">
          <div className="text-xs text-sl-text-muted">
            <span className="font-medium text-sl-text">Billing Cadence</span>
            {frequency === "yearly" && (
              <span className="ml-2 font-medium text-sl-accent">Save 16.7% upfront</span>
            )}
          </div>
          <div className="flex rounded-md border border-sl-border bg-sl-surface p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFrequency("monthly")}
              className={`rounded px-3 py-1 font-medium transition-colors ${
                frequency === "monthly" ? "bg-sl-accent text-sl-accent-ink" : "text-sl-text-muted hover:text-sl-text"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setFrequency("yearly")}
              className={`rounded px-3 py-1 font-medium transition-colors ${
                frequency === "yearly" ? "bg-sl-accent text-sl-accent-ink" : "text-sl-text-muted hover:text-sl-text"
              }`}
            >
              Yearly (Upfront)
            </button>
          </div>
        </div>

        {/* Allowance Comparison Card */}
        <div className="mt-4 rounded-lg border border-sl-border bg-sl-bg p-4">
          <div className="flex items-center justify-between text-xs font-medium text-sl-text-muted">
            <span>Allowance Comparison</span>
            <span className="text-sl-accent font-semibold">+{allowanceIncreaseUu.toLocaleString()} UU increase</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded border border-sl-border/60 bg-sl-surface p-2.5">
              <span className="text-sl-text-subtle">Weekly Capacity</span>
              <p className="mt-1 font-mono text-base font-semibold text-sl-text">
                {selected.weeklyUu.toLocaleString()} <span className="text-xs font-normal text-sl-text-muted">UU</span>
              </p>
              <p className="text-[11px] text-sl-text-subtle">≈ {selected.weeklyUu / 10} complex agent queries</p>
            </div>
            <div className="rounded border border-sl-border/60 bg-sl-surface p-2.5">
              <span className="text-sl-text-subtle">5-Hour Burst Limit</span>
              <p className="mt-1 font-mono text-base font-semibold text-sl-text">
                {selected.sessionUu.toLocaleString()} <span className="text-xs font-normal text-sl-text-muted">UU</span>
              </p>
              <p className="text-[11px] text-sl-text-subtle">Dedicated burst bucket</p>
            </div>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-sl-text-muted">
            {selected.features.slice(2).map((feat) => (
              <li key={feat} className="flex items-center gap-2">
                <Check className="size-3.5 shrink-0 text-sl-accent" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Payment Rail Selection */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-sl-text-muted">Payment Rail</label>
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
            <button
              type="button"
              onClick={() => setRail("transacty")}
              className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors ${
                rail === "transacty"
                  ? "border-sl-accent bg-sl-accent/10 text-sl-text ring-1 ring-sl-accent"
                  : "border-sl-border bg-sl-bg text-sl-text-muted hover:border-sl-border-strong"
              }`}
            >
              <ShieldCheck className="size-4 shrink-0 text-sl-accent" />
              <div>
                <span className="font-semibold block text-sl-text">Transacty Fiat</span>
                <span className="text-[11px] text-sl-text-subtle">UPI / NetBanking / Cards</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setRail("payram")}
              className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors ${
                rail === "payram"
                  ? "border-sl-accent bg-sl-accent/10 text-sl-text ring-1 ring-sl-accent"
                  : "border-sl-border bg-sl-bg text-sl-text-muted hover:border-sl-border-strong"
              }`}
            >
              <Zap className="size-4 shrink-0 text-sl-accent" />
              <div>
                <span className="font-semibold block text-sl-text">PayRam Crypto</span>
                <span className="text-[11px] text-sl-text-subtle">USDT (Polygon) / USDC (Base)</span>
              </div>
            </button>
          </div>
        </div>

        {/* Pricing Summary & Proration */}
        <div className="mt-4 rounded-lg border border-sl-border/60 bg-sl-bg/50 p-3 text-xs">
          <div className="flex justify-between text-sl-text-muted">
            <span>Base Subscription ({frequency})</span>
            <span className="font-mono text-sl-text">₹{basePriceInr.toLocaleString()}</span>
          </div>
          <div className="mt-1 flex justify-between text-sl-text-muted">
            <span>GST (18% statutory)</span>
            <span className="font-mono text-sl-text">₹{gstInr.toLocaleString()}</span>
          </div>
          <div className="mt-1 flex justify-between text-sl-text-muted">
            <span>Current plan proration</span>
            <span className="text-sl-accent font-medium">Calculated at checkout</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-sl-border/60 pt-2 font-semibold text-sl-text">
            <span>Amount due today</span>
            <span className="font-mono text-base text-sl-accent">₹{totalInr.toLocaleString()}</span>
          </div>
          <p className="mt-1 text-[11px] text-sl-text-subtle">
            Renews automatically every {frequency === "monthly" ? "month" : "year"} until cancelled. You can change plans or cancel at any time in Settings.
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs text-sl-down">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-sl-border px-4 py-2.5 text-xs font-medium text-sl-text transition-colors hover:bg-sl-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleCheckout}
            className="inline-flex items-center gap-2 rounded-lg bg-sl-accent px-5 py-2.5 text-xs font-semibold text-sl-accent-ink transition-colors hover:bg-sl-accent-strong disabled:opacity-50"
          >
            {isSubmitting ? "Initiating checkout…" : `Confirm & Upgrade to ${selected.name}`}
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
