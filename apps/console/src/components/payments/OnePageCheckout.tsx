"use client";
// Satelink Unified One-Page Customer Checkout
// Unified Fiat + Crypto Checkout with Financial OS as single source of truth.
// Directly answers the 5 customer questions:
// 1. What am I buying?
// 2. What do I pay now?
// 3. Is this recurring?
// 4. Which payment methods are actually available?
// 5. What happens after I pay?
// No infinite spinner; safe status recovery; truthful provider capability gating.
import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Info,
} from "lucide-react";
import { MerchantBlock } from "./MerchantBlock";
import {
  METHOD_LABEL,
  STATUS_LABEL,
  type Intent,
  type IntentStatus,
  type Merchant,
  type Method,
  type PlansPayload,
  type Quote,
  type RefundPolicy,
  type TradingAiPlan,
} from "../../lib/payments-shared";

interface OnePageCheckoutProps {
  plans: PlansPayload;
  methods: Method[];
  merchant: Merchant;
  refundPolicy: RefundPolicy;
  testMode: boolean;
  initialPlanId?: string;
  initialMethod?: string;
  initialRef?: string;
}

const POLL_INTERVAL_MS = 6_000;
const MAX_AUTO_POLLS = 20; // 2 minutes before stopping auto-poll

export function OnePageCheckout({
  plans,
  methods,
  merchant,
  refundPolicy,
  testMode,
  initialPlanId,
  initialMethod,
  initialRef,
}: OnePageCheckoutProps) {
  const paidPlans = useMemo(() => plans.plans.filter((p) => p.price !== null), [plans.plans]);

  const isInvalidInitialPlan = Boolean(
    initialPlanId && !paidPlans.some((p) => p.id === initialPlanId)
  );

  const [invalidPlanError, setInvalidPlanError] = useState<string | null>(
    isInvalidInitialPlan
      ? `Invalid plan ID "${initialPlanId}". Please select a valid plan from the catalog below.`
      : null
  );

  // Selections
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    initialPlanId && paidPlans.some((p) => p.id === initialPlanId)
      ? initialPlanId
      : (initialPlanId ? "" : (paidPlans[0]?.id ?? "trading_ai_pro"))
  );
  const [selectedMethod, setSelectedMethod] = useState<string>(
    initialMethod && methods.some((m) => m.id === initialMethod)
      ? initialMethod
      : methods.find((m) => m.id === "payram_usdt")?.id ?? methods[0]?.id ?? "payram_usdt"
  );

  // States
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [activeIntent, setActiveIntent] = useState<Intent | null>(null);
  const [intentStatus, setIntentStatus] = useState<IntentStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Status polling & recovery
  const [pollCount, setPollCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoPollActive, setAutoPollActive] = useState(Boolean(initialRef));

  // Transacty UTR submission
  const [utr, setUtr] = useState("");
  const [utrSubmitting, setUtrSubmitting] = useState(false);
  const [utrResult, setUtrResult] = useState<string | null>(null);
  const [utrError, setUtrError] = useState<string | null>(null);

  // On-chain manual tx submission
  const [onchainTx, setOnchainTx] = useState("");
  const [onchainSubmitting, setOnchainSubmitting] = useState(false);
  const [onchainError, setOnchainError] = useState<string | null>(null);

  // Copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const selectedPlan = useMemo(
    () => plans.plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans.plans, selectedPlanId]
  );

  const policy = quote?.refundPolicy ?? refundPolicy;
  const canComplete = policy.completionAllowed;

  // 1. Fetch quote when plan or method changes
  useEffect(() => {
    if (activeIntent || initialRef) return; // already in active payment flow
    if (!selectedPlanId) {
      setQuote(null);
      setQuoteLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchQuote() {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const res = await fetch("/api/console/payments/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: selectedPlanId, method: selectedMethod }),
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (res.ok && json.ok && json.data) {
            setQuote(json.data);
          } else {
            setQuoteError(json.message || json.error || "Price could not be calculated.");
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setQuoteError(err instanceof Error ? err.message : "Network error loading quote.");
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }
    fetchQuote();
    return () => {
      cancelled = true;
    };
  }, [selectedPlanId, selectedMethod, activeIntent, initialRef]);

  // 2. Load and refresh intent status
  const checkStatus = useCallback(async (ref: string, triggerRecovery = false) => {
    try {
      setIsRefreshing(true);
      const url = triggerRecovery
        ? `/api/console/payments/checkout/intents/${encodeURIComponent(ref)}/refresh`
        : `/api/console/payments/checkout/intents/${encodeURIComponent(ref)}`;
      const res = await fetch(url, {
        method: triggerRecovery ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok && json.data) {
        setIntentStatus(json.data);
        if (json.data.status === "succeeded" || json.data.status === "overpaid") {
          setAutoPollActive(false);
        }
      }
    } catch {
      // transient poll failure — retry on next tick
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Initial ref recovery
  useEffect(() => {
    if (initialRef && !intentStatus) {
      checkStatus(initialRef, true);
    }
  }, [initialRef, intentStatus, checkStatus]);

  // Auto-polling when active and pending
  useEffect(() => {
    const targetRef = intentStatus?.canonicalRef || activeIntent?.canonicalRef || initialRef;
    if (!autoPollActive || !targetRef) return;
    if (intentStatus?.status === "succeeded" || intentStatus?.status === "overpaid" || intentStatus?.status === "failed") {
      return;
    }

    const timer = setInterval(() => {
      setPollCount((prev) => {
        if (prev >= MAX_AUTO_POLLS) {
          setAutoPollActive(false);
          return prev;
        }
        checkStatus(targetRef, false);
        return prev + 1;
      });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [autoPollActive, activeIntent, intentStatus, initialRef, checkStatus]);

  // 3. Start Checkout Intent
  async function handleStartCheckout() {
    if (!canComplete) return;
    if (!selectedPlanId) {
      setActionError("Please select a valid plan before proceeding to checkout.");
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch("/api/console/payments/checkout/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlanId, method: selectedMethod }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.message || json.error || "Failed to create checkout session");
      }
      const data: Intent = json.data;
      setActiveIntent(data);

      // If hosted checkout (e.g. PayRam), redirect immediately
      if (data.checkoutUrl && selectedMethod === "payram_usdt") {
        window.location.assign(data.checkoutUrl);
        return;
      }

      // If on-chain or Transacty QR, activate status polling
      setAutoPollActive(true);
      checkStatus(data.canonicalRef, false);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to initiate checkout");
    } finally {
      setIsSubmitting(false);
    }
  }

  // 4. Submit Transacty Bank UTR
  async function handleSubmitUtr() {
    const ref = intentStatus?.canonicalRef || activeIntent?.canonicalRef;
    if (!ref || !utr.trim()) return;
    setUtrSubmitting(true);
    setUtrError(null);
    setUtrResult(null);
    try {
      const res = await fetch(`/api/console/payments/checkout/intents/${encodeURIComponent(ref)}/transacty-utr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr: utr.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.message || json.error || "Failed to submit bank UTR");
      }
      setUtrResult("UTR submitted successfully. Checking settlement with bank & gateway...");
      checkStatus(ref, true);
    } catch (err: unknown) {
      setUtrError(err instanceof Error ? err.message : "UTR submission error");
    } finally {
      setUtrSubmitting(false);
    }
  }

  // 5. Submit On-Chain Tx Hash
  async function handleSubmitOnchainTx() {
    const ref = intentStatus?.canonicalRef || activeIntent?.canonicalRef;
    if (!ref || !onchainTx.trim()) return;
    setOnchainSubmitting(true);
    setOnchainError(null);
    try {
      const res = await fetch(`/api/console/payments/checkout/intents/${encodeURIComponent(ref)}/onchain-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: onchainTx.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.message || json.error || "Could not verify transaction on-chain");
      }
      checkStatus(ref, false);
    } catch (err: unknown) {
      setOnchainError(err instanceof Error ? err.message : "Verification error");
    } finally {
      setOnchainSubmitting(false);
    }
  }

  // Determine Current View
  const isSettled = intentStatus?.status === "succeeded" || intentStatus?.status === "overpaid";
  const isPending =
    intentStatus?.status === "pending" ||
    intentStatus?.status === "partially_paid" ||
    (activeIntent && !isSettled);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Test Mode Banner */}
      {testMode && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-sl-warn/40 bg-sl-warn/10 p-3 text-xs text-sl-text">
          <Info className="size-4 shrink-0 text-sl-warn" />
          <span>
            <strong>Test Mode / Sandbox:</strong> Real money is not charged. Live billing will activate
            once merchant and legal safety gates are approved.
          </span>
        </div>
      )}

      {/* Main 2-Column Responsive Layout */}
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left Column: Interactive Selection / Status */}
        <div className="space-y-6">
          {/* A. If Payment is Settled: Show Success Receipt Card */}
          {isSettled && intentStatus && (
            <div className="rounded-xl border border-sl-good/40 bg-sl-good/10 p-6 shadow-sm">
              <div className="flex items-center gap-3 text-sl-good">
                <CheckCircle2 className="size-7 shrink-0" />
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-sl-text">
                    {STATUS_LABEL[intentStatus.status] ?? "Payment Verified"}
                  </h2>
                  <p className="text-sm text-sl-text-muted">
                    Reference: <span className="font-mono text-sl-text">{intentStatus.canonicalRef}</span>
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-sl-border bg-sl-surface p-4 text-sm">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                  <dt className="text-sl-text-muted">Plan Activated</dt>
                  <dd className="font-medium text-sl-text">{intentStatus.entitlement.planId}</dd>
                  <dt className="text-sl-text-muted">Active Until</dt>
                  <dd className="font-medium text-sl-text">
                    {intentStatus.entitlement.periodEnd
                      ? new Date(intentStatus.entitlement.periodEnd).toLocaleDateString()
                      : "—"}
                  </dd>
                  <dt className="text-sl-text-muted">Amount Settled</dt>
                  <dd className="font-mono font-medium text-sl-text">
                    {intentStatus.amount.display} {intentStatus.amount.currency}
                  </dd>
                </dl>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/billing/receipts/${intentStatus.canonicalRef}`}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-sl-accent px-5 text-sm font-medium text-sl-accent-ink hover:bg-sl-accent-strong"
                >
                  View Canonical Receipt
                </Link>
                <Link
                  href="/paper-trading"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-sl-border bg-sl-surface px-4 text-sm font-medium text-sl-text hover:bg-sl-surface-hover"
                >
                  Open Paper Studio
                </Link>
              </div>
            </div>
          )}

          {/* B. If Payment is Pending: Show Verification & Status Recovery Card */}
          {isPending && !isSettled && (
            <div className="rounded-xl border border-sl-border bg-sl-surface p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="size-6 text-sl-warn animate-pulse" />
                  <div>
                    <h2 className="text-lg font-semibold text-sl-text">Awaiting Payment Confirmation</h2>
                    <p className="text-xs text-sl-text-muted">
                      Order Reference:{" "}
                      <span className="font-mono text-sl-text">
                        {intentStatus?.canonicalRef || activeIntent?.canonicalRef}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    checkStatus(
                      (intentStatus?.canonicalRef || activeIntent?.canonicalRef)!,
                      true
                    )
                  }
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sl-border px-3 py-1.5 text-xs text-sl-text-muted hover:text-sl-text hover:bg-sl-surface-hover disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                  Check Status Now
                </button>
              </div>

              {/* Status explanation */}
              <div className="mt-4 rounded-lg bg-sl-bg p-4 text-xs text-sl-text-muted">
                <p>
                  {autoPollActive
                    ? `We are actively monitoring the blockchain and payment gateway for confirmation (attempt ${pollCount} of ${MAX_AUTO_POLLS}). This page auto-refreshes every 6 seconds.`
                    : "Automatic polling paused. Click 'Check Status Now' to query the server and provider."}
                </p>
                {intentStatus?.status === "partially_paid" && (
                  <p className="mt-2 text-sl-warn font-medium">
                    {STATUS_LABEL.partially_paid}
                  </p>
                )}
              </div>

              {/* PayRam hosted checkout redirect button if session exists */}
              {activeIntent?.checkoutUrl && selectedMethod === "payram_usdt" && (
                <div className="mt-4 flex flex-col gap-2">
                  <a
                    href={activeIntent.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sl-accent px-4 text-sm font-medium text-sl-accent-ink hover:bg-sl-accent-strong"
                  >
                    Open PayRam Hosted Payment Page <ExternalLink className="size-4" />
                  </a>
                  <p className="text-center text-[11px] text-sl-text-subtle">
                    Already paid in PayRam? Click &quot;Check Status Now&quot; above to verify.
                  </p>
                </div>
              )}

              {/* Transacty UPI QR + UTR collection */}
              {selectedMethod === "transacty_upi" && activeIntent?.checkoutUrl && (
                <div className="mt-6 border-t border-sl-border pt-4">
                  <h3 className="text-sm font-medium text-sl-text">Scan UPI QR Code to Pay</h3>
                  <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row">
                    <div className="rounded-lg bg-white p-3">
                      <QRCodeSVG value={activeIntent.checkoutUrl} size={150} />
                    </div>
                    <div className="space-y-2 text-xs">
                      {activeIntent.upiId && (
                        <div>
                          <span className="text-sl-text-muted">UPI VPA: </span>
                          <span className="font-mono text-sl-text font-bold">{activeIntent.upiId}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(activeIntent.upiId!, "vpa")}
                            className="ml-2 text-sl-accent underline"
                          >
                            {copiedKey === "vpa" ? "Copied" : "Copy"}
                          </button>
                        </div>
                      )}
                      <p className="text-sl-text-muted leading-relaxed">
                        1. Open any UPI App (GPay, PhonePe, Paytm, BHIM).
                        <br />
                        2. Scan QR or pay to the VPA above.
                        <br />
                        3. Enter the 12-digit Bank UTR below to confirm.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label htmlFor="utr-input" className="block text-xs font-medium text-sl-text">
                      Bank Reference / UTR Number (12 digits)
                    </label>
                    <div className="mt-1 flex gap-2">
                      <input
                        id="utr-input"
                        type="text"
                        value={utr}
                        onChange={(e) => setUtr(e.target.value)}
                        placeholder="e.g. 423456789012"
                        className="h-10 flex-1 rounded-lg border border-sl-border bg-sl-bg px-3 text-sm font-mono text-sl-text focus:border-sl-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSubmitUtr}
                        disabled={utrSubmitting || utr.trim().length < 6}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-sl-accent px-4 text-sm font-medium text-sl-accent-ink hover:bg-sl-accent-strong disabled:opacity-50"
                      >
                        {utrSubmitting ? "Submitting..." : "Confirm UTR"}
                      </button>
                    </div>
                    {utrResult && <p className="mt-2 text-xs text-sl-good">{utrResult}</p>}
                    {utrError && <p className="mt-2 text-xs text-sl-down">{utrError}</p>}
                  </div>
                </div>
              )}

              {/* On-chain manual transfer */}
              {activeIntent?.invoice && (
                <div className="mt-6 border-t border-sl-border pt-4">
                  <h3 className="text-sm font-medium text-sl-text">Send On-Chain Payment</h3>
                  <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
                    <div className="rounded-lg bg-white p-3">
                      <QRCodeSVG value={activeIntent.invoice.uri} size={140} />
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                      <dt className="text-sl-text-muted">To:</dt>
                      <dd className="font-mono text-sl-text break-all">
                        {activeIntent.invoice.payTo}
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeIntent.invoice!.payTo, "payTo")}
                          className="ml-2 text-sl-accent underline"
                        >
                          {copiedKey === "payTo" ? "Copied" : "Copy"}
                        </button>
                      </dd>
                      <dt className="text-sl-text-muted">Amount:</dt>
                      <dd className="font-mono text-sl-text font-bold">
                        {activeIntent.invoice.amountDisplay} {activeIntent.invoice.currency}
                      </dd>
                      <dt className="text-sl-text-muted">Network:</dt>
                      <dd className="text-sl-text capitalize">{activeIntent.invoice.network}</dd>
                    </dl>
                  </div>

                  <div className="mt-4">
                    <label htmlFor="tx-input" className="block text-xs font-medium text-sl-text">
                      Transaction Hash (optional — confirmed automatically by listener)
                    </label>
                    <div className="mt-1 flex gap-2">
                      <input
                        id="tx-input"
                        type="text"
                        value={onchainTx}
                        onChange={(e) => setOnchainTx(e.target.value)}
                        placeholder="0x..."
                        className="h-10 flex-1 rounded-lg border border-sl-border bg-sl-bg px-3 text-sm font-mono text-sl-text focus:border-sl-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSubmitOnchainTx}
                        disabled={onchainSubmitting || !/^0x[0-9a-fA-F]{64}$/.test(onchainTx.trim())}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-sl-accent px-4 text-sm font-medium text-sl-accent-ink hover:bg-sl-accent-strong disabled:opacity-50"
                      >
                        {onchainSubmitting ? "Checking..." : "Verify"}
                      </button>
                    </div>
                    {onchainError && <p className="mt-2 text-xs text-sl-down">{onchainError}</p>}
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setActiveIntent(null);
                    setIntentStatus(null);
                    setAutoPollActive(false);
                  }}
                  className="text-xs text-sl-text-muted hover:text-sl-text underline"
                >
                  Cancel or Choose Another Method
                </button>
              </div>
            </div>
          )}

          {/* C. Primary Interactive Selection (When not already pending/settled) */}
          {!isPending && !isSettled && (
            <div className="rounded-xl border border-sl-border bg-sl-surface p-6 shadow-sm space-y-6">
              {/* Step 1: Select Plan */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-sl-accent text-xs font-bold text-sl-accent-ink">
                    1
                  </span>
                  <h2 className="text-base font-semibold text-sl-text">Select AI Assistance Plan</h2>
                </div>
                {invalidPlanError && (
                  <div
                    role="alert"
                    className="mt-3 flex items-center gap-2 rounded-lg border border-sl-down/40 bg-sl-down/10 p-3 text-xs text-sl-down"
                  >
                    <AlertCircle className="size-4 shrink-0 text-sl-down" />
                    <span>{invalidPlanError}</span>
                  </div>
                )}
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {paidPlans.map((p: TradingAiPlan) => {
                    const isSelected = selectedPlanId === p.id;
                    const usdPrice = p.price?.USD?.display ?? p.price?.USDT?.display;
                    const introUsd = p.introPrice?.USD?.display;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPlanId(p.id);
                          setInvalidPlanError(null);
                        }}
                        className={`flex flex-col items-start rounded-lg border p-4 text-left transition-all ${
                          isSelected
                            ? "border-sl-accent bg-sl-accent/10 ring-1 ring-sl-accent"
                            : "border-sl-border bg-sl-bg hover:border-sl-border-strong"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="font-semibold text-sl-text">{p.name}</span>
                          {introUsd && (
                            <span className="rounded bg-sl-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-sl-accent uppercase">
                              Launch Offer
                            </span>
                          )}
                        </div>
                        <div className="mt-2 font-mono text-base font-bold text-sl-text">
                          {introUsd ? (
                            <>
                              <span>${introUsd}</span>
                              <span className="ml-1 text-xs font-normal text-sl-text-muted line-through">
                                ${usdPrice}
                              </span>
                            </>
                          ) : (
                            <span>${usdPrice}</span>
                          )}
                          <span className="text-xs font-normal text-sl-text-subtle">/mo</span>
                        </div>
                        <ul className="mt-3 space-y-1 text-[11px] text-sl-text-muted">
                          <li>• {p.limits.agentRunsPerDay} agent runs/day</li>
                          <li>• {p.limits.deepReasoningPerDay} deep reasoning queries/day</li>
                          <li>• {p.limits.backtestsPerDay} backtests/day</li>
                        </ul>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Select Available Payment Method */}
              <div className="border-t border-sl-border pt-6">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-sl-accent text-xs font-bold text-sl-accent-ink">
                    2
                  </span>
                  <h2 className="text-base font-semibold text-sl-text">Choose Payment Rail</h2>
                </div>

                <div className="mt-4 space-y-2.5">
                  {methods.map((m) => {
                    const isSelected = selectedMethod === m.id;
                    const info = METHOD_LABEL[m.id] || { title: m.id, detail: m.currency };
                    const isCrypto = m.id.includes("usdt") || m.id.includes("usdc") || m.id.includes("payram");
                    return (
                      <label
                        key={m.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-all ${
                          isSelected
                            ? "border-sl-accent bg-sl-accent/10 ring-1 ring-sl-accent"
                            : "border-sl-border bg-sl-bg hover:border-sl-border-strong"
                        }`}
                      >
                        <input
                          type="radio"
                          name="checkoutMethod"
                          value={m.id}
                          checked={isSelected}
                          onChange={() => setSelectedMethod(m.id)}
                          className="mt-1 size-4 text-sl-accent focus:ring-sl-accent"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-sl-text">{info.title}</span>
                            <span className="rounded bg-sl-surface px-2 py-0.5 text-[10px] font-mono text-sl-text-subtle">
                              {isCrypto ? "Prepaid · Non-Custodial" : "Recurring"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-sl-text-muted">{info.detail}</p>
                        </div>
                      </label>
                    );
                  })}

                  {methods.length === 0 && (
                    <div className="rounded-lg border border-sl-warn/40 bg-sl-warn/10 p-3 text-xs text-sl-text">
                      No payment methods are currently active for this deployment.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button & Errors */}
              <div className="border-t border-sl-border pt-6">
                {actionError && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-sl-down/40 bg-sl-down/10 p-3 text-xs text-sl-down">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{actionError}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleStartCheckout}
                  disabled={isSubmitting || quoteLoading || !canComplete || methods.length === 0 || !selectedPlanId}
                  className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-lg bg-sl-accent text-base font-semibold text-sl-accent-ink hover:bg-sl-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sl-accent/50 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isSubmitting
                    ? "Initiating Secure Checkout..."
                    : quote
                    ? `Pay ${quote.amount.display} ${quote.amount.currency} Now`
                    : !selectedPlanId
                    ? "Select a Plan to Continue"
                    : "Proceed to Checkout"}
                  <ArrowRight className="size-4" />
                </button>

                {!canComplete && (
                  <p className="mt-2 text-center text-xs text-sl-warn">
                    Checkout completion is disabled until the merchant refund policy is published.
                  </p>
                )}
                <p className="mt-2 text-center text-[11px] text-sl-text-subtle">
                  Self-hosted and non-custodial. No recurring wallet debit without explicit consent.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Order Summary & Authoritative Answers to Customer Questions */}
        <aside className="space-y-6">
          <div className="rounded-xl border border-sl-border bg-sl-surface p-6 shadow-sm space-y-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-sl-accent">
              Order Summary & Terms
            </h2>

            {/* 1. What am I buying? */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-sl-text-subtle uppercase">
                1. What am I buying?
              </span>
              <p className="text-sm font-medium text-sl-text">
                Satelink AI Assistance — {selectedPlan ? `${selectedPlan.name} Plan` : "No plan selected"}
              </p>
              <p className="text-xs leading-relaxed text-sl-text-muted">
                30-day access to metered AI agent orchestration, deterministic paper-trading
                simulation engines, and quantitative analytics. Non-custodial analytics only; not
                financial advice.
              </p>
            </div>

            {/* 2. What do I pay now? */}
            <div className="space-y-1 border-t border-sl-border pt-4">
              <span className="text-xs font-semibold text-sl-text-subtle uppercase">
                2. What do I pay now?
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-sl-text-muted">Payable Today:</span>
                <span className="font-mono text-xl font-bold tabular-nums text-sl-text">
                  {quote ? `${quote.amount.display} ${quote.amount.currency}` : selectedPlanId ? "Calculating..." : "—"}
                </span>
              </div>
              {quoteError && (
                <p className="text-[11px] text-sl-down">{quoteError}</p>
              )}
              {quote?.introApplied && (
                <p className="text-[11px] text-sl-good">
                  Introductory launch discount applied server-side.
                </p>
              )}
            </div>

            {/* 3. Is this recurring? */}
            <div className="space-y-1 border-t border-sl-border pt-4">
              <span className="text-xs font-semibold text-sl-text-subtle uppercase">
                3. Is this recurring?
              </span>
              <p className="text-xs leading-relaxed text-sl-text-muted">
                <strong>Crypto Rails:</strong> Prepaid for 30 days. <em>Never automatic wallet debits.</em>{" "}
                We issue scheduled renewal reminders at 7 days, 3 days, and on expiry, with a 3-day
                grace period. Each renewal is an explicit payment authorized by you.
              </p>
              <p className="text-xs leading-relaxed text-sl-text-muted mt-1">
                <strong>Fiat Rails:</strong> Standard recurring subscription once merchant approval and
                regional gateway are live.
              </p>
            </div>

            {/* 4. Which payment methods are actually available? */}
            <div className="space-y-1 border-t border-sl-border pt-4">
              <span className="text-xs font-semibold text-sl-text-subtle uppercase">
                4. Which payment methods are available?
              </span>
              <p className="text-xs text-sl-text-muted">
                Only methods passing server-side capability and regulatory approval checks are shown.
                PayRam Crypto (USDT) operates non-custodially. Unapproved rails remain disabled.
              </p>
            </div>

            {/* 5. What happens after I pay? */}
            <div className="space-y-1 border-t border-sl-border pt-4">
              <span className="text-xs font-semibold text-sl-text-subtle uppercase">
                5. What happens after I pay?
              </span>
              <ul className="space-y-1 text-xs text-sl-text-muted">
                <li>• Payment reconciles into Financial OS single source of truth.</li>
                <li>• Capacity entitlement immediately unlocks on your account.</li>
                <li>• Authoritative immutable receipt generated with full merchant details.</li>
              </ul>
            </div>

            {/* Merchant Block & Refund Notice */}
            <MerchantBlock merchant={merchant} policy={policy} blocking={!canComplete} />
          </div>
        </aside>
      </div>
    </div>
  );
}
