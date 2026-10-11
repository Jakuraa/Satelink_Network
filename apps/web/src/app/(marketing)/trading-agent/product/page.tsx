import type { Metadata } from "next";
import { PRODUCT } from "@/lib/trading-agent/copy";
import { TaHeader } from "@/components/trading-agent/Parts";

export const metadata: Metadata = { title: "Product — Satelink Trading AI" };

export default function Page() {
  return (
    <>
      <TaHeader title={PRODUCT.title} />
      <div className="grid gap-8 sm:grid-cols-2">
        <section><h2 className="mb-2 font-semibold">It is</h2><ul className="grid list-disc gap-2 pl-5">{PRODUCT.is.map((t) => <li key={t}>{t}</li>)}</ul></section>
        <section><h2 className="mb-2 font-semibold">It is not</h2><ul className="grid list-disc gap-2 pl-5">{PRODUCT.isNot.map((t) => <li key={t}>{t}</li>)}</ul></section>
      </div>
    </>
  );
}
