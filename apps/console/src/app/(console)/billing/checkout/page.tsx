import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ErrorNote, PageHeader } from "@/components/ui";
import { CheckoutFlow } from "@/components/payments/CheckoutFlow";
import { loadMerchant, loadMethods, loadTradingAiPlans } from "@/lib/payments";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Checkout — Trading AI" };
export const dynamic = "force-dynamic";

// Trading AI checkout (Wave 1.8). Served only when the API has PAYMENTS_V1 on: with it off,
// /v1/payments/* is not mounted and this page says so instead of showing a fake flow.
export default async function CheckoutPage() {
  if (!(await getSession())) redirect("/sign-in?next=/billing/checkout");
  const [plans, methods, merchant] = await Promise.all([loadTradingAiPlans(), loadMethods(), loadMerchant()]);
  if (!plans.ok || !methods.ok || !merchant.ok) {
    const off = [plans, methods, merchant].some((r) => !r.ok && r.status === 404);
    return (
      <>
        <PageHeader title="Checkout" />
        {off ? (
          <p className="text-sl-text-muted">Trading AI checkout isn&apos;t switched on for this deployment yet.</p>
        ) : (
          <ErrorNote what="checkout details" />
        )}
      </>
    );
  }
  return (
    <>
      <PageHeader title="Trading AI checkout" lede="Choose a plan, pick how to pay, and get a receipt from Jakuraa Commercial Private Limited." />
      <CheckoutFlow plans={plans.data} methods={methods.data.methods} merchant={merchant.data.merchant} refundPolicy={merchant.data.refundPolicy} testMode={methods.data.testMode} />
    </>
  );
}
