"use client";
// Satelink Trading AI beta waitlist capture (Phase 7 amendment, #511). Posts
// to /api/beta-request, which validates and rate-limits the real client IP
// before forwarding server-to-server to apps/api (owns the beta_requests
// table and the founder/auto-reply emails). Distinct from ContactSalesForm —
// this is a structured waitlist intake (role, use case, capital band,
// broker), not a free-text sales enquiry.
import * as React from "react";
import { Field, Input, Textarea, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

type State = "idle" | "submitting" | "ok" | "error";

const CAPITAL_BANDS = ["Prefer not to say", "Paper trading only", "< $10k", "$10k–$50k", "$50k–$250k", "$250k–$1M", "> $1M"];

export function BetaRequestForm() {
  const [state, setState] = React.useState<State>("idle");
  const [errorMsg, setErrorMsg] = React.useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setErrorMsg("");
    const fd = new FormData(e.currentTarget);
    const payload = {
      email: String(fd.get("email") ?? ""),
      name: String(fd.get("name") ?? ""),
      role: String(fd.get("role") ?? ""),
      useCase: String(fd.get("useCase") ?? ""),
      capitalBand: String(fd.get("capitalBand") ?? ""),
      broker: String(fd.get("broker") ?? ""),
      website: String(fd.get("website") ?? ""),
    };
    try {
      const res = await fetch("/api/beta-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setState("error");
        setErrorMsg(res.status === 429 ? "Too many requests — please try again shortly." : "Something went wrong. Please try again.");
        return;
      }
      setState("ok");
    } catch {
      setState("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  if (state === "ok") {
    return (
      <div className="rounded-[var(--sl-radius-lg)] border border-sl-up/40 bg-sl-up/10 p-6">
        <p className="font-semibold text-sl-text">You&rsquo;re on the list.</p>
        <p className="mt-1 text-sm text-sl-text-muted">We&rsquo;ll follow up at the email you provided.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" htmlFor="beta-name"><Input id="beta-name" name="name" required maxLength={120} /></Field>
      <Field label="Work or personal email" htmlFor="beta-email"><Input id="beta-email" name="email" type="email" required maxLength={200} /></Field>
      <Field label="I am a…" htmlFor="beta-role">
        <Select id="beta-role" name="role" required defaultValue="">
          <option value="" disabled>Select…</option>
          <option value="human">Person</option>
          <option value="ai_agent">AI agent</option>
          <option value="machine">Automated system</option>
        </Select>
      </Field>
      <Field label="Capital band (optional)" htmlFor="beta-capital">
        <Select id="beta-capital" name="capitalBand" defaultValue="">
          <option value="">Prefer not to say</option>
          {CAPITAL_BANDS.filter((b) => b !== "Prefer not to say").map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </Select>
      </Field>
      <Field label="Broker (optional)" htmlFor="beta-broker"><Input id="beta-broker" name="broker" maxLength={80} placeholder="e.g. Binance, Upstox, Alpaca" /></Field>
      <div className="sm:col-span-2">
        <Field label="What would you use it for?" htmlFor="beta-use-case"><Textarea id="beta-use-case" name="useCase" required rows={4} maxLength={2000} /></Field>
      </div>
      {/* Honeypot — visually hidden, still submitted. */}
      <div className="invisible absolute h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor="beta-website">Website</label>
        <input id="beta-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state === "error" && <p className="sm:col-span-2 text-sm text-sl-down">{errorMsg}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" disabled={state === "submitting"}>
          {state === "submitting" ? "Sending…" : "Request beta access"}
        </Button>
      </div>
    </form>
  );
}
