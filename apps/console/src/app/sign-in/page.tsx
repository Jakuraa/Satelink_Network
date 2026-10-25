import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@satelink/web-ui/site/Wordmark";
import { getSession } from "@/lib/session";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in · Satelink Trading AI",
  description: "Run algorithmic trading simulations through a developer-first API built for trading applications and AI agents.",
};

const WEB = "https://satelink.network";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const { next, mode } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (await getSession()) redirect(safeNext);
  const signup = mode === "signup";

  return (
    <main className="flex min-h-screen flex-col bg-sl-bg px-4 text-[14px]">
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-12">
        <a href={WEB} className="self-center text-sl-text" aria-label="Satelink home">
          <Wordmark />
        </a>

        <div className="mt-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sl-border bg-sl-surface px-3 py-1 font-mono text-[11px] font-medium text-sl-accent">
            <span className="size-1.5 rounded-full bg-sl-accent" />
            Satelink Trading AI
          </span>
          <h1 className="mt-4 text-balance font-sl-display text-[2.25rem] font-normal leading-[1.1] tracking-[-0.015em] text-sl-text">
            Build. Simulate. Evaluate.
          </h1>
          <p className="mt-3 text-balance text-[14px] leading-relaxed text-sl-text-muted">
            Run algorithmic trading simulations through a developer-first API built for trading applications and AI agents.
            Inspect execution results, understand your costs, and integrate programmatic simulations into your workflow.
          </p>
        </div>

        <div className="mt-8 rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-5 shadow-sm">
          <SignInForm next={safeNext} signup={signup} />
        </div>

        <div className="mt-6 space-y-2 text-center text-[12px] text-sl-text-subtle">
          <p>
            By continuing, you agree to Satelink&apos;s{" "}
            <a className="underline underline-offset-2 hover:text-sl-text" href={`${WEB}/terms`}>
              Terms
            </a>{" "}
            and acknowledge the{" "}
            <a className="underline underline-offset-2 hover:text-sl-text" href={`${WEB}/privacy`}>
              Privacy policy
            </a>
            .
          </p>
          <p className="font-mono text-[11px] text-sl-text-subtle">
            SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS · Live broker execution remains disabled.
          </p>
        </div>
      </div>

      <footer className="mx-auto flex max-w-lg flex-col items-center gap-2 pb-8 text-center text-[12px] text-sl-text-muted sm:flex-row sm:justify-center">
        <span>Need programmatic access?</span>
        <div className="flex items-center gap-3">
          <a
            className="text-sl-accent underline underline-offset-2 hover:text-sl-accent-strong"
            href={`${WEB}/docs/api-reference`}
            target="_blank"
            rel="noopener"
          >
            Explore the API
          </a>
          <span className="text-sl-text-subtle">·</span>
          <a
            className="text-sl-text underline underline-offset-2 hover:text-sl-text"
            href="https://api.satelink.network/v1/trading/paper/simulate"
            target="_blank"
            rel="noopener"
          >
            Discovery endpoint (Free)
          </a>
        </div>
      </footer>
    </main>
  );
}
