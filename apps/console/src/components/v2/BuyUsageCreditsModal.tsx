"use client";

import { useState } from "react";
import { X, Coins, Zap, ArrowRight, Info, ShieldCheck } from "lucide-react";

interface BuyUsageCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalanceUu?: number;
}

export function BuyUsageCreditsModal({
  isOpen,
  onClose,
  currentBalanceUu: _currentBalanceUu = 0,
}: BuyUsageCreditsModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>("pack_250");
  const [isCustom, setIsCustom] = useState(false);
  const [customAmountInr, setCustomAmountInr] = useState<number>(5000);
  const [rail, setRail] = useState<"transacty" | "payram">("transacty");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Preset packs
  const presets = [
    {
      id: "pack_100",
      label: "$100 Pack",
      inr: 8400,
      usd: 100,
      baseUu: 100000,
      bonusPct: 0,
      bonusUu: 0,
      totalUu: 100000,
      badge: "Standard",
    },
    {
      id: "pack_250",
      label: "$250 Pack",
      inr: 21000,
      usd: 250,
      baseUu: 250000,
      bonusPct: 0,
      bonusUu: 0,
      totalUu: 250000,
      badge: "Popular",
      popular: true,
    },
    {
      id: "pack_1000",
      label: "$1,000 Pack",
      inr: 84000,
      usd: 1000,
      baseUu: 1000000,
      bonusPct: 0,
      bonusUu: 0,
      totalUu: 1000000,
      badge: "Enterprise",
    },
  ];

  // Custom amount calculations
  const calculateCustomUu = (amount: number) => {
    // Standard conversion: 1 USD = 1,000 UU (1 UU = $0.001); ₹84 = $1 USD.
    const base = Math.round((amount / 84) * 1000);
    return {
      baseUu: base,
      bonusPct: 0,
      bonusUu: 0,
      totalUu: base,
    };
  };

  const activePack = presets.find((p) => p.id === selectedPreset);
  const activeAmountInr = isCustom ? customAmountInr : (activePack?.inr ?? 21000);
  const activeUuData = isCustom
    ? calculateCustomUu(customAmountInr)
    : {
        baseUu: activePack?.baseUu ?? 250000,
        bonusPct: activePack?.bonusPct ?? 0,
        bonusUu: activePack?.bonusUu ?? 0,
        totalUu: activePack?.totalUu ?? 250000,
      };

  const isCustomValid = customAmountInr >= 500 && customAmountInr <= 250000;
  const gstInr = Math.round(activeAmountInr * 0.18);
  const totalPayableInr = activeAmountInr + gstInr;

  const handleCheckout = async () => {
    if (isCustom && !isCustomValid) {
      setError("Custom amount must be between ₹500 and ₹2,50,000.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (rail === "payram") {
        window.location.href = `/billing/checkout?plan=${encodeURIComponent(selectedPreset)}&method=payram_usdt`;
        return;
      }
      if (rail === "transacty") {
        window.location.href = `/billing/checkout?plan=${encodeURIComponent(selectedPreset)}&method=transacty_upi`;
        return;
      }

      const payload = isCustom
        ? { customAmountInr, paymentRail: rail, type: "custom_pack" }
        : { itemId: selectedPreset, paymentRail: rail, type: "preset_pack" };

      const res = await fetch("/api/console/me/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          returnUrl: `${window.location.origin}/usage?credits_purchased=1`,
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.ok && data.data?.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
      } else {
        setError(data?.message || data?.error || "Checkout integration is switching to live gateway. USDT and test rails active.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to initiate payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="buy-credits-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-2xl rounded-xl border border-sl-border bg-sl-surface p-6 shadow-2xl sm:p-8">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close credit purchase modal"
          className="absolute top-5 right-5 rounded-lg p-1.5 text-sl-text-subtle transition-colors hover:bg-sl-surface-hover hover:text-sl-text"
        >
          <X className="size-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sl-accent">
          <Coins className="size-4" />
          <span>Pay-As-You-Go Capacity</span>
        </div>
        <h2 id="buy-credits-modal-title" className="mt-1 font-sl-display text-2xl font-normal text-sl-text">
          Buy Additional Usage Credits
        </h2>
        <p className="mt-1 text-sm text-sl-text-muted">
          Prepaid Usage Units (UU) that never expire and roll over indefinitely. Automatically debited only when your weekly subscription allowance is exhausted.
        </p>

        {/* Preset Packages */}
        <div className="mt-6">
          <label className="block text-xs font-medium text-sl-text-muted">Select Credit Package</label>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {presets.map((p) => {
              const isSelected = !isCustom && selectedPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setIsCustom(false);
                    setSelectedPreset(p.id);
                  }}
                  className={`relative flex flex-col items-start rounded-lg border p-4 text-left transition-all ${
                    isSelected
                      ? "border-sl-accent bg-sl-accent/10 ring-1 ring-sl-accent"
                      : "border-sl-border bg-sl-bg hover:border-sl-border-strong"
                  }`}
                >
                  {p.popular && (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-sl-accent px-2 py-0.5 text-[10px] font-bold text-sl-accent-ink uppercase tracking-wider">
                      Popular
                    </span>
                  )}
                  <div className="flex w-full items-center justify-between">
                    <span className="font-semibold text-sl-text">{p.label}</span>
                    <span className="text-[11px] font-bold text-sl-accent">{p.badge}</span>
                  </div>
                  <div className="mt-2 font-mono text-lg font-bold text-sl-text">
                    ₹{p.inr.toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs text-sl-text-muted">
                    <span className="font-semibold text-sl-text">{p.totalUu.toLocaleString()}</span> UU
                  </div>
                  {p.bonusUu > 0 && (
                    <div className="mt-1 text-[11px] text-sl-accent">
                      +{p.bonusUu.toLocaleString()} bonus UU
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Amount Option */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setIsCustom(true)}
            className={`w-full rounded-lg border p-3.5 text-left transition-all ${
              isCustom
                ? "border-sl-accent bg-sl-accent/10 ring-1 ring-sl-accent"
                : "border-sl-border bg-sl-bg hover:border-sl-border-strong"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sl-text">Custom Amount</span>
              <span className="text-[11px] text-sl-text-subtle">Min ₹500 · Max ₹2,50,000</span>
            </div>
            {isCustom && (
              <div className="mt-3">
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm font-semibold text-sl-text-muted">₹</span>
                  <input
                    type="number"
                    min={500}
                    max={250000}
                    step={100}
                    value={customAmountInr || ""}
                    onChange={(e) => setCustomAmountInr(Number(e.target.value))}
                    className="w-full rounded-md border border-sl-border bg-sl-surface py-2 pr-3 pl-8 font-mono text-sm text-sl-text focus:border-sl-accent focus:outline-none"
                    placeholder="Enter amount in INR"
                  />
                </div>
                {!isCustomValid && (
                  <p className="mt-1 text-xs text-sl-down">
                    Amount must be between ₹500 and ₹2,50,000
                  </p>
                )}
                {isCustomValid && (
                  <p className="mt-1.5 text-xs text-sl-text-muted">
                    Yields <span className="font-mono font-semibold text-sl-text">{activeUuData.totalUu.toLocaleString()} UU</span>
                    {activeUuData.bonusPct > 0 && (
                      <span className="ml-1 text-sl-accent font-medium">
                        (includes +{activeUuData.bonusPct}% bonus: {activeUuData.bonusUu.toLocaleString()} UU)
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
          </button>
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

        {/* Consumption & Rollover Policy Note */}
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-sl-border/60 bg-sl-bg/60 p-3 text-xs text-sl-text-muted">
          <Info className="size-4 shrink-0 text-sl-accent mt-0.5" />
          <div>
            <span className="font-semibold text-sl-text">Usage Credit Rules:</span>
            <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[11px]">
              <li>Never expire — rollover automatically across billing cycles.</li>
              <li>Only consumed when your weekly subscription allowance reaches 0.</li>
              <li>Valid for all model tiers (Standard, Reasoning, High-throughput) and tool sandbox execution.</li>
            </ul>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="mt-4 rounded-lg border border-sl-border/60 bg-sl-bg/50 p-3 text-xs">
          <div className="flex justify-between text-sl-text-muted">
            <span>Credit Pack Subtotal</span>
            <span className="font-mono text-sl-text">₹{activeAmountInr.toLocaleString()}</span>
          </div>
          <div className="mt-1 flex justify-between text-sl-text-muted">
            <span>GST (18% statutory)</span>
            <span className="font-mono text-sl-text">₹{gstInr.toLocaleString()}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-sl-border/60 pt-2 font-semibold text-sl-text">
            <span>Total Payable Today</span>
            <span className="font-mono text-base text-sl-accent">₹{totalPayableInr.toLocaleString()}</span>
          </div>
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
            disabled={isSubmitting || (isCustom && !isCustomValid)}
            onClick={handleCheckout}
            className="inline-flex items-center gap-2 rounded-lg bg-sl-accent px-5 py-2.5 text-xs font-semibold text-sl-accent-ink transition-colors hover:bg-sl-accent-strong disabled:opacity-50"
          >
            {isSubmitting ? "Initiating checkout…" : `Buy ${activeUuData.totalUu.toLocaleString()} UU · ₹${totalPayableInr.toLocaleString()}`}
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
