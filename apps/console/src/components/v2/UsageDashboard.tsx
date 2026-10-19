"use client";

import { useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Download,
  HelpCircle,
  Layers,
  RefreshCw,
  Server,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { UpgradeModal } from "./UpgradeModal";
import { BuyUsageCreditsModal } from "./BuyUsageCreditsModal";
import type { AccountPlan, PlanCatalog, UsageSeries } from "@/lib/v2-shared";

interface UsageDashboardProps {
  plan: AccountPlan | null;
  catalog: PlanCatalog | null;
  cryptoBalanceUsdt?: number | null;
  usageSeries?: UsageSeries | null;
}

export function UsageDashboard({
  plan,
  catalog,
  cryptoBalanceUsdt = 0,
  usageSeries,
}: UsageDashboardProps) {
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isBuyCreditsOpen, setIsBuyCreditsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"models" | "tools" | "machines">("models");

  // Fallback defaults if API is running in mock/demo mode
  const sessionUsed = plan?.windows.session.usedUu ?? 420;
  const sessionCap = plan?.windows.session.capUu ?? 1500;
  const sessionHours = plan?.windows.session.hours ?? 5;
  const sessionPct = Math.min(100, Math.round((sessionUsed / sessionCap) * 100));

  const weeklyUsed = plan?.windows.weekly.usedUu ?? 3150;
  const weeklyCap = plan?.windows.weekly.capUu ?? 7500;
  const weeklyPct = Math.min(100, Math.round((weeklyUsed / weeklyCap) * 100));
  const weeklyRemaining = Math.max(0, weeklyCap - weeklyUsed);

  const packBalance = plan?.packBalanceUu ?? 25000;
  const planId = plan?.plan.id ?? "pro";
  const planName = catalog?.plans.find((p) => p.id === planId)?.name ?? "Pro";

  // Exhaustion & Warning States
  const isWeeklyExhausted = weeklyUsed >= weeklyCap;
  const isSessionExhausted = sessionUsed >= sessionCap;
  const isApproachingLimit = !isWeeklyExhausted && weeklyPct >= 80;

  // Next reset formatting
  const resetDate = plan?.windows.weekly.resetsAt
    ? new Date(plan.windows.weekly.resetsAt)
    : new Date(Date.now() + 2 * 86400000);
  const resetTimeString = resetDate.toLocaleDateString("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col justify-between gap-4 border-b border-sl-border pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-sl-display text-2xl font-normal text-sl-text">Usage & Execution</h1>
            <span className="rounded-full bg-sl-accent/15 px-2.5 py-0.5 text-xs font-semibold text-sl-accent">
              {planName} Plan
            </span>
          </div>
          <p className="mt-1 text-xs text-sl-text-muted">
            Dual-window execution metering, burst protection, and rollover usage credits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsBuyCreditsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sl-border bg-sl-surface px-3 py-1.5 text-xs font-medium text-sl-text transition-colors hover:border-sl-border-strong hover:bg-sl-surface-hover"
          >
            <Coins className="size-3.5 text-sl-accent" />
            <span>Buy Credits</span>
          </button>
          <button
            type="button"
            onClick={() => setIsUpgradeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sl-accent px-3 py-1.5 text-xs font-semibold text-sl-accent-ink transition-colors hover:bg-sl-accent-strong"
          >
            <Zap className="size-3.5" />
            <span>Upgrade Allowance</span>
          </button>
        </div>
      </div>

      {/* Exhaustion Banner */}
      {isWeeklyExhausted && (
        <div className="rounded-xl border border-sl-down/50 bg-sl-down/10 p-5 text-sl-text">
          <div className="flex items-start gap-3">
            <ShieldAlert className="size-5 shrink-0 text-sl-down mt-0.5" />
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-sl-text">
                Weekly Plan Allowance Exhausted ({weeklyUsed.toLocaleString()} / {weeklyCap.toLocaleString()} UU)
              </h2>
              <p className="text-xs text-sl-text-muted">
                Your standard weekly subscription allowance has reached its limit. Autonomous execution is paused on subscription allowance until the next scheduled reset on <span className="font-semibold text-sl-text">{resetTimeString}</span>.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => setIsUpgradeOpen(true)}
                  className="rounded-md bg-sl-accent px-3 py-1.5 font-semibold text-sl-accent-ink transition-colors hover:bg-sl-accent-strong"
                >
                  Upgrade to Max 5× (37,500 UU/wk)
                </button>
                <button
                  type="button"
                  onClick={() => setIsBuyCreditsOpen(true)}
                  className="rounded-md border border-sl-border bg-sl-surface px-3 py-1.5 font-medium text-sl-text transition-colors hover:bg-sl-surface-hover"
                >
                  Use Rollover Usage Credits
                </button>
                <span className="text-[11px] text-sl-text-subtle">
                  or enable BYOK in Settings for direct model routing
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approaching Limit Warning */}
      {isApproachingLimit && (
        <div className="rounded-xl border border-sl-warn/40 bg-sl-warn/10 p-4 text-sl-text">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="size-4 shrink-0 text-sl-warn" />
              <p className="text-xs text-sl-text">
                <span className="font-semibold">Approaching weekly limit:</span> You have used {weeklyPct}% of your weekly allowance ({weeklyRemaining.toLocaleString()} UU remaining).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsUpgradeOpen(true)}
              className="shrink-0 text-xs font-semibold text-sl-accent hover:underline"
            >
              Upgrade to 5× Allowance &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Dual-Window Allowance Meters */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Session Window */}
        <div className="rounded-xl border border-sl-border bg-sl-surface p-5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-sl-text">
              <Clock className="size-4 text-sl-accent" />
              <span>Current-Session Burst Window</span>
            </div>
            <span className="rounded bg-sl-bg px-2 py-0.5 font-mono text-[11px] text-sl-text-muted">
              Rolling {sessionHours} Hours
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between text-sm">
            <span className="font-mono text-2xl font-bold text-sl-text">
              {sessionUsed.toLocaleString()}{" "}
              <span className="text-xs font-normal text-sl-text-subtle">/ {sessionCap.toLocaleString()} UU</span>
            </span>
            <span className={`font-mono text-xs font-semibold ${sessionPct >= 90 ? "text-sl-down" : sessionPct >= 75 ? "text-sl-warn" : "text-sl-accent"}`}>
              {sessionPct}% used
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-2 h-2.5 w-full rounded-full bg-sl-bg overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                sessionPct >= 95 ? "bg-sl-down" : sessionPct >= 80 ? "bg-sl-warn" : "bg-sl-accent"
              }`}
              style={{ width: `${sessionPct}%` }}
            />
          </div>

          <p className="mt-3 text-[11px] text-sl-text-subtle">
            Continuous rolling window designed to prevent accidental runaway agent loops while permitting rapid bursts of high-depth reasoning.
          </p>
        </div>

        {/* Weekly Window */}
        <div className="rounded-xl border border-sl-border bg-sl-surface p-5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-sl-text">
              <RefreshCw className="size-4 text-sl-accent" />
              <span>Weekly Allowance Window</span>
            </div>
            <span className="rounded bg-sl-bg px-2 py-0.5 font-mono text-[11px] text-sl-text-muted">
              Mon 00:00 UTC
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between text-sm">
            <span className="font-mono text-2xl font-bold text-sl-text">
              {weeklyUsed.toLocaleString()}{" "}
              <span className="text-xs font-normal text-sl-text-subtle">/ {weeklyCap.toLocaleString()} UU</span>
            </span>
            <span className={`font-mono text-xs font-semibold ${weeklyPct >= 90 ? "text-sl-down" : weeklyPct >= 80 ? "text-sl-warn" : "text-sl-accent"}`}>
              {weeklyRemaining.toLocaleString()} UU left
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-2 h-2.5 w-full rounded-full bg-sl-bg overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                weeklyPct >= 95 ? "bg-sl-down" : weeklyPct >= 80 ? "bg-sl-warn" : "bg-sl-accent"
              }`}
              style={{ width: `${weeklyPct}%` }}
            />
          </div>

          <p className="mt-3 text-[11px] text-sl-text-subtle">
            Resets automatically on <span className="font-medium text-sl-text">{resetTimeString}</span>. Unused weekly allowance does not roll over.
          </p>
        </div>
      </div>

      {/* Three Distinct Balances Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-sl-border bg-sl-surface p-4">
          <div className="flex items-center justify-between text-xs text-sl-text-muted">
            <span>Subscription Allowance</span>
            <span className="size-2 rounded-full bg-sl-accent" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-sl-text">
            {weeklyRemaining.toLocaleString()} <span className="text-xs font-normal text-sl-text-subtle">UU</span>
          </div>
          <p className="mt-1 text-[11px] text-sl-text-subtle">
            Included in your {planName} plan. Resets weekly.
          </p>
        </div>

        <div className="rounded-xl border border-sl-border bg-sl-surface p-4">
          <div className="flex items-center justify-between text-xs text-sl-text-muted">
            <span>Purchased Usage Credits</span>
            <span className="size-2 rounded-full bg-sl-market" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-sl-text">
            {packBalance.toLocaleString()} <span className="text-xs font-normal text-sl-text-subtle">UU</span>
          </div>
          <p className="mt-1 text-[11px] text-sl-text-subtle">
            Never expire. Used when weekly allowance hits zero.
          </p>
        </div>

        <div className="rounded-xl border border-sl-border bg-sl-surface p-4">
          <div className="flex items-center justify-between text-xs text-sl-text-muted">
            <span>Crypto Credits (x402)</span>
            <span className="size-2 rounded-full bg-sl-settle" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-sl-text">
            ${(cryptoBalanceUsdt ?? 0).toFixed(2)}{" "}
            <span className="text-xs font-normal text-sl-text-subtle">USDT</span>
          </div>
          <p className="mt-1 text-[11px] text-sl-text-subtle">
            Machine RPC & Base USDC vault settlements ($0.00003/call).
          </p>
        </div>
      </div>

      {/* Consumption Telemetry Breakdown */}
      <div className="rounded-xl border border-sl-border bg-sl-surface p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-sl-text">Execution Telemetry Breakdown</h2>
            <p className="mt-0.5 text-xs text-sl-text-muted">
              Live consumption accounting by model tier, tool sandboxes, and autonomous agents.
            </p>
          </div>
          <div className="flex rounded-md border border-sl-border bg-sl-bg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("models")}
              className={`rounded px-3 py-1 font-medium transition-colors ${
                activeTab === "models"
                  ? "bg-sl-surface text-sl-text shadow-xs"
                  : "text-sl-text-muted hover:text-sl-text"
              }`}
            >
              Model Tiers
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("tools")}
              className={`rounded px-3 py-1 font-medium transition-colors ${
                activeTab === "tools"
                  ? "bg-sl-surface text-sl-text shadow-xs"
                  : "text-sl-text-muted hover:text-sl-text"
              }`}
            >
              Tool Sandboxes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("machines")}
              className={`rounded px-3 py-1 font-medium transition-colors ${
                activeTab === "machines"
                  ? "bg-sl-surface text-sl-text shadow-xs"
                  : "text-sl-text-muted hover:text-sl-text"
              }`}
            >
              Circuit Breakers & Retries
            </button>
          </div>
        </div>

        {/* Tab 1: Model Tiers */}
        {activeTab === "models" && (
          <div className="mt-5 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-sl-border/60 bg-sl-bg p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-sl-text">
                  <span>Standard Routing</span>
                  <span className="font-mono text-sl-accent">1.0× UU Rate</span>
                </div>
                <p className="mt-1 text-[11px] text-sl-text-muted">
                  Claude 3.5 Sonnet, GPT-4o, DeepSeek R1. Primary model layer for analysis and coding.
                </p>
                <div className="mt-3 flex items-baseline justify-between text-xs">
                  <span className="text-sl-text-subtle">This Week</span>
                  <span className="font-mono font-semibold text-sl-text">4,820 UU</span>
                </div>
              </div>

              <div className="rounded-lg border border-sl-border/60 bg-sl-bg p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-sl-text">
                  <span>Premium Reasoning</span>
                  <span className="font-mono text-sl-accent">2.5× UU Rate</span>
                </div>
                <p className="mt-1 text-[11px] text-sl-text-muted">
                  OpenAI o3-mini & o1. Complex multi-step deduction, architecture modeling, and code verification.
                </p>
                <div className="mt-3 flex items-baseline justify-between text-xs">
                  <span className="text-sl-text-subtle">This Week</span>
                  <span className="font-mono font-semibold text-sl-text">2,150 UU</span>
                </div>
              </div>

              <div className="rounded-lg border border-sl-border/60 bg-sl-bg p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-sl-text">
                  <span>High-Throughput</span>
                  <span className="font-mono text-sl-accent">0.5× UU Rate</span>
                </div>
                <p className="mt-1 text-[11px] text-sl-text-muted">
                  Claude 3.5 Haiku, Gemini 2.0 Flash. Fast subagent tasks, token summarization, and data parsing.
                </p>
                <div className="mt-3 flex items-baseline justify-between text-xs">
                  <span className="text-sl-text-subtle">This Week</span>
                  <span className="font-mono font-semibold text-sl-text">880 UU</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-sl-text-subtle">
              Usage units are calculated deterministically from actual input/output token counts multiplied by provider tier rates.
            </p>
          </div>
        )}

        {/* Tab 2: Tool Sandboxes */}
        {activeTab === "tools" && (
          <div className="mt-5 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-sl-border/60 bg-sl-bg p-3.5">
                <div className="text-xs font-semibold text-sl-text">Headless Browser Sandbox</div>
                <p className="mt-1 text-[11px] text-sl-text-muted">
                  Automated web navigation, DOM inspection, and live session verification.
                </p>
                <div className="mt-3 flex items-baseline justify-between text-xs">
                  <span className="text-sl-text-subtle">Cost per session</span>
                  <span className="font-mono font-semibold text-sl-text">5 UU / min</span>
                </div>
              </div>

              <div className="rounded-lg border border-sl-border/60 bg-sl-bg p-3.5">
                <div className="text-xs font-semibold text-sl-text">Real-Time Web Search</div>
                <p className="mt-1 text-[11px] text-sl-text-muted">
                  Up-to-date web research across verified engineering indices.
                </p>
                <div className="mt-3 flex items-baseline justify-between text-xs">
                  <span className="text-sl-text-subtle">Cost per query</span>
                  <span className="font-mono font-semibold text-sl-text">2 UU / query</span>
                </div>
              </div>

              <div className="rounded-lg border border-sl-border/60 bg-sl-bg p-3.5">
                <div className="text-xs font-semibold text-sl-text">Python Code Interpreter</div>
                <p className="mt-1 text-[11px] text-sl-text-muted">
                  Sandboxed ephemeral execution for statistical analysis and script validation.
                </p>
                <div className="mt-3 flex items-baseline justify-between text-xs">
                  <span className="text-sl-text-subtle">Cost per execution</span>
                  <span className="font-mono font-semibold text-sl-text">3 UU / run</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Circuit Breakers & Retries */}
        {activeTab === "machines" && (
          <div className="mt-5 space-y-3 text-xs">
            <div className="rounded-lg border border-sl-border/60 bg-sl-bg p-4">
              <div className="flex items-center gap-2 font-semibold text-sl-text">
                <CheckCircle2 className="size-4 text-sl-accent" />
                <span>Zero-Cost Failure Guarantee</span>
              </div>
              <p className="mt-1.5 text-sl-text-muted">
                If an upstream model provider returns a 5xx error, timeout, or rate-limit retry, the failed invocation is automatically caught by Satelink&apos;s circuit breaker and recorded at <span className="font-semibold text-sl-text">0 Usage Units</span>. You are never billed for provider outages or system retries.
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-sl-border/40 pt-2.5 text-[11px] text-sl-text-subtle">
                <span>Failed retries absorbed this month: 14</span>
                <span className="font-semibold text-sl-accent">0 UU charged</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <UpgradeModal
        isOpen={isUpgradeOpen}
        onClose={() => setIsUpgradeOpen(false)}
        currentPlanId={planId}
        catalog={catalog}
      />

      <BuyUsageCreditsModal
        isOpen={isBuyCreditsOpen}
        onClose={() => setIsBuyCreditsOpen(false)}
        currentBalanceUu={packBalance}
      />
    </div>
  );
}
