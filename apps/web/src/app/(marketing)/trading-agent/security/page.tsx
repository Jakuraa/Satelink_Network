import type { Metadata } from "next";
import { SECURITY } from "@/lib/trading-agent/copy";
import { TaCards, TaHeader } from "@/components/trading-agent/Parts";

export const metadata: Metadata = { title: "Security — Satelink Trading AI" };

export default function Page() {
  return (<><TaHeader title={SECURITY.title} /><TaCards items={SECURITY.items} /></>);
}
