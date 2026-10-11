import type { Metadata } from "next";
import Link from "next/link";
import { HOME } from "@/lib/trading-agent/copy";
import { TaCards, TaHeader } from "@/components/trading-agent/Parts";

export const metadata: Metadata = { title: "Satelink Trading AI — Satelink" };

export default function Page() {
  return (
    <>
      <TaHeader eyebrow={HOME.eyebrow} title={HOME.title} lede={HOME.lede} />
      <TaCards items={HOME.points} />
      <p className="mt-8"><Link className="text-sl-accent underline" href="/trading-agent/how-it-works">See how an order moves</Link></p>
    </>
  );
}
