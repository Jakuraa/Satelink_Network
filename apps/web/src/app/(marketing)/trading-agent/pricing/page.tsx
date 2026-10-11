import type { Metadata } from "next";
import { LEGAL_PLACEHOLDERS, PRICING } from "@/lib/trading-agent/copy";
import { LegalPlaceholder, TaHeader } from "@/components/trading-agent/Parts";

export const metadata: Metadata = { title: "Pricing — Satelink Trading AI" };

export default function Page() {
  return (
    <>
      <TaHeader title={PRICING.title} lede={PRICING.body} />
      <LegalPlaceholder {...LEGAL_PLACEHOLDERS[1]} />
    </>
  );
}
