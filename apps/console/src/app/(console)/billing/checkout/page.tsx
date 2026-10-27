import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ErrorNote, PageHeader } from "@/components/ui";
import { OnePageCheckout } from "@/components/payments/OnePageCheckout";
import { loadMerchant, loadMethods, loadTradingAiPlans } from "@/lib/payments";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Checkout — Satelink AI Assistance" };
export const dynamic = "force-dynamic";

interface CheckoutPageProps {
  searchParams: Promise<{
    plan?: string;
    method?: string;
    ref?: string;
    rail?: string;
  }>;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const session = await getSession();
  if (!session) {
    const params = await searchParams;
    const query = new URLSearchParams(params as Record<string, string>).toString();
    redirect(`/sign-in?next=/billing/checkout${query ? `?${query}` : ""}`);
  }

  const { plan, method, ref, rail } = await searchParams;
  const initialMethod = method || (rail === "payram" ? "payram_usdt" : undefined);

  const [plans, methods, merchant] = await Promise.all([
    loadTradingAiPlans(),
    loadMethods(),
    loadMerchant(),
  ]);

  if (!plans.ok || !methods.ok || !merchant.ok) {
    const isNotMounted = [plans, methods, merchant].some(
      (r) => !r.ok && r.status === 404
    );
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <PageHeader title="Unified Checkout" />
        {isNotMounted ? (
          <div className="mt-6 rounded-lg border border-sl-border bg-sl-surface p-6 text-sm text-sl-text-muted">
            Checkout service is currently being provisioned for this deployment.
          </div>
        ) : (
          <div className="mt-6">
            <ErrorNote what="checkout service details" />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-sl-border bg-sl-surface/50 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <PageHeader
            title="Satelink AI Assistance Checkout"
            lede="Unified customer-facing checkout with Financial OS as the single source of truth."
          />
        </div>
      </div>
      <OnePageCheckout
        plans={plans.data}
        methods={methods.data.methods}
        merchant={merchant.data.merchant}
        refundPolicy={merchant.data.refundPolicy}
        testMode={methods.data.testMode}
        initialPlanId={plan}
        initialMethod={initialMethod}
        initialRef={ref}
      />
    </>
  );
}
