import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Code2,
  DollarSign,
  KeyRound,
  PlayCircle,
  ShieldAlert,
} from "lucide-react";
import type { TradingDiscovery } from "@/lib/trading";

type Props = {
  userName: string;
  discovery: TradingDiscovery;
  totalCredits: number;
  keysCount: number;
  hasActiveKey: boolean;
};

export function OverviewWorkspace({ discovery, totalCredits, keysCount }: Props) {

  // Primary next action calculation
  let nextAction = {
    title: "Create your first API key",
    description: "Issue a secure API key to authenticate trading simulation requests.",
    href: "/developers",
    cta: "Create Key",
    icon: KeyRound,
  };

  if (keysCount > 0 && totalCredits < discovery.price_usdt) {
    nextAction = {
      title: "Fund account credits ($0.05/run)",
      description: `Available balance is $${totalCredits.toFixed(4)} USDT. Top up with USDT on Polygon or x402 on Base to execute simulations.`,
      href: "/billing/add",
      cta: "Add Credits",
      icon: DollarSign,
    };
  } else if (keysCount > 0 && totalCredits >= discovery.price_usdt) {
    nextAction = {
      title: "Run a paper trading simulation",
      description: "Your account is funded. Execute a deterministic SMA crossover simulation in the sandbox studio.",
      href: "/paper-trading",
      cta: "Launch Studio",
      icon: PlayCircle,
    };
  }

  const checklist = [
    { label: "Create or link an API key", done: keysCount > 0, href: "/developers" },
    { label: "Fund credits ($0.05 per simulation)", done: totalCredits >= discovery.price_usdt, href: "/billing/add" },
    { label: "Run a paper simulation", done: false, href: "/paper-trading" },
    { label: "Integrate into bots or AI agents", done: false, href: "/developers" },
  ];

  return (
    <div className="space-y-6">
      {/* Product Hero */}
      <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sl-border bg-sl-bg px-2.5 py-0.5 font-mono text-[11px] font-medium text-sl-accent">
              <span className="size-1.5 rounded-full bg-sl-accent" /> Satelink Trading AI
            </span>
            <h1 className="font-sl-display text-2xl font-normal tracking-tight text-sl-text sm:text-3xl">
              Build. Simulate. Evaluate.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-sl-text-muted">
              Run algorithmic trading simulations through a developer-first API built for trading applications and AI agents.
              Inspect execution results, understand your costs, and integrate programmatic simulations into your workflow.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href="/paper-trading"
              className="inline-flex h-9 items-center gap-2 rounded bg-sl-accent px-4 text-xs font-semibold text-sl-accent-ink hover:bg-sl-accent-strong"
            >
              <PlayCircle className="size-4" /> Run a Paper Simulation
            </Link>
            <Link
              href="/developers"
              className="inline-flex h-9 items-center gap-2 rounded border border-sl-border bg-sl-bg px-4 text-xs font-medium text-sl-text hover:bg-sl-surface-hover"
            >
              <Code2 className="size-4" /> Explore the API
            </Link>
          </div>
        </div>

        {/* Mandatory Disclaimer */}
        <div className="mt-5 flex items-center gap-2 border-t border-sl-border pt-4 text-[11px] text-sl-text-subtle font-mono">
          <ShieldAlert className="size-3.5 text-sl-accent shrink-0" />
          <span>{discovery.disclaimer} · Live broker execution remains disabled.</span>
        </div>
      </div>

      {/* Primary Next Action Banner */}
      <div className="flex flex-col gap-4 rounded-[var(--sl-radius-lg)] border border-sl-accent/40 bg-sl-accent-soft p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded bg-sl-surface p-2 text-sl-accent">
            <nextAction.icon className="size-5" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-sl-accent">Recommended Next Step</span>
            <h3 className="font-medium text-sl-text">{nextAction.title}</h3>
            <p className="mt-0.5 text-xs text-sl-text-muted">{nextAction.description}</p>
          </div>
        </div>
        <Link
          href={nextAction.href}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded bg-sl-accent px-4 text-xs font-semibold text-sl-accent-ink hover:bg-sl-accent-strong"
        >
          {nextAction.cta} <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* KPI & Balance Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--sl-radius)] border border-sl-border bg-sl-surface p-4">
          <span className="text-xs text-sl-text-subtle">Available Crypto Credits</span>
          <p className="mt-1 font-mono text-xl font-semibold text-sl-text">
            ${totalCredits.toFixed(4)} <span className="text-xs font-normal text-sl-text-muted">USDT</span>
          </p>
          <span className="mt-1 block text-[11px] text-sl-text-muted">
            ≈ {Math.floor(totalCredits / discovery.price_usdt)} simulations available
          </span>
        </div>

        <div className="rounded-[var(--sl-radius)] border border-sl-border bg-sl-surface p-4">
          <span className="text-xs text-sl-text-subtle">Simulation Price</span>
          <p className="mt-1 font-mono text-xl font-semibold text-sl-accent">
            ${discovery.price_usdt.toFixed(2)} <span className="text-xs font-normal text-sl-text-muted">USDT</span>
          </p>
          <span className="mt-1 block text-[11px] text-sl-text-muted">Metered per successful execution</span>
        </div>

        <div className="rounded-[var(--sl-radius)] border border-sl-border bg-sl-surface p-4">
          <span className="text-xs text-sl-text-subtle">Active API Keys</span>
          <p className="mt-1 font-mono text-xl font-semibold text-sl-text">{keysCount}</p>
          <span className="mt-1 block text-[11px] text-sl-text-muted">
            {keysCount > 0 ? "Configured for simulation" : "None connected"}
          </span>
        </div>

        <div className="rounded-[var(--sl-radius)] border border-sl-border bg-sl-surface p-4">
          <span className="text-xs text-sl-text-subtle">Platform Mode</span>
          <p className="mt-1 font-mono text-sm font-semibold text-sl-text">{discovery.mode}</p>
          <span className="mt-1 block text-[11px] text-sl-text-muted">Real-time sandboxed risk gates</span>
        </div>
      </div>

      {/* Two Column Grid: Discovery Status & Onboarding Checklist */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Canonical Service Discovery */}
        <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-sl-border pb-3">
            <h3 className="font-medium text-sl-text">Canonical Capability Discovery</h3>
            <span className="rounded bg-sl-accent-soft px-2 py-0.5 font-mono text-[10px] text-sl-accent">
              Live API
            </span>
          </div>

          <div className="mt-3 space-y-3 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-sl-text-muted">Service Name:</span>
              <span className="font-mono text-sl-text">{discovery.service}</span>
            </div>
            <div className="flex justify-between py-1 border-t border-sl-border">
              <span className="text-sl-text-muted">Supported Strategy:</span>
              <span className="font-mono text-sl-text">{discovery.supported_strategies.join(", ")}</span>
            </div>
            <div className="flex flex-col gap-1 py-1 border-t border-sl-border">
              <span className="text-sl-text-muted">Supported Instruments:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {discovery.supported_instruments.map((inst) => (
                  <span key={inst} className="rounded border border-sl-border bg-sl-bg px-2 py-0.5 font-mono text-[11px] text-sl-text">
                    {inst}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-between py-1 border-t border-sl-border">
              <span className="text-sl-text-muted">Live Execution:</span>
              <span className="font-mono text-sl-down">DISABLED (Safety mandated)</span>
            </div>
          </div>
        </div>

        {/* Onboarding Checklist */}
        <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-5 shadow-sm">
          <h3 className="border-b border-sl-border pb-3 font-medium text-sl-text">Developer Setup Checklist</h3>
          <ul className="mt-3 space-y-2.5">
            {checklist.map((item, idx) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between rounded p-2 text-xs transition-colors hover:bg-sl-surface-hover"
                >
                  <div className="flex items-center gap-2.5">
                    {item.done ? (
                      <CheckCircle2 className="size-4 text-sl-accent shrink-0" />
                    ) : (
                      <Circle className="size-4 text-sl-text-subtle shrink-0" />
                    )}
                    <span className={item.done ? "text-sl-text-muted line-through" : "text-sl-text font-medium"}>
                      {idx + 1}. {item.label}
                    </span>
                  </div>
                  <ArrowRight className="size-3 text-sl-text-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
